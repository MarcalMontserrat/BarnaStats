using System.Text.Json;
using BarnaStats.Api.Infrastructure;
using BarnaStats.Api.Models;

namespace BarnaStats.Api.Services;

public sealed class ResultsSourceCatalogService
{
    private readonly RepoPaths _repoPaths;
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public ResultsSourceCatalogService(RepoPaths repoPaths)
    {
        _repoPaths = repoPaths;
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
}
