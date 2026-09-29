using System.Text.Json;
using BarnaStats.Api.Infrastructure;
using BarnaStats.Api.Models;
using BarnaStats.Services;
using BarnaStats.Utilities;

namespace BarnaStats.Api.Services;

public sealed class ResultsSourceCatalogService
{
    private readonly RepoPaths _repoPaths;
    private readonly BarnaStatsPaths _barnaStatsPaths;
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public ResultsSourceCatalogService(RepoPaths repoPaths, BarnaStatsPaths barnaStatsPaths)
    {
        _repoPaths = repoPaths;
        _barnaStatsPaths = barnaStatsPaths;
    }

    public async Task<IReadOnlyList<ResultsSourceSnapshot>> GetAllAsync()
    {
        if (!File.Exists(_repoPaths.ResultsSourcesRegistryFile))
            return [];

        var json = await File.ReadAllTextAsync(_repoPaths.ResultsSourcesRegistryFile);
        var entries = JsonSerializer.Deserialize<List<ResultsSourceSnapshot>>(json, _jsonOptions) ?? [];

        return entries
            .OrderByDescending(entry => entry.LastSyncedAtUtc)
            .ThenBy(entry => entry.CategoryName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(entry => entry.LevelName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(entry => entry.GroupCode, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    // Añade la temporada (guardada o deducida de sus partidos) y si su importación está bloqueada,
    // con la misma regla que aplica la sincronización para que pantalla e importación no discrepen.
    public async Task<IReadOnlyList<ResultsSourceListItem>> GetAllWithSeasonStatusAsync()
    {
        var entries = await GetAllAsync();
        var currentSeasonStartYear = PastSeasonImportGuard.GetSeasonStartYear(DateTime.Now);
        var items = new List<ResultsSourceListItem>(entries.Count);

        foreach (var entry in entries)
        {
            var seasonStartYear = entry.SeasonStartYear;
            string? blockReason = null;

            if (entry.PhaseId is > 0)
            {
                var storage = _barnaStatsPaths.CreateStorage(StorageScope.Phase(entry.PhaseId.Value));
                seasonStartYear ??= await PastSeasonImportGuard.ResolveStoredSeasonStartYearAsync(storage);
                blockReason = await PastSeasonImportGuard.GetBlockReasonAsync(storage, DateTime.Now);
            }

            var seasonLabel = !string.IsNullOrWhiteSpace(entry.SeasonLabel)
                ? entry.SeasonLabel
                : seasonStartYear is > 0
                    ? PastSeasonImportGuard.FormatSeasonLabel(seasonStartYear.Value)
                    : "";

            items.Add(new ResultsSourceListItem
            {
                SourceUrl = entry.SourceUrl,
                PhaseId = entry.PhaseId,
                SeasonStartYear = seasonStartYear,
                SeasonLabel = seasonLabel,
                CategoryName = entry.CategoryName,
                PhaseName = entry.PhaseName,
                LevelName = entry.LevelName,
                LevelCode = entry.LevelCode,
                GroupCode = entry.GroupCode,
                CreatedAtUtc = entry.CreatedAtUtc,
                LastSyncedAtUtc = entry.LastSyncedAtUtc,
                IsCurrentSeason = seasonStartYear == currentSeasonStartYear,
                ImportBlocked = blockReason is not null,
                ImportBlockedReason = blockReason
            });
        }

        return items;
    }
}
