using System.Text.Json;
using BarnaStats.Models;
using BarnaStats.Utilities;

namespace BarnaStats.Services;

public sealed class MappingSynchronizationCoordinator
{
    private readonly BarnaStatsPaths _paths;
    private readonly IMatchMappingSyncRunner _syncRunner;
    private readonly JsonSerializerOptions _jsonOptions;

    public MappingSynchronizationCoordinator(
        BarnaStatsPaths paths,
        IMatchMappingSyncRunner syncRunner,
        JsonSerializerOptions? jsonOptions = null)
    {
        _paths = paths;
        _syncRunner = syncRunner;
        _jsonOptions = jsonOptions ?? new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = true
        };
    }

    public async Task<MappingSynchronizationResult> ExecuteAsync(
        TeamStoragePaths storage,
        string? sourceUrl,
        bool includeAll,
        bool interactive,
        IReadOnlyCollection<int> explicitMatchIds,
        Action<string>? log = null)
    {
        if (!File.Exists(storage.MappingFile) &&
            string.IsNullOrWhiteSpace(sourceUrl) &&
            explicitMatchIds.Count == 0)
        {
            log?.Invoke($"No existe el mapping en: {storage.MappingFile}");
            log?.Invoke("Pasa una URL de resultados o matchWebIds explícitos para crearlo.");
            return MappingSynchronizationResult.Failed;
        }

        var mappings = await LoadMappingsAsync(storage.MappingFile);
        var mappingsById = mappings.ToDictionary(x => x.MatchWebId);
        var phaseMetadataChanged = false;
        var updatedIds = new HashSet<int>();

        foreach (var matchWebId in explicitMatchIds)
        {
            if (mappingsById.ContainsKey(matchWebId))
                continue;

            var mapping = new MatchMapping { MatchWebId = matchWebId };
            mappings.Add(mapping);
            mappingsById[matchWebId] = mapping;
        }

        try
        {
            var syncResult = await _syncRunner.SyncAsync(
                mappings,
                explicitMatchIds,
                includeAll,
                sourceUrl,
                interactive);

            if (!string.IsNullOrWhiteSpace(sourceUrl) &&
                syncResult.DiscoveredMappings.Count == 0 &&
                mappings.Count == 0)
            {
                log?.Invoke(string.Empty);
                log?.Invoke("No se pudo extraer ningún partido desde la URL de resultados.");
                log?.Invoke("La web de basquetcatala puede estar mostrando un captcha/verificación de seguridad o una estructura no compatible.");
                log?.Invoke("Abre la URL en el navegador auxiliar, resuelve la verificación si aparece y vuelve a intentarlo.");
                return MappingSynchronizationResult.Failed;
            }

            if (!string.IsNullOrWhiteSpace(sourceUrl) && syncResult.DiscoveredMappings.Count > 0)
            {
                var allowedMatchIds = syncResult.DiscoveredMappings
                    .Select(discovery => discovery.MatchWebId)
                    .Concat(explicitMatchIds)
                    .ToHashSet();

                mappings = mappings
                    .Where(mapping => allowedMatchIds.Contains(mapping.MatchWebId))
                    .ToList();

                mappingsById = mappings.ToDictionary(x => x.MatchWebId);
            }

            foreach (var discovery in syncResult.DiscoveredMappings)
            {
                if (!mappingsById.TryGetValue(discovery.MatchWebId, out var mapping))
                {
                    mapping = new MatchMapping { MatchWebId = discovery.MatchWebId };
                    mappings.Add(mapping);
                    mappingsById[discovery.MatchWebId] = mapping;
                }

                if (string.IsNullOrWhiteSpace(discovery.UuidMatch))
                {
                    if (discovery.MatchDate.HasValue)
                        mapping.MatchDate = discovery.MatchDate;

                    continue;
                }

                if (!string.Equals(mapping.UuidMatch, discovery.UuidMatch, StringComparison.OrdinalIgnoreCase))
                {
                    mapping.UuidMatch = discovery.UuidMatch;
                    updatedIds.Add(discovery.MatchWebId);
                }

                if (discovery.MatchDate.HasValue)
                    mapping.MatchDate = discovery.MatchDate;
            }

            foreach (var matchWebId in syncResult.TargetMatchWebIds)
            {
                if (!syncResult.ResolvedUuids.TryGetValue(matchWebId, out var uuidMatch) || string.IsNullOrWhiteSpace(uuidMatch))
                    continue;

                var mapping = mappingsById[matchWebId];
                if (string.Equals(mapping.UuidMatch, uuidMatch, StringComparison.OrdinalIgnoreCase))
                    continue;

                mapping.UuidMatch = uuidMatch;
                updatedIds.Add(matchWebId);
            }

            var orderedMappings = mappings
                .OrderBy(x => x.MatchWebId)
                .ToList();

            if (syncResult.PhaseMetadata is not null)
                PopulatePhaseSeasonMetadata(syncResult.PhaseMetadata, orderedMappings);

            await SaveMappingsAsync(storage.MappingFile, orderedMappings);

            if (syncResult.PhaseMetadata is not null)
            {
                if (storage.Scope.Kind == StorageScopeKind.Phase && storage.Scope.Id is > 0)
                    syncResult.PhaseMetadata.PhaseId = storage.Scope.Id;

                phaseMetadataChanged = await SavePhaseMetadataAsync(storage.PhaseMetadataFile, syncResult.PhaseMetadata);
            }

            if (!string.IsNullOrWhiteSpace(sourceUrl))
            {
                await SaveResultsSourceRegistryEntryAsync(
                    _paths.ResultsSourcesRegistryFile,
                    sourceUrl,
                    storage,
                    syncResult.PhaseMetadata);
            }

            log?.Invoke(string.Empty);

            if (syncResult.TargetMatchWebIds.Count == 0)
            {
                if (updatedIds.Count == 0)
                {
                    log?.Invoke("No hay partidos pendientes para sincronizar.");
                    log?.Invoke("Usa `sync-mappings --all` para reintentar todos o pasa una URL/IDs distintos.");
                }
                else
                {
                    log?.Invoke($"Sincronización terminada. UUIDs actualizados automáticamente: {updatedIds.Count}");
                }
            }
            else
            {
                log?.Invoke($"Sincronización terminada. UUIDs actualizados: {updatedIds.Count}");
            }

            log?.Invoke($"Mapping guardado en: {Path.GetFullPath(storage.MappingFile)}");
            if (syncResult.PhaseMetadata is not null)
                log?.Invoke($"Metadata de fase guardada en: {Path.GetFullPath(storage.PhaseMetadataFile)}");

            return new MappingSynchronizationResult(
                true,
                phaseMetadataChanged,
                updatedIds.OrderBy(id => id).ToList());
        }
        catch (Exception ex)
        {
            log?.Invoke("No se pudo completar la sincronización de mappings.");
            log?.Invoke(ex.Message);
            log?.Invoke("Si falla al abrir el navegador de Playwright, prueba a instalar Chromium o usa Chrome local.");
            return MappingSynchronizationResult.Failed;
        }
    }

    private async Task<List<MatchMapping>> LoadMappingsAsync(string mappingFile)
    {
        if (!File.Exists(mappingFile))
            return [];

        var mappingJson = await File.ReadAllTextAsync(mappingFile);
        return JsonSerializer.Deserialize<List<MatchMapping>>(mappingJson, _jsonOptions) ?? [];
    }

    private async Task SaveMappingsAsync(string mappingFile, List<MatchMapping> mappings)
    {
        var json = JsonSerializer.Serialize(mappings, _jsonOptions);
        await File.WriteAllTextAsync(mappingFile, json);
    }

    private async Task<bool> SavePhaseMetadataAsync(string phaseMetadataFile, PhaseMetadata metadata)
    {
        var json = JsonSerializer.Serialize(metadata, _jsonOptions);
        return await WriteFileIfChangedAsync(phaseMetadataFile, json);
    }

    private async Task<bool> WriteFileIfChangedAsync(string path, string content)
    {
        if (File.Exists(path))
        {
            var existingContent = await File.ReadAllTextAsync(path);
            if (string.Equals(existingContent, content, StringComparison.Ordinal))
                return false;
        }

        await File.WriteAllTextAsync(path, content);
        return true;
    }

    private async Task SaveResultsSourceRegistryEntryAsync(
        string registryFile,
        string sourceUrl,
        TeamStoragePaths storage,
        PhaseMetadata? phaseMetadata)
    {
        var entries = await LoadResultsSourceRegistryAsync(registryFile);
        var now = DateTimeOffset.UtcNow;
        var normalizedSourceUrl = sourceUrl.Trim();
        var phaseId = phaseMetadata?.PhaseId
                      ?? (storage.Scope.Kind == StorageScopeKind.Phase ? storage.Scope.Id : null);

        var existingEntry = entries.FirstOrDefault(entry =>
            string.Equals(entry.SourceUrl, normalizedSourceUrl, StringComparison.OrdinalIgnoreCase) ||
            (phaseId.HasValue && entry.PhaseId == phaseId));

        if (existingEntry is null)
        {
            existingEntry = new ResultsSourceRegistryEntry
            {
                SourceUrl = normalizedSourceUrl,
                PhaseId = phaseId,
                CreatedAtUtc = now
            };
            entries.Add(existingEntry);
        }

        existingEntry.SourceUrl = normalizedSourceUrl;
        existingEntry.PhaseId = phaseId;
        existingEntry.SeasonStartYear = phaseMetadata?.SeasonStartYear ?? existingEntry.SeasonStartYear;
        existingEntry.SeasonLabel = phaseMetadata?.SeasonLabel ?? existingEntry.SeasonLabel;
        existingEntry.CategoryName = phaseMetadata?.CategoryName ?? existingEntry.CategoryName;
        existingEntry.PhaseName = phaseMetadata?.PhaseName ?? existingEntry.PhaseName;
        existingEntry.LevelName = phaseMetadata?.LevelName ?? existingEntry.LevelName;
        existingEntry.LevelCode = phaseMetadata?.LevelCode ?? existingEntry.LevelCode;
        existingEntry.GroupCode = phaseMetadata?.GroupCode ?? existingEntry.GroupCode;
        existingEntry.LastSyncedAtUtc = now;

        var orderedEntries = entries
            .OrderBy(entry => entry.CategoryName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(entry => entry.LevelName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(entry => entry.GroupCode, StringComparer.OrdinalIgnoreCase)
            .ThenBy(entry => entry.PhaseName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(entry => entry.PhaseId ?? int.MaxValue)
            .ToList();

        var json = JsonSerializer.Serialize(orderedEntries, _jsonOptions);
        await File.WriteAllTextAsync(registryFile, json);
    }

    private async Task<List<ResultsSourceRegistryEntry>> LoadResultsSourceRegistryAsync(string registryFile)
    {
        if (!File.Exists(registryFile))
            return [];

        var json = await File.ReadAllTextAsync(registryFile);
        return JsonSerializer.Deserialize<List<ResultsSourceRegistryEntry>>(json, _jsonOptions) ?? [];
    }

    private static void PopulatePhaseSeasonMetadata(PhaseMetadata metadata, IReadOnlyCollection<MatchMapping> orderedMappings)
    {
        if (metadata.SeasonStartYear.HasValue)
        {
            metadata.SeasonLabel = NormalizeSeasonLabel(metadata.SeasonStartYear.Value, metadata.SeasonLabel);
            return;
        }

        var inferredSeasonStartYear = orderedMappings
            .Select(mapping => mapping.MatchDate)
            .Where(matchDate => matchDate.HasValue)
            .Select(matchDate => InferSeasonStartYear(matchDate!.Value))
            .GroupBy(year => year)
            .OrderByDescending(group => group.Count())
            .ThenByDescending(group => group.Key)
            .Select(group => (int?)group.Key)
            .FirstOrDefault();

        if (!inferredSeasonStartYear.HasValue)
            return;

        metadata.SeasonStartYear = inferredSeasonStartYear.Value;
        metadata.SeasonLabel = BuildSeasonLabel(inferredSeasonStartYear.Value);
    }

    private static int InferSeasonStartYear(DateTime matchDate)
    {
        return matchDate.Month >= 7 ? matchDate.Year : matchDate.Year - 1;
    }

    private static string NormalizeSeasonLabel(int seasonStartYear, string? seasonLabel)
    {
        return string.IsNullOrWhiteSpace(seasonLabel)
            ? BuildSeasonLabel(seasonStartYear)
            : seasonLabel.Trim();
    }

    private static string BuildSeasonLabel(int seasonStartYear)
    {
        return $"{seasonStartYear}-{seasonStartYear + 1}";
    }
}

public sealed record MappingSynchronizationResult(
    bool Succeeded,
    bool PhaseMetadataChanged,
    IReadOnlyList<int> DownloadCandidateMatchWebIds)
{
    public static MappingSynchronizationResult Failed { get; } =
        new(false, false, Array.Empty<int>());
}
