using System.Diagnostics;
using System.Text.Json;
using BarnaStats.Models;
using BarnaStats.Services;
using BarnaStats.Utilities;

var paths = BarnaStatsPaths.CreateDefault();
paths.EnsureDirectories();
var defaultStorage = paths.CreateStorage();
defaultStorage.EnsureDirectories();

var jsonOptions = new JsonSerializerOptions
{
    PropertyNameCaseInsensitive = true,
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    WriteIndented = true
};
const int MaxParallelMatchDownloads = 3;

if (args.Length > 0)
{
    var command = args[0].Trim().ToLowerInvariant();

    switch (command)
    {
        case "sync-mappings":
            Environment.ExitCode = await RunSyncMappingsAsync(args.Skip(1).ToArray()) ? 0 : 1;
            return;
        case "sync-all":
            Environment.ExitCode = await RunSyncAllAsync(args.Skip(1).ToArray()) ? 0 : 1;
            return;
        case "help":
        case "--help":
        case "-h":
            PrintHelp();
            return;
    }
}

var initialDownloadResult = await RunDownloadAsync(defaultStorage, forceRefresh: false);
if (!initialDownloadResult.Succeeded)
    Environment.ExitCode = 1;

return;

async Task<bool> RunSyncMappingsAsync(string[] syncArgs)
{
    if (!TryParseSyncArgs(syncArgs, out var sourceUrl, out var scope, out var includeAll, out var nonInteractive, out var forceRefresh, out _, out var explicitMatchIds))
        return false;

    var storage = paths.CreateStorage(scope);
    storage.EnsureDirectories();

    var syncResult = await ExecuteSyncMappingsAsync(storage, sourceUrl, includeAll, nonInteractive, explicitMatchIds);
    return syncResult.Succeeded;
}

async Task<bool> RunSyncAllAsync(string[] syncArgs)
{
    if (!TryParseSyncArgs(syncArgs, out var sourceUrl, out var scope, out var includeAll, out var nonInteractive, out var forceRefresh, out var analysisDirtyMarkerFile, out var explicitMatchIds))
        return false;

    var storage = paths.CreateStorage(scope);
    storage.EnsureDirectories();

    Console.WriteLine("Paso 1/3 · Sincronizando mappings");
    var syncResult = await ExecuteSyncMappingsAsync(storage, sourceUrl, includeAll, nonInteractive, explicitMatchIds);
    if (!syncResult.Succeeded)
        return false;

    (bool Succeeded, bool FilesChanged) downloadResult;
    if (!forceRefresh && syncResult.DownloadCandidateMatchWebIds.Count == 0)
    {
        Console.WriteLine();
        Console.WriteLine("Paso 2/3 · Sin partidos nuevos ni UUIDs modificados. Se omite la comprobación de stats y moves.");
        downloadResult = (true, false);
    }
    else
    {
        Console.WriteLine();
        Console.WriteLine("Paso 2/3 · Descargando stats y moves");
        downloadResult = await RunDownloadAsync(
            storage,
            forceRefresh,
            forceRefresh ? null : syncResult.DownloadCandidateMatchWebIds);
        if (!downloadResult.Succeeded)
            return false;
    }

    var analysisNeedsRefresh = syncResult.PhaseMetadataChanged || downloadResult.FilesChanged;

    if (!analysisNeedsRefresh)
    {
        Console.WriteLine();
        Console.WriteLine("Paso 3/3 · Sin cambios en los datos. Se reutiliza el analysis.json actual.");
        return true;
    }

    if (!string.IsNullOrWhiteSpace(analysisDirtyMarkerFile))
    {
        await WriteAnalysisDirtyMarkerAsync(analysisDirtyMarkerFile);
        Console.WriteLine();
        Console.WriteLine("Paso 3/3 · Cambios detectados. La regeneración de analysis.json queda diferida.");
        return true;
    }

    Console.WriteLine();
    Console.WriteLine("Paso 3/3 · Generando analysis.json");
    return await RunGenerateAnalysisAsync();
}

