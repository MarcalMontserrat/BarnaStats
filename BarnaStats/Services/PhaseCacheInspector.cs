using System.Text.Json;
using BarnaStats.Models;
using BarnaStats.Utilities;

namespace BarnaStats.Services;

public sealed class PhaseCacheInspector
{
    private readonly JsonSerializerOptions _jsonOptions;

    public PhaseCacheInspector(JsonSerializerOptions? jsonOptions = null)
    {
        _jsonOptions = jsonOptions ?? new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = true
        };
    }

    public async Task<PhaseCacheInspectionResult> InspectAsync(TeamStoragePaths storage)
    {
        if (!File.Exists(storage.MappingFile))
            return new PhaseCacheInspectionResult(false, 0, 0, 0, 0, 0, 0, "Falta match_mapping.json.");

        var mappings = await LoadMappingsAsync(storage.MappingFile);
        if (mappings.Count == 0)
            return new PhaseCacheInspectionResult(false, 0, 0, 0, 0, 0, 0, "El mapping está vacío.");

        if (!File.Exists(storage.PhaseMetadataFile))
        {
            return new PhaseCacheInspectionResult(
                false,
                mappings.Count,
                0,
                0,
                mappings.Count(x => IsFutureMatch(x.MatchDate)),
                0,
                0,
                "Falta phase_metadata.json.");
        }

        var futureMappings = mappings
            .Where(mapping => IsFutureMatch(mapping.MatchDate))
            .ToList();
        var settledMappings = mappings
            .Except(futureMappings)
            .ToList();
        var missingUuidMappings = settledMappings
            .Where(mapping => string.IsNullOrWhiteSpace(mapping.UuidMatch))
            .ToList();
        var downloadableMappings = settledMappings
            .Except(missingUuidMappings)
            .ToList();
        var cachedMappings = downloadableMappings
            .Where(mapping => HasCachedStatsAndMoves(storage, mapping))
            .ToList();
        var missingDataMappings = downloadableMappings.Count - cachedMappings.Count;
        var canReuseWithoutRefresh = missingUuidMappings.Count == 0 && missingDataMappings == 0;

        var reason = canReuseWithoutRefresh
            ? "La fase ya está completa en caché."
            : missingUuidMappings.Count > 0
                ? $"Faltan UUIDs en {missingUuidMappings.Count} partidos."
                : $"Faltan stats/moves en {missingDataMappings} partidos.";

        return new PhaseCacheInspectionResult(
            canReuseWithoutRefresh,
            mappings.Count,
            downloadableMappings.Count,
            cachedMappings.Count,
            futureMappings.Count,
            missingUuidMappings.Count,
            missingDataMappings,
            reason);
    }

    private async Task<List<MatchMapping>> LoadMappingsAsync(string mappingFile)
    {
        var mappingJson = await File.ReadAllTextAsync(mappingFile);
        return JsonSerializer.Deserialize<List<MatchMapping>>(mappingJson, _jsonOptions) ?? [];
    }

    private static bool HasCachedStatsAndMoves(TeamStoragePaths storage, MatchMapping mapping)
    {
        if (string.IsNullOrWhiteSpace(mapping.UuidMatch))
            return false;

        var statsPath = storage.GetStatsPath(mapping.MatchWebId, mapping.UuidMatch);
        var movesPath = storage.GetMovesPath(mapping.MatchWebId, mapping.UuidMatch);
        return File.Exists(statsPath) && File.Exists(movesPath);
    }

    private static bool IsFutureMatch(DateTime? matchDate)
    {
        if (!matchDate.HasValue)
            return false;

        var localMatchDate = matchDate.Value;
        if (localMatchDate.TimeOfDay == TimeSpan.Zero)
            return localMatchDate.Date > DateTime.Today;

        return localMatchDate > DateTime.Now;
    }
}

public sealed record PhaseCacheInspectionResult(
    bool CanReuseWithoutRefresh,
    int TotalMappings,
    int DownloadableMappings,
    int CachedMappings,
    int FutureMappings,
    int MissingUuidMappings,
    int MissingDataMappings,
    string Reason);
