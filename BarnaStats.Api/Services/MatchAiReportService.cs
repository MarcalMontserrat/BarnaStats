using System.Text.Json;
using BarnaStats.Api.Models;
using BarnaStats.Utilities;
using GenerateAnalisys.Models;
using GenerateAnalisys.Services;

namespace BarnaStats.Api.Services;

public sealed class MatchAiReportService
{
    private readonly BarnaStatsPaths _paths;
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public MatchAiReportService(BarnaStatsPaths paths)
    {
        _paths = paths;
    }

    public async Task<MatchAiReportResponse?> GetCachedAsync(int matchWebId, int? focusTeamIdExtern = null)
    {
        var cacheEntry = await TryReadCacheEntryAsync(matchWebId, focusTeamIdExtern);
        return cacheEntry is null
            ? null
            : ToResponse(matchWebId, cacheEntry);
    }

    public async Task<MatchAiReportOperationResult> GenerateAsync(int matchWebId, bool forceRefresh, int? focusTeamIdExtern = null)
    {
        var sourceFiles = FindBestSourceFiles(matchWebId);
        if (sourceFiles is null)
        {
            return new MatchAiReportOperationResult
            {
                ErrorKind = MatchAiReportErrorKind.MatchDataNotFound,
                ErrorMessage = "No se han encontrado los stats descargados de este partido. Sincroniza primero la fase correspondiente."
            };
        }

        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("GEMINI_API_KEY")))
        {
            return new MatchAiReportOperationResult
            {
                ErrorKind = MatchAiReportErrorKind.MissingApiKey,
                ErrorMessage = "Falta GEMINI_API_KEY en el entorno de la API."
            };
        }

        var previousCacheEntry = forceRefresh
            ? await TryReadCacheEntryAsync(matchWebId, focusTeamIdExtern)
            : null;

        if (forceRefresh)
        {
            DeleteCacheIfPresent(matchWebId, focusTeamIdExtern);
        }

        var statsRaw = await File.ReadAllTextAsync(sourceFiles.StatsPath);
        var movesRaw = sourceFiles.MovesPath is not null && File.Exists(sourceFiles.MovesPath)
            ? await File.ReadAllTextAsync(sourceFiles.MovesPath)
            : null;

        var stats = JsonSerializer.Deserialize<StatsRoot>(statsRaw, _jsonOptions);
        if (stats is null || stats.Teams is null || stats.Teams.Count < 2)
        {
            return new MatchAiReportOperationResult
            {
                ErrorKind = MatchAiReportErrorKind.InvalidMatchData,
                ErrorMessage = "Los stats descargados no tienen un formato válido para generar el análisis."
            };
        }

        if (focusTeamIdExtern is > 0 &&
            stats.Teams.All(team => team.TeamIdExtern != focusTeamIdExtern.Value))
        {
            return new MatchAiReportOperationResult
            {
                ErrorKind = MatchAiReportErrorKind.InvalidMatchData,
                ErrorMessage = "El equipo seleccionado no aparece en los stats de este partido."
            };
        }

        var geminiService = new GeminiMatchReportService(
            GetMatchReportsDir(),
            enabledOverride: true);

        var report = await geminiService.GetOrGenerateAsync(matchWebId, stats, statsRaw, movesRaw, focusTeamIdExtern);
        if (report is not null)
        {
            return new MatchAiReportOperationResult
            {
                Report = new MatchAiReportResponse
                {
                    MatchWebId = matchWebId,
                    Summary = report.Summary,
                    GeneratedAtUtc = report.GeneratedAtUtc,
                    Model = report.Model
                }
            };
        }

        if (previousCacheEntry is not null)
        {
            await WriteCacheEntryAsync(matchWebId, previousCacheEntry, focusTeamIdExtern);
        }

        return new MatchAiReportOperationResult
        {
            ErrorKind = MapFailureKind(geminiService.LastFailure?.Kind),
            ErrorMessage = geminiService.LastFailure?.Message
                           ?? "Gemini no pudo generar el análisis de este partido."
        };
    }

    private async Task<MatchReportCacheEntry?> TryReadCacheEntryAsync(int matchWebId, int? focusTeamIdExtern = null)
    {
        var cachePath = GetCachePath(matchWebId, focusTeamIdExtern);
        if (!File.Exists(cachePath))
            return null;

        try
        {
            var json = await File.ReadAllTextAsync(cachePath);
            return JsonSerializer.Deserialize<MatchReportCacheEntry>(json, _jsonOptions);
        }
        catch
        {
            return null;
        }
    }

    private MatchSourceFiles? FindBestSourceFiles(int matchWebId)
    {
        var filePrefix = $"{matchWebId}_";
        var candidates = EnumerateStatsDirectories()
            .SelectMany(directory => Directory.Exists(directory)
                ? Directory.EnumerateFiles(directory, $"{filePrefix}*_stats.json", SearchOption.TopDirectoryOnly)
                : [])
            .Select(path => CreateCandidate(path))
            .OrderByDescending(candidate => candidate.Priority)
            .ThenByDescending(candidate => candidate.LastWriteTimeUtc)
            .ToList();

        return candidates.Count == 0
            ? null
            : new MatchSourceFiles(candidates[0].StatsPath, candidates[0].MovesPath);
    }

    private IEnumerable<string> EnumerateStatsDirectories()
    {
        yield return _paths.StatsDir;

        foreach (var phaseDir in Directory.Exists(_paths.PhasesDir)
                     ? Directory.EnumerateDirectories(_paths.PhasesDir)
                     : [])
        {
            yield return Path.Combine(phaseDir, "stats");
        }

        foreach (var teamDir in Directory.Exists(_paths.TeamsDir)
                     ? Directory.EnumerateDirectories(_paths.TeamsDir)
                     : [])
        {
            yield return Path.Combine(teamDir, "stats");
        }
    }

    private static MatchSourceCandidate CreateCandidate(string statsPath)
    {
        var statsDir = Path.GetDirectoryName(statsPath) ?? "";
        var rootDir = Directory.GetParent(statsDir)?.FullName ?? "";
        var fileName = Path.GetFileName(statsPath);
        var stem = fileName.EndsWith("_stats.json", StringComparison.OrdinalIgnoreCase)
            ? fileName[..^"_stats.json".Length]
            : Path.GetFileNameWithoutExtension(fileName);
        var movesPath = Path.Combine(rootDir, "moves", $"{stem}_moves.json");
        var priority = BuildPriority(statsPath);

        return new MatchSourceCandidate(
            statsPath,
            File.GetLastWriteTimeUtc(statsPath),
            File.Exists(movesPath) ? movesPath : null,
            priority);
    }

    private static int BuildPriority(string statsPath)
    {
        if (statsPath.Contains($"{Path.DirectorySeparatorChar}phases{Path.DirectorySeparatorChar}", StringComparison.OrdinalIgnoreCase))
            return 3;

        if (statsPath.Contains($"{Path.DirectorySeparatorChar}teams{Path.DirectorySeparatorChar}", StringComparison.OrdinalIgnoreCase))
            return 2;

        return 1;
    }

    private string GetMatchReportsDir()
    {
        var directory = Path.Combine(_paths.OutputDir, "match-reports");
        Directory.CreateDirectory(directory);
        return directory;
    }

    private string GetCachePath(int matchWebId, int? focusTeamIdExtern = null)
    {
        return Path.Combine(GetMatchReportsDir(), MatchReportCacheFileName.Build(matchWebId, focusTeamIdExtern));
    }

    private async Task WriteCacheEntryAsync(int matchWebId, MatchReportCacheEntry cacheEntry, int? focusTeamIdExtern = null)
    {
        var cachePath = GetCachePath(matchWebId, focusTeamIdExtern);
        var json = JsonSerializer.Serialize(cacheEntry, _jsonOptions);
        await File.WriteAllTextAsync(cachePath, json);
    }

    private void DeleteCacheIfPresent(int matchWebId, int? focusTeamIdExtern = null)
    {
        var cachePath = GetCachePath(matchWebId, focusTeamIdExtern);
        if (File.Exists(cachePath))
        {
            File.Delete(cachePath);
        }
    }

    private static MatchAiReportResponse ToResponse(int matchWebId, MatchReportCacheEntry cacheEntry)
    {
        return new MatchAiReportResponse
        {
            MatchWebId = matchWebId,
            Summary = cacheEntry.Summary,
            GeneratedAtUtc = cacheEntry.GeneratedAtUtc,
            Model = cacheEntry.Model
        };
    }

    private static MatchAiReportErrorKind MapFailureKind(MatchReportFailureKind? failureKind)
    {
        return failureKind switch
        {
            MatchReportFailureKind.MissingApiKey => MatchAiReportErrorKind.MissingApiKey,
            MatchReportFailureKind.DailyQuotaReached => MatchAiReportErrorKind.DailyQuotaReached,
            _ => MatchAiReportErrorKind.GenerationFailed
        };
    }

    private sealed record MatchSourceFiles(string StatsPath, string? MovesPath);

    private sealed record MatchSourceCandidate(
        string StatsPath,
        DateTime LastWriteTimeUtc,
        string? MovesPath,
        int Priority);
}