async Task<(bool Succeeded, bool PhaseMetadataChanged, IReadOnlyList<int> DownloadCandidateMatchWebIds)> ExecuteSyncMappingsAsync(
    TeamStoragePaths storage,
    string? sourceUrl,
    bool includeAll,
    bool nonInteractive,
    IReadOnlyCollection<int> explicitMatchIds)
{
    if (!File.Exists(storage.MappingFile) &&
        string.IsNullOrWhiteSpace(sourceUrl) &&
        explicitMatchIds.Count == 0)
    {
        Console.WriteLine($"No existe el mapping en: {storage.MappingFile}");
        Console.WriteLine("Pasa una URL de resultados o matchWebIds explícitos para crearlo.");
        return (false, false, Array.Empty<int>());
    }

    var mappings = await LoadMappingsAsync(storage.MappingFile, jsonOptions);
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
        var syncService = new MatchMappingSyncService(paths.BrowserProfileDir);
        var syncResult = await syncService.SyncAsync(
            mappings,
            explicitMatchIds,
            includeAll,
            sourceUrl,
            interactive: !nonInteractive);

        if (!string.IsNullOrWhiteSpace(sourceUrl) &&
            syncResult.DiscoveredMappings.Count == 0 &&
            mappings.Count == 0)
        {
            Console.WriteLine();
            Console.WriteLine("No se pudo extraer ningún partido desde la URL de resultados.");
            Console.WriteLine("La web de basquetcatala puede estar mostrando un captcha/verificación de seguridad o una estructura no compatible.");
            Console.WriteLine("Abre la URL en el navegador auxiliar, resuelve la verificación si aparece y vuelve a intentarlo.");
            return (false, false, Array.Empty<int>());
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

        await SaveMappingsAsync(storage.MappingFile, orderedMappings, jsonOptions);

        if (syncResult.PhaseMetadata is not null)
        {
            if (storage.Scope.Kind == StorageScopeKind.Phase && storage.Scope.Id is > 0)
            {
                syncResult.PhaseMetadata.PhaseId = storage.Scope.Id;
            }

            phaseMetadataChanged = await SavePhaseMetadataAsync(storage.PhaseMetadataFile, syncResult.PhaseMetadata, jsonOptions);
        }

        if (!string.IsNullOrWhiteSpace(sourceUrl))
        {
            await SaveResultsSourceRegistryEntryAsync(
                paths.ResultsSourcesRegistryFile,
                sourceUrl,
                storage,
                syncResult.PhaseMetadata,
                jsonOptions);
        }

        Console.WriteLine();

        if (syncResult.TargetMatchWebIds.Count == 0)
        {
            if (updatedIds.Count == 0)
            {
                Console.WriteLine("No hay partidos pendientes para sincronizar.");
                Console.WriteLine("Usa `sync-mappings --all` para reintentar todos o pasa una URL/IDs distintos.");
            }
            else
            {
                Console.WriteLine($"Sincronización terminada. UUIDs actualizados automáticamente: {updatedIds.Count}");
            }
        }
        else
        {
            Console.WriteLine($"Sincronización terminada. UUIDs actualizados: {updatedIds.Count}");
        }

        Console.WriteLine($"Mapping guardado en: {Path.GetFullPath(storage.MappingFile)}");
        if (syncResult.PhaseMetadata is not null)
        {
            Console.WriteLine($"Metadata de fase guardada en: {Path.GetFullPath(storage.PhaseMetadataFile)}");
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine("No se pudo completar la sincronización de mappings.");
        Console.WriteLine(ex.Message);
        Console.WriteLine("Si falla al abrir el navegador de Playwright, prueba a instalar Chromium o usa Chrome local.");
        return (false, false, Array.Empty<int>());
    }

    return (true, phaseMetadataChanged, updatedIds.OrderBy(id => id).ToList());
}

async Task<(bool Succeeded, bool FilesChanged)> RunDownloadAsync(
    TeamStoragePaths storage,
    bool forceRefresh,
    IReadOnlyCollection<int>? candidateMatchWebIds = null)
{
    if (!File.Exists(storage.MappingFile))
    {
        Console.WriteLine($"No existe el fichero {storage.MappingFile}");
        return (false, false);
    }

    var mappings = await LoadMappingsAsync(storage.MappingFile, jsonOptions);
    var candidateMatchIds = candidateMatchWebIds?
        .Where(matchWebId => matchWebId > 0)
        .Distinct()
        .ToHashSet();

    var validMappings = mappings
        .Where(x => !string.IsNullOrWhiteSpace(x.UuidMatch))
        .Where(x => candidateMatchIds is null || candidateMatchIds.Contains(x.MatchWebId))
        .ToList();
    var futureMappings = validMappings
        .Where(x => IsFutureMatch(x.MatchDate))
        .ToList();
    var downloadableMappings = validMappings
        .Except(futureMappings)
        .ToList();
    var cachedMappings = forceRefresh
        ? []
        : downloadableMappings
            .Where(mapping =>
            {
                var statsPath = storage.GetStatsPath(mapping.MatchWebId, mapping.UuidMatch!);
                var movesPath = storage.GetMovesPath(mapping.MatchWebId, mapping.UuidMatch!);
                return File.Exists(statsPath) && File.Exists(movesPath);
            })
            .ToList();
    var pendingMappings = forceRefresh
        ? downloadableMappings
        : downloadableMappings.Except(cachedMappings).ToList();
    var downloadedCount = 0;
    var skippedCount = cachedMappings.Count;
    var filesChanged = false;

    Console.WriteLine($"Mappings totales: {mappings.Count}");
    Console.WriteLine($"Mappings válidos : {validMappings.Count}");
    if (futureMappings.Count > 0)
        Console.WriteLine($"Partidos futuros omitidos: {futureMappings.Count}");
    if (candidateMatchIds is not null)
        Console.WriteLine($"Partidos candidatos: {candidateMatchIds.Count}");
    Console.WriteLine(forceRefresh
        ? "Modo forzado: se consultará de nuevo cada partido descargable."
        : "Modo caché: se reutilizan stats y moves si ya existen.");

    if (pendingMappings.Count == 0)
    {
        Console.WriteLine("No hay partidos pendientes de descarga.");
        Console.WriteLine();
        Console.WriteLine("Terminado.");
        Console.WriteLine($"Descargas realizadas: {downloadedCount}");
        Console.WriteLine($"Partidos reutilizados: {skippedCount}");
        Console.WriteLine($"Stats guardados en: {Path.GetFullPath(storage.StatsDir)}");
        Console.WriteLine($"Moves guardados en: {Path.GetFullPath(storage.MovesDir)}");
        return (true, false);
    }

    using var http = MsStatsHttpClientFactory.Create();
    var client = new MsStatsClient(http);
    var concurrency = Math.Min(MaxParallelMatchDownloads, pendingMappings.Count);
    var consoleLock = new object();

    Console.WriteLine($"Partidos a descargar: {pendingMappings.Count}");
    Console.WriteLine($"Concurrencia máxima : {concurrency}");

    using var semaphore = new SemaphoreSlim(concurrency);
    var results = await Task.WhenAll(pendingMappings.Select(async mapping =>
    {
        await semaphore.WaitAsync();

        try
        {
            lock (consoleLock)
            {
                Console.WriteLine($"Procesando matchWebId={mapping.MatchWebId}, uuid={mapping.UuidMatch}");
            }

            var statsPath = storage.GetStatsPath(mapping.MatchWebId, mapping.UuidMatch!);
            var movesPath = storage.GetMovesPath(mapping.MatchWebId, mapping.UuidMatch!);

            try
            {
                var statsTask = client.GetMatchStatsRawAsync(mapping.UuidMatch!);
                var movesTask = client.GetMatchMovesRawAsync(mapping.UuidMatch!);
                await Task.WhenAll(statsTask, movesTask);

                var prettyStats = JsonFormatting.PrettyPrint(await statsTask);
                var prettyMoves = JsonFormatting.PrettyPrint(await movesTask);

                var statsChanged = await WriteFileIfChangedAsync(statsPath, prettyStats);
                var movesChanged = await WriteFileIfChangedAsync(movesPath, prettyMoves);
                var staleFilesDeleted = DeleteStaleMatchFiles(storage, mapping.MatchWebId, mapping.UuidMatch!);
                var anyChanged = statsChanged || movesChanged || staleFilesDeleted;

                lock (consoleLock)
                {
                    Console.WriteLine(anyChanged
                        ? "  OK -> stats y moves actualizados"
                        : "  OK -> sin cambios en stats ni moves");
                }

                await Task.Delay(300);
                return (Downloaded: true, FilesChanged: anyChanged);
            }
            catch (Exception ex)
            {
                lock (consoleLock)
                {
                    Console.WriteLine($"  ERROR -> {ex.Message}");
                }

                await Task.Delay(300);
                return (Downloaded: false, FilesChanged: false);
            }
        }
        finally
        {
            semaphore.Release();
        }
    }));

    downloadedCount = results.Count(result => result.Downloaded);
    filesChanged = results.Any(result => result.FilesChanged);

    Console.WriteLine();
    Console.WriteLine("Terminado.");
    Console.WriteLine($"Descargas realizadas: {downloadedCount}");
    Console.WriteLine($"Partidos reutilizados: {skippedCount}");
    Console.WriteLine($"Stats guardados en: {Path.GetFullPath(storage.StatsDir)}");
    Console.WriteLine($"Moves guardados en: {Path.GetFullPath(storage.MovesDir)}");
    return (true, filesChanged);
}

async Task<bool> RunGenerateAnalysisAsync()
{
    if (!File.Exists(paths.GenerateAnalysisProjectFile))
    {
        Console.WriteLine($"No se encontró GenerateAnalisys en: {paths.GenerateAnalysisProjectFile}");
        return false;
    }

    var startInfo = new ProcessStartInfo
    {
        FileName = "dotnet",
        WorkingDirectory = paths.RepoRoot,
        UseShellExecute = false
    };

    startInfo.ArgumentList.Add("run");
    startInfo.ArgumentList.Add("--project");
    startInfo.ArgumentList.Add(paths.GenerateAnalysisProjectFile);

    using var process = Process.Start(startInfo);

    if (process is null)
    {
        Console.WriteLine("No se pudo arrancar el proceso de GenerateAnalisys.");
        return false;
    }

    await process.WaitForExitAsync();

    if (process.ExitCode == 0)
        return true;

    Console.WriteLine($"GenerateAnalisys terminó con código {process.ExitCode}.");
    return false;
}

async Task<List<MatchMapping>> LoadMappingsAsync(string mappingFile, JsonSerializerOptions options)
{
    if (!File.Exists(mappingFile))
        return [];

    var mappingJson = await File.ReadAllTextAsync(mappingFile);
    return JsonSerializer.Deserialize<List<MatchMapping>>(mappingJson, options) ?? [];
}

async Task SaveMappingsAsync(string mappingFile, List<MatchMapping> mappings, JsonSerializerOptions options)
{
    var json = JsonSerializer.Serialize(mappings, options);
    await File.WriteAllTextAsync(mappingFile, json);
}

async Task<bool> SavePhaseMetadataAsync(string phaseMetadataFile, PhaseMetadata metadata, JsonSerializerOptions options)
{
    var json = JsonSerializer.Serialize(metadata, options);
    return await WriteFileIfChangedAsync(phaseMetadataFile, json);
}

async Task<bool> WriteFileIfChangedAsync(string path, string content)
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

async Task WriteAnalysisDirtyMarkerAsync(string markerFile)
{
    var fullMarkerPath = Path.GetFullPath(markerFile);
    var markerDir = Path.GetDirectoryName(fullMarkerPath);

    if (!string.IsNullOrWhiteSpace(markerDir))
        Directory.CreateDirectory(markerDir);

    await File.WriteAllTextAsync(fullMarkerPath, DateTimeOffset.UtcNow.ToString("O"));
}

bool DeleteStaleMatchFiles(TeamStoragePaths storage, int matchWebId, string currentUuidMatch)
{
    var deletedAny = false;
    var currentStatsPath = Path.GetFullPath(storage.GetStatsPath(matchWebId, currentUuidMatch));
    var currentMovesPath = Path.GetFullPath(storage.GetMovesPath(matchWebId, currentUuidMatch));
    var matchPrefix = $"{matchWebId}_";

    foreach (var path in Directory.GetFiles(storage.StatsDir, $"{matchPrefix}*_stats.json", SearchOption.TopDirectoryOnly))
    {
        if (string.Equals(Path.GetFullPath(path), currentStatsPath, StringComparison.OrdinalIgnoreCase))
            continue;

        File.Delete(path);
        deletedAny = true;
    }

    foreach (var path in Directory.GetFiles(storage.MovesDir, $"{matchPrefix}*_moves.json", SearchOption.TopDirectoryOnly))
    {
        if (string.Equals(Path.GetFullPath(path), currentMovesPath, StringComparison.OrdinalIgnoreCase))
            continue;

        File.Delete(path);
        deletedAny = true;
    }

    return deletedAny;
}

async Task SaveResultsSourceRegistryEntryAsync(
    string registryFile,
    string sourceUrl,
    TeamStoragePaths storage,
    PhaseMetadata? phaseMetadata,
    JsonSerializerOptions options)
{
    var entries = await LoadResultsSourceRegistryAsync(registryFile, options);
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

    var json = JsonSerializer.Serialize(orderedEntries, options);
    await File.WriteAllTextAsync(registryFile, json);
}

async Task<List<ResultsSourceRegistryEntry>> LoadResultsSourceRegistryAsync(string registryFile, JsonSerializerOptions options)
{
    if (!File.Exists(registryFile))
        return [];

    var json = await File.ReadAllTextAsync(registryFile);
    return JsonSerializer.Deserialize<List<ResultsSourceRegistryEntry>>(json, options) ?? [];
}

void PopulatePhaseSeasonMetadata(PhaseMetadata metadata, IReadOnlyCollection<MatchMapping> orderedMappings)
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

int InferSeasonStartYear(DateTime matchDate)
{
    return matchDate.Month >= 7 ? matchDate.Year : matchDate.Year - 1;
}

string NormalizeSeasonLabel(int seasonStartYear, string? seasonLabel)
{
    return string.IsNullOrWhiteSpace(seasonLabel)
        ? BuildSeasonLabel(seasonStartYear)
        : seasonLabel.Trim();
}

string BuildSeasonLabel(int seasonStartYear)
{
    return $"{seasonStartYear}-{seasonStartYear + 1}";
}

void PrintHelp()
{
    Console.WriteLine("Uso:");
    Console.WriteLine("  dotnet run --project BarnaStats/BarnaStats.csproj");
    Console.WriteLine("    Descarga stats y moves usando caché y los uuid existentes en match_mapping.json.");
    Console.WriteLine();
    Console.WriteLine("  dotnet run --project BarnaStats/BarnaStats.csproj -- sync-mappings --phase 20855 --all");
    Console.WriteLine("    Usa la carpeta de la fase 20855 para reintentar o descargar sin volver a pegar la URL.");
    Console.WriteLine();
    Console.WriteLine("  dotnet run --project BarnaStats/BarnaStats.csproj -- sync-mappings");
    Console.WriteLine("    Abre un navegador y resuelve los uuid faltantes del mapping actual.");
    Console.WriteLine();
    Console.WriteLine("  dotnet run --project BarnaStats/BarnaStats.csproj -- sync-mappings https://www.basquetcatala.cat/competicions/resultats/20855/0");
    Console.WriteLine("    Extrae partidos de una fase y usa los uuid directos cuando la página los expone.");
    Console.WriteLine();
    Console.WriteLine("  dotnet run --project BarnaStats/BarnaStats.csproj -- sync-mappings --all");
    Console.WriteLine("    Reintenta todos los matchWebId existentes en el mapping actual.");
    Console.WriteLine();
    Console.WriteLine("  dotnet run --project BarnaStats/BarnaStats.csproj -- sync-mappings 70001 70002");
    Console.WriteLine("    Añade esos matchWebId al mapping y resuelve sus uuid.");
    Console.WriteLine();
    Console.WriteLine("  dotnet run --project BarnaStats/BarnaStats.csproj -- sync-all https://www.basquetcatala.cat/competicions/resultats/20855/0");
    Console.WriteLine("    Sincroniza el mapping, descarga stats/moves y genera analysis.json.");
    Console.WriteLine();
    Console.WriteLine("  dotnet run --project BarnaStats/BarnaStats.csproj -- sync-all --force https://www.basquetcatala.cat/competicions/resultats/20855/0");
    Console.WriteLine("    Fuerza la descarga de stats/moves aunque ya existan en caché.");
    Console.WriteLine();
    Console.WriteLine("  dotnet run --project BarnaStats/BarnaStats.csproj -- sync-all --non-interactive https://www.basquetcatala.cat/competicions/resultats/20855/0");
    Console.WriteLine("    Igual que sync-all, pero sin pedir ENTER en consola mientras resuelves captcha.");
    Console.WriteLine();
    Console.WriteLine("  Estructura por scope:");
    Console.WriteLine("    BarnaStats/out/results_sources.json");
    Console.WriteLine("    BarnaStats/out/phases/{phaseId}/match_mapping.json");
    Console.WriteLine("    BarnaStats/out/phases/{phaseId}/phase_metadata.json");
    Console.WriteLine("    BarnaStats/out/phases/{phaseId}/stats");
    Console.WriteLine("    BarnaStats/out/phases/{phaseId}/moves");
}

bool TryNormalizeSourceUrl(string input, out string normalizedUrl)
{
    normalizedUrl = string.Empty;

    if (!Uri.TryCreate(input, UriKind.Absolute, out var uri))
        return false;

    if (!uri.Scheme.Equals(Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) &&
        !uri.Scheme.Equals(Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase))
    {
        return false;
    }

    if (!uri.Host.EndsWith("basquetcatala.cat", StringComparison.OrdinalIgnoreCase))
        return false;

    normalizedUrl = uri.ToString();
    return true;
}

bool TryParseSyncArgs(
    string[] syncArgs,
    out string? sourceUrl,
    out StorageScope? scope,
    out bool includeAll,
    out bool nonInteractive,
    out bool forceRefresh,
    out string? analysisDirtyMarkerFile,
    out HashSet<int> explicitMatchIds)
{
    sourceUrl = null;
    scope = null;
    includeAll = false;
    nonInteractive = false;
    forceRefresh = false;
    analysisDirtyMarkerFile = null;
    explicitMatchIds = [];

    for (var i = 0; i < syncArgs.Length; i += 1)
    {
        var arg = syncArgs[i];

        if (arg.Equals("--all", StringComparison.OrdinalIgnoreCase))
        {
            includeAll = true;
            continue;
        }

        if (arg.Equals("--non-interactive", StringComparison.OrdinalIgnoreCase))
        {
            nonInteractive = true;
            continue;
        }

        if (arg.Equals("--force", StringComparison.OrdinalIgnoreCase))
        {
            forceRefresh = true;
            continue;
        }

        if (arg.Equals("--analysis-dirty-marker", StringComparison.OrdinalIgnoreCase))
        {
            if (i + 1 >= syncArgs.Length)
            {
                Console.WriteLine("Falta la ruta del marker después de --analysis-dirty-marker.");
                PrintHelp();
                return false;
            }

            analysisDirtyMarkerFile = syncArgs[i + 1];
            i += 1;
            continue;
        }

        if (arg.Equals("--phase", StringComparison.OrdinalIgnoreCase))
        {
            if (i + 1 >= syncArgs.Length)
            {
                Console.WriteLine("Falta el phaseId después de --phase.");
                PrintHelp();
                return false;
            }

            if (!int.TryParse(syncArgs[i + 1], out var phaseId) || phaseId <= 0)
            {
                Console.WriteLine($"phaseId no válido: {syncArgs[i + 1]}");
                PrintHelp();
                return false;
            }

            if (!TryAssignScope(StorageScope.Phase(phaseId), ref scope, out var phaseError))
            {
                Console.WriteLine(phaseError);
                return false;
            }

            i += 1;
            continue;
        }

        if (arg.Equals("--results", StringComparison.OrdinalIgnoreCase) ||
            arg.Equals("--source", StringComparison.OrdinalIgnoreCase))
        {
            if (i + 1 >= syncArgs.Length)
            {
                Console.WriteLine($"Falta la URL después de {arg}.");
                PrintHelp();
                return false;
            }

            if (!TryHandleSourceUrl(syncArgs[i + 1], ref sourceUrl, ref scope, out var sourceError))
            {
                Console.WriteLine(sourceError);
                return false;
            }

            i += 1;
            continue;
        }

        if (TryNormalizeSourceUrl(arg, out _))
        {
            if (!TryHandleSourceUrl(arg, ref sourceUrl, ref scope, out var inlineError))
            {
                Console.WriteLine(inlineError);
                return false;
            }

            continue;
        }

        if (int.TryParse(arg, out var matchWebId))
        {
            explicitMatchIds.Add(matchWebId);
            continue;
        }

        Console.WriteLine($"Argumento no reconocido: {arg}");
        PrintHelp();
        return false;
    }

    return true;
}

bool TryHandleSourceUrl(
    string rawSourceUrl,
    ref string? sourceUrl,
    ref StorageScope? scope,
    out string? error)
{
    error = null;

    if (!TryNormalizeSourceUrl(rawSourceUrl, out var normalizedSourceUrl))
    {
        error = $"URL no válida: {rawSourceUrl}";
        return false;
    }

    if (!TryInferScopeFromSourceUrl(normalizedSourceUrl, out var inferredScope))
    {
        error = $"La URL no parece una página de resultados válida: {normalizedSourceUrl}";
        return false;
    }

    if (!TryAssignScope(inferredScope, ref scope, out error))
        return false;

    sourceUrl = normalizedSourceUrl;
    return true;
}

bool TryAssignScope(StorageScope candidateScope, ref StorageScope? currentScope, out string? error)
{
    error = null;

    if (currentScope is null)
    {
        currentScope = candidateScope;
        return true;
    }

    if (currentScope.Kind == candidateScope.Kind && currentScope.Id == candidateScope.Id)
        return true;

    error = $"Conflicto de scope: ya estabas trabajando con {currentScope}, pero se intentó usar {candidateScope}.";
    return false;
}

bool IsFutureMatch(DateTime? matchDate)
{
    if (!matchDate.HasValue)
        return false;

    var localMatchDate = matchDate.Value;
    if (localMatchDate.TimeOfDay == TimeSpan.Zero)
        return localMatchDate.Date > DateTime.Today;

    return localMatchDate > DateTime.Now;
}

bool TryInferScopeFromSourceUrl(string sourceUrl, out StorageScope scope)
{
    scope = StorageScope.Root();

    if (!Uri.TryCreate(sourceUrl, UriKind.Absolute, out var uri))
        return false;

    var segments = uri.AbsolutePath
        .Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    if (segments.Length >= 3 &&
        segments[0].Equals("competicions", StringComparison.OrdinalIgnoreCase) &&
        segments[1].Equals("resultats", StringComparison.OrdinalIgnoreCase) &&
        int.TryParse(segments[2], out var phaseId) &&
        phaseId > 0)
    {
        scope = StorageScope.Phase(phaseId);
        return true;
    }

    return false;
}
