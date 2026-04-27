using System.Text.Json;
using BarnaStats.Api.Models;
using BarnaStats.Utilities;
using GenerateAnalisys.Models;
using GenerateAnalisys.Services;

namespace BarnaStats.Api.Services;

public sealed class MatchAiReportService
{
    private readonly BarnaStatsPaths _paths;
    private readonly Func<string, IMatchReportProviderService> _createGeminiService;
    private readonly Func<string, IMatchReportProviderService> _createOpenAiService;
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };
    private readonly JsonSerializerOptions _publishedJsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true
    };

    public MatchAiReportService(
        BarnaStatsPaths paths,
        Func<string, IMatchReportProviderService>? createGeminiService = null,
        Func<string, IMatchReportProviderService>? createOpenAiService = null)
    {
        _paths = paths;
        _createGeminiService = createGeminiService
            ?? (cacheDir => new GeminiMatchReportService(cacheDir, enabledOverride: true));
        _createOpenAiService = createOpenAiService
            ?? (cacheDir => new OpenAiMatchReportService(cacheDir, enabledOverride: true));
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

        var providerFailures = new List<(string ProviderName, MatchReportFailure Failure)>();
        MatchReportResult? report = null;

        foreach (var provider in CreateProviderChain())
        {
            report = await provider.GetOrGenerateAsync(matchWebId, stats, statsRaw, movesRaw, focusTeamIdExtern);
            if (report is not null)
            {
                Console.WriteLine($"Análisis {matchWebId} generado con {provider.ProviderName} ({report.Model}).");
                break;
            }

            if (provider.LastFailure is not null)
            {
                providerFailures.Add((provider.ProviderName, provider.LastFailure));
            }
        }

        if (report is not null)
        {
            await PersistReportToPublishedDatasetsAsync(matchWebId, stats, report, focusTeamIdExtern);

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
            ErrorKind = MapFailureKind(SelectFailure(providerFailures)?.Kind),
            ErrorMessage = BuildFailureMessage(providerFailures)
        };
    }

    private IEnumerable<IMatchReportProviderService> CreateProviderChain()
    {
        var preferredProvider = (Environment.GetEnvironmentVariable("BARNASTATS_AI_PROVIDER") ?? "gemini")
            .Trim()
            .ToLowerInvariant();
        var cacheDir = GetMatchReportsDir();

        if (preferredProvider == "openai")
        {
            yield return _createOpenAiService(cacheDir);
            yield return _createGeminiService(cacheDir);
            yield break;
        }

        yield return _createGeminiService(cacheDir);
        yield return _createOpenAiService(cacheDir);
    }

    private static MatchReportFailure? SelectFailure(
        IReadOnlyList<(string ProviderName, MatchReportFailure Failure)> providerFailures)
    {
        if (providerFailures.Count == 0)
            return null;

        var dailyQuotaFailure = providerFailures
            .Select(entry => entry.Failure)
            .FirstOrDefault(failure => failure.Kind == MatchReportFailureKind.DailyQuotaReached);
        if (dailyQuotaFailure is not null)
            return dailyQuotaFailure;

        var nonMissingKeyFailure = providerFailures
            .Select(entry => entry.Failure)
            .LastOrDefault(failure => failure.Kind != MatchReportFailureKind.MissingApiKey);
        if (nonMissingKeyFailure is not null)
            return nonMissingKeyFailure;

        return providerFailures[^1].Failure;
    }

    private static string BuildFailureMessage(
        IReadOnlyList<(string ProviderName, MatchReportFailure Failure)> providerFailures)
    {
        if (providerFailures.Count == 0)
        {
            return "No se pudo generar el análisis del partido con los proveedores configurados.";
        }

        if (providerFailures.Count == 1)
        {
            return providerFailures[0].Failure.Message;
        }

        return string.Join(
            " ",
            providerFailures.Select(entry => $"{entry.ProviderName}: {entry.Failure.Message}"));
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

    private async Task PersistReportToPublishedDatasetsAsync(
        int matchWebId,
        StatsRoot stats,
        MatchReportResult report,
        int? focusTeamIdExtern)
    {
        var affectedTeamIdsExtern = focusTeamIdExtern is > 0
            ? new HashSet<int> { focusTeamIdExtern.Value }
            : (stats.Teams ?? [])
                .Select(team => team.TeamIdExtern)
                .Where(teamIdExtern => teamIdExtern > 0)
                .ToHashSet();
        var updatedFiles = 0;

        foreach (var root in EnumeratePublishedMatchRoots())
        {
            updatedFiles += await UpdatePublishedMatchesUnderRootAsync(
                root,
                matchWebId,
                report,
                focusTeamIdExtern,
                affectedTeamIdsExtern);
        }

        Console.WriteLine(
            $"Análisis {matchWebId} persistido en {updatedFiles} fichero(s) de datos publicados{(focusTeamIdExtern is > 0 ? $" para el equipo {focusTeamIdExtern.Value}" : "")}.");
    }

    private IEnumerable<string> EnumeratePublishedMatchRoots()
    {
        yield return Path.Combine(_paths.OutputDir, "analysis", "teams");
        yield return Path.Combine(_paths.OutputDir, "analysis", "seasons");
        yield return Path.Combine(_paths.RepoRoot, "barna-stats-webapp", "public", "data", "teams");
        yield return Path.Combine(_paths.RepoRoot, "barna-stats-webapp", "public", "data", "seasons");
    }

    private async Task<int> UpdatePublishedMatchesUnderRootAsync(
        string rootDirectory,
        int matchWebId,
        MatchReportResult report,
        int? focusTeamIdExtern,
        ISet<int> affectedTeamIdsExtern)
    {
        if (!Directory.Exists(rootDirectory))
        {
            return 0;
        }

        var updatedFiles = 0;
        foreach (var matchesPath in Directory.EnumerateFiles(rootDirectory, "matches.json", SearchOption.AllDirectories))
        {
            if (!await TryUpdatePublishedMatchesFileAsync(
                    matchesPath,
                    matchWebId,
                    report,
                    focusTeamIdExtern,
                    affectedTeamIdsExtern))
            {
                continue;
            }

            updatedFiles += 1;
        }

        return updatedFiles;
    }

    private async Task<bool> TryUpdatePublishedMatchesFileAsync(
        string matchesPath,
        int matchWebId,
        MatchReportResult report,
        int? focusTeamIdExtern,
        ISet<int> affectedTeamIdsExtern)
    {
        try
        {
            var json = await File.ReadAllTextAsync(matchesPath);
            if (!json.Contains($"\"matchWebId\": {matchWebId}", StringComparison.Ordinal) &&
                !json.Contains($"\"matchWebId\":{matchWebId}", StringComparison.Ordinal))
            {
                return false;
            }

            var summaries = JsonSerializer.Deserialize<List<MatchSummary>>(json, _publishedJsonOptions);
            if (summaries is null || summaries.Count == 0)
            {
                return false;
            }

            var updated = false;
            foreach (var summary in summaries)
            {
                if (summary.MatchWebId != matchWebId)
                {
                    continue;
                }

                if (!ShouldUpdateSummary(summary, focusTeamIdExtern, affectedTeamIdsExtern))
                {
                    continue;
                }

                if (string.Equals(summary.MatchReport, report.Summary, StringComparison.Ordinal) &&
                    summary.MatchReportGeneratedAtUtc == report.GeneratedAtUtc &&
                    string.Equals(summary.MatchReportModel, report.Model, StringComparison.Ordinal))
                {
                    continue;
                }

                summary.MatchReport = report.Summary;
                summary.MatchReportGeneratedAtUtc = report.GeneratedAtUtc;
                summary.MatchReportModel = report.Model;
                updated = true;
            }

            if (!updated)
            {
                return false;
            }

            var updatedJson = JsonSerializer.Serialize(summaries, _publishedJsonOptions);
            await File.WriteAllTextAsync(matchesPath, updatedJson);
            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"No se pudo persistir el análisis en `{matchesPath}`: {ex.Message}");
            return false;
        }
    }

    private static bool ShouldUpdateSummary(
        MatchSummary summary,
        int? focusTeamIdExtern,
        ISet<int> affectedTeamIdsExtern)
    {
        if (focusTeamIdExtern is > 0)
        {
            return summary.TeamIdExtern == focusTeamIdExtern.Value;
        }

        return affectedTeamIdsExtern.Count == 0 || affectedTeamIdsExtern.Contains(summary.TeamIdExtern);
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
