using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using GenerateAnalisys.Models;

namespace GenerateAnalisys.Utilities;

public static class AnalysisJsonWriter
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true
    };

    public static async Task WriteAsync(AnalysisPaths paths, AnalysisResult analysis)
    {
        var seasonDatasets = BuildSeasonDatasets(analysis);
        var latestDataset = seasonDatasets.FirstOrDefault()?.Analysis ?? analysis;

        // `BarnaStats/out/analysis` es un espejo exacto de `public/data`: se construye y serializa una sola vez
        // contra la web y cada fichero se escribe en ambos árboles.
        var output = new JsonOutput(paths);

        // La temporada actual vive en la raíz de `data/`; las anteriores en `data/seasons/{temporada}/`
        // con la misma estructura. `archive/` es transversal a todas las temporadas.
        WriteSeasonData(output, paths.WebDataDir, latestDataset, paths.RepoRoot);

        WriteArchiveDatasets(
            output,
            paths.WebDataDir,
            latestDataset.GeneratedAtUtc,
            seasonDatasets.Select(dataset => dataset.Analysis).ToList());

        WriteSeasonDatasets(
            output,
            paths.WebSeasonsDir,
            paths.WebSeasonIndexJson,
            analysis.GeneratedAtUtc,
            seasonDatasets,
            paths.RepoRoot);

        await output.FlushAsync();
    }

    private static void WriteSeasonData(
        JsonOutput output,
        string seasonRootDir,
        AnalysisResult dataset,
        string repoRoot)
    {
        WriteDataset(
            output,
            dataset,
            Path.Combine(seasonRootDir, "analysis.json"),
            Path.Combine(seasonRootDir, "competition.json"),
            Path.Combine(seasonRootDir, "teams"),
            teamFilesRelativeRoot: "teams");

        WriteDerivedDatasets(output, seasonRootDir, dataset, repoRoot);
    }

    private static void WriteSeasonDatasets(
        JsonOutput output,
        string seasonsDir,
        string seasonIndexPath,
        DateTime generatedAtUtc,
        IReadOnlyList<SeasonDataset> seasonDatasets,
        string repoRoot)
    {
        output.CreateDirectory(seasonsDir);

        var expectedSeasonDirectories = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var seasonSummaries = new List<SeasonDatasetSummary>();

        for (var index = 0; index < seasonDatasets.Count; index++)
        {
            var seasonDataset = seasonDatasets[index];

            // La temporada actual ya está en la raíz: no se duplica en `seasons/`.
            var dataRoot = index == 0 ? "" : $"seasons/{seasonDataset.DirectoryName}/";
            if (index > 0)
            {
                expectedSeasonDirectories.Add(seasonDataset.DirectoryName);
                WriteSeasonData(
                    output,
                    Path.Combine(seasonsDir, seasonDataset.DirectoryName),
                    seasonDataset.Analysis,
                    repoRoot);
            }

            seasonSummaries.Add(new SeasonDatasetSummary
            {
                SeasonStartYear = seasonDataset.Analysis.SeasonStartYear,
                SeasonLabel = seasonDataset.Analysis.SeasonLabel,
                TotalTeams = seasonDataset.Analysis.Teams.Count,
                TotalMatches = seasonDataset.Analysis.TotalMatches,
                DataRoot = dataRoot,
                AnalysisFile = $"{dataRoot}analysis.json",
                CompetitionFile = $"{dataRoot}competition.json"
            });
        }

        foreach (var directory in output.ResolveTargets(seasonsDir))
            DeleteStaleSeasonDirectories(directory, expectedSeasonDirectories);

        var seasonIndex = new SeasonDatasetIndex
        {
            GeneratedAtUtc = generatedAtUtc,
            DefaultSeasonLabel = seasonDatasets.FirstOrDefault()?.Analysis.SeasonLabel ?? "",
            HistoricalTeamsFile = "archive/teams.json",
            HistoricalPlayersFile = "archive/players.json",
            Seasons = seasonSummaries
        };

        output.Enqueue(seasonIndexPath, seasonIndex);
    }

    private static void WriteDataset(
        JsonOutput output,
        AnalysisResult analysis,
        string analysisIndexPath,
        string competitionPath,
        string teamDetailsDir,
        string teamFilesRelativeRoot)
    {
        output.CreateDirectory(teamDetailsDir);

        var index = BuildIndex(analysis, teamFilesRelativeRoot);

        output.Enqueue(analysisIndexPath, index);
        output.Enqueue(competitionPath, analysis.Competition);

        var expectedTeamDirectories = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var team in analysis.Teams)
        {
            var teamDirectoryName = GetTeamDirectoryName(team.TeamKey);
            expectedTeamDirectories.Add(teamDirectoryName);

            var teamDirectory = Path.Combine(teamDetailsDir, teamDirectoryName);

            output.Enqueue(Path.Combine(teamDirectory, "matches.json"), team.MatchSummaries);
            output.Enqueue(Path.Combine(teamDirectory, "players.json"), team.MatchPlayers);
        }

        foreach (var directory in output.ResolveTargets(teamDetailsDir))
            DeleteStaleTeamFiles(directory, expectedTeamDirectories);
    }

    private static AnalysisIndex BuildIndex(AnalysisResult analysis, string teamFilesRelativeRoot)
    {
        return new AnalysisIndex
        {
            SeasonStartYear = analysis.SeasonStartYear,
            SeasonLabel = analysis.SeasonLabel,
            GeneratedAtUtc = analysis.GeneratedAtUtc,
            TotalMatches = analysis.TotalMatches,
            TotalTeams = analysis.Teams.Count,
            Teams = analysis.Teams
                .Select(team => new AnalysisIndexTeam
                {
                    SeasonStartYear = team.SeasonStartYear,
                    SeasonLabel = team.SeasonLabel,
                    TeamKey = team.TeamKey,
                    TeamIdIntern = team.TeamIdIntern,
                    TeamIdExtern = team.TeamIdExtern,
                    TeamName = team.TeamName,
                    MatchesPlayed = team.MatchesPlayed,
                    PlayersCount = team.PlayersCount,
                    MatchesFile = $"{teamFilesRelativeRoot}/{GetTeamDirectoryName(team.TeamKey)}/matches.json",
                    PlayersFile = $"{teamFilesRelativeRoot}/{GetTeamDirectoryName(team.TeamKey)}/players.json",
                    Phases = team.Phases
                })
                .OrderBy(team => team.TeamName, StringComparer.OrdinalIgnoreCase)
                .ToList()
        };
    }

    private static void WriteDerivedDatasets(
        JsonOutput output,
        string dataRootDir,
        AnalysisResult latestDataset,
        string repoRoot)
    {
        output.CreateDirectory(dataRootDir);

        var competitionOverviewPath = Path.Combine(dataRootDir, "competition-overview.json");
        var competitionStandingsPath = Path.Combine(dataRootDir, "competition-standings.json");
        var competitionMatchesPath = Path.Combine(dataRootDir, "competition-matches.json");
        var competitionPlayerLeadersPath = Path.Combine(dataRootDir, "competition-player-leaders.json");
        var competitionMatchesByCategoryDir = Path.Combine(dataRootDir, "competition-matches");
        var competitionLeadersByCategoryDir = Path.Combine(dataRootDir, "competition-player-leaders");
        var competitionStandingsByCategoryDir = Path.Combine(dataRootDir, "competition-standings");
        var analysisLightPath = Path.Combine(dataRootDir, "analysis-light.json");
        var clubsPath = Path.Combine(dataRootDir, "clubs.json");

        output.Enqueue(competitionMatchesPath, latestDataset.Competition.Matches);
        output.Enqueue(competitionPlayerLeadersPath, latestDataset.Competition.PlayerLeaders);

        // Build per-category files and collect the mapping for competition-overview
        var teamCategoryLookup = latestDataset.Teams
            .ToDictionary(
                t => t.TeamKey,
                t => t.Phases
                    .OrderByDescending(p => p.PhaseNumber)
                    .ThenByDescending(p => p.SourcePhaseId ?? 0)
                    .FirstOrDefault()?.CategoryName ?? "",
                StringComparer.Ordinal);

        var categoryFilesDict = new Dictionary<string, CompetitionCategoryFilesBuilder>(StringComparer.Ordinal);

        foreach (var group in latestDataset.Competition.Matches
            .GroupBy(m => m.CategoryName ?? "")
            .Where(g => !string.IsNullOrWhiteSpace(g.Key)))
        {
            var slug = BuildCategorySlug(group.Key);
            var relFile = $"competition-matches/{slug}.json";
            output.Enqueue(Path.Combine(competitionMatchesByCategoryDir, $"{slug}.json"), group.ToList());
            if (!categoryFilesDict.TryGetValue(group.Key, out var entry))
            {
                entry = new CompetitionCategoryFilesBuilder(group.Key);
                categoryFilesDict[group.Key] = entry;
            }

            entry.MatchesFile = relFile;
        }

        foreach (var group in latestDataset.Competition.PlayerLeaders
            .GroupBy(p => teamCategoryLookup.GetValueOrDefault(p.TeamKey, ""))
            .Where(g => !string.IsNullOrWhiteSpace(g.Key)))
        {
            var slug = BuildCategorySlug(group.Key);
            var relFile = $"competition-player-leaders/{slug}.json";
            output.Enqueue(Path.Combine(competitionLeadersByCategoryDir, $"{slug}.json"), group.ToList());
            if (!categoryFilesDict.TryGetValue(group.Key, out var entry))
            {
                entry = new CompetitionCategoryFilesBuilder(group.Key);
                categoryFilesDict[group.Key] = entry;
            }

            entry.LeadersFile = relFile;
        }

        var standingsDataset = PrecomputedDatasetsBuilder.BuildCompetitionStandings(latestDataset.Competition);
        output.CreateDirectory(competitionStandingsByCategoryDir);

        foreach (var group in standingsDataset.Scopes
            .GroupBy(s => s.CategoryName ?? "")
            .Where(g => !string.IsNullOrWhiteSpace(g.Key)))
        {
            var slug = BuildCategorySlug(group.Key);
            var relFile = $"competition-standings/{slug}.json";
            var categoryStandings = new CompetitionStandingsDataset
            {
                SeasonStartYear = standingsDataset.SeasonStartYear,
                SeasonLabel = standingsDataset.SeasonLabel,
                Scopes = group.ToList()
            };
            output.Enqueue(Path.Combine(competitionStandingsByCategoryDir, $"{slug}.json"), categoryStandings);
            if (!categoryFilesDict.TryGetValue(group.Key, out var entry))
            {
                entry = new CompetitionCategoryFilesBuilder(group.Key);
                categoryFilesDict[group.Key] = entry;
            }

            entry.StandingsFile = relFile;
        }

        var categoryFiles = categoryFilesDict.Values
            .OrderBy(e => e.CategoryName, StringComparer.OrdinalIgnoreCase)
            .Select(e => new CompetitionCategoryFiles
            {
                CategoryName = e.CategoryName,
                MatchesFile = e.MatchesFile,
                LeadersFile = e.LeadersFile,
                StandingsFile = e.StandingsFile
            })
            .ToList();

        output.Enqueue(
            competitionOverviewPath,
            PrecomputedDatasetsBuilder.BuildCompetitionOverview(latestDataset.Competition, categoryFiles));
        output.Enqueue(competitionStandingsPath, standingsDataset);
        output.Enqueue(analysisLightPath, BuildLightIndex(latestDataset));
        output.Enqueue(
            clubsPath,
            PrecomputedDatasetsBuilder.BuildClubDirectory(latestDataset, repoRoot));
    }

    private static void WriteArchiveDatasets(
        JsonOutput output,
        string dataRootDir,
        DateTime generatedAtUtc,
        IReadOnlyCollection<AnalysisResult> seasonAnalyses)
    {
        var archiveDir = Path.Combine(dataRootDir, "archive");
        var historicalTeamsPath = Path.Combine(archiveDir, "teams.json");
        var historicalPlayersPath = Path.Combine(archiveDir, "players.json");
        var historicalPlayersIndexPath = Path.Combine(archiveDir, "players-index.json");
        var historicalPlayersDetailsDir = Path.Combine(archiveDir, "players");

        output.Enqueue(
            historicalTeamsPath,
            PrecomputedDatasetsBuilder.BuildHistoricalTeamDirectory(generatedAtUtc, seasonAnalyses));

        var playerDirectory = PrecomputedDatasetsBuilder.BuildHistoricalPlayerDirectory(generatedAtUtc, seasonAnalyses);
        output.Enqueue(historicalPlayersPath, playerDirectory);

        var playerIndex = new HistoricalPlayerIndexDataset
        {
            GeneratedAtUtc = playerDirectory.GeneratedAtUtc,
            Players = playerDirectory.Players
                .Select(p => new HistoricalPlayerIndexEntry
                {
                    Key = p.Key,
                    Label = p.Label,
                    LatestShirtNumber = p.LatestShirtNumber,
                    Meta = p.Meta,
                    SearchText = p.SearchText
                })
                .ToList()
        };
        output.Enqueue(historicalPlayersIndexPath, playerIndex);

        foreach (var player in playerDirectory.Players)
        {
            var safeKey = player.Key.Replace(":", "-");
            output.Enqueue(Path.Combine(historicalPlayersDetailsDir, $"{safeKey}.json"), player);
        }
    }

    private static string BuildCategorySlug(string categoryName)
    {
        var normalized = categoryName.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder();
        foreach (var c in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark)
                continue;
            sb.Append(char.IsLetterOrDigit(c) ? char.ToLowerInvariant(c) : '-');
        }

        var slug = Regex.Replace(sb.ToString(), "-{2,}", "-").Trim('-');
        return string.IsNullOrEmpty(slug) ? "other" : slug;
    }

    private sealed class CompetitionCategoryFilesBuilder(string categoryName)
    {
        public string CategoryName { get; } = categoryName;
        public string? MatchesFile { get; set; }
        public string? LeadersFile { get; set; }
        public string? StandingsFile { get; set; }
    }

    private static AnalysisIndexLight BuildLightIndex(AnalysisResult analysis)
    {
        return new AnalysisIndexLight
        {
            SeasonStartYear = analysis.SeasonStartYear,
            SeasonLabel = analysis.SeasonLabel,
            GeneratedAtUtc = analysis.GeneratedAtUtc,
            TotalMatches = analysis.TotalMatches,
            TotalTeams = analysis.Teams.Count,
            Teams = analysis.Teams
                .Select(team =>
                {
                    var latestPhase = team.Phases
                        .OrderByDescending(p => p.PhaseNumber)
                        .ThenByDescending(p => p.SourcePhaseId ?? 0)
                        .FirstOrDefault(p =>
                            !string.IsNullOrEmpty(p.CategoryName) ||
                            !string.IsNullOrEmpty(p.LevelName) ||
                            !string.IsNullOrEmpty(p.PhaseName));
                    return new AnalysisIndexLightTeam
                    {
                        SeasonStartYear = team.SeasonStartYear,
                        SeasonLabel = team.SeasonLabel,
                        TeamKey = team.TeamKey,
                        TeamIdIntern = team.TeamIdIntern,
                        TeamIdExtern = team.TeamIdExtern,
                        TeamName = team.TeamName,
                        MatchesPlayed = team.MatchesPlayed,
                        PlayersCount = team.PlayersCount,
                        MatchesFile = $"teams/{GetTeamDirectoryName(team.TeamKey)}/matches.json",
                        PlayersFile = $"teams/{GetTeamDirectoryName(team.TeamKey)}/players.json",
                        LatestContext = latestPhase is null ? null : new TeamLatestContext
                        {
                            PhaseNumber = latestPhase.PhaseNumber,
                            SourcePhaseId = latestPhase.SourcePhaseId,
                            CategoryName = latestPhase.CategoryName ?? "",
                            PhaseName = latestPhase.PhaseName ?? "",
                            LevelName = latestPhase.LevelName ?? "",
                            LevelCode = latestPhase.LevelCode ?? "",
                            GroupCode = latestPhase.GroupCode ?? ""
                        }
                    };
                })
                .OrderBy(team => team.TeamName, StringComparer.OrdinalIgnoreCase)
                .ToList()
        };
    }

    private static IReadOnlyList<SeasonDataset> BuildSeasonDatasets(AnalysisResult analysis)
    {
        return analysis.Teams
            .GroupBy(team => new SeasonGrouping(
                team.SeasonStartYear,
                NormalizeSeasonLabel(team.SeasonStartYear, team.SeasonLabel)))
            .Where(group => !string.IsNullOrWhiteSpace(group.Key.SeasonLabel))
            .OrderByDescending(group => group.Key.SeasonStartYear ?? int.MinValue)
            .ThenByDescending(group => group.Key.SeasonLabel, StringComparer.OrdinalIgnoreCase)
            .Select(group => BuildSeasonDataset(analysis, group.Key, group.ToList()))
            .ToList();
    }

    private static SeasonDataset BuildSeasonDataset(
        AnalysisResult analysis,
        SeasonGrouping season,
        List<TeamAnalysis> teams)
    {
        var teamKeys = teams
            .Select(team => team.TeamKey)
            .ToHashSet(StringComparer.Ordinal);

        var competitionMatches = analysis.Competition.Matches
            .Where(match => IsSeasonMatch(match, season))
            .OrderBy(match => match.MatchDate ?? DateTime.MaxValue)
            .ThenBy(match => match.MatchWebId)
            .ToList();

        var competition = new CompetitionAnalysis
        {
            SeasonStartYear = season.SeasonStartYear,
            SeasonLabel = season.SeasonLabel,
            TotalTeams = teams.Count,
            TotalMatches = competitionMatches.Count,
            Phases = analysis.Competition.Phases
                .Where(phase => IsSameSeason(phase.SeasonStartYear, phase.SeasonLabel, season))
                .OrderBy(phase => phase.PhaseNumber)
                .ThenBy(phase => phase.SourcePhaseId ?? int.MaxValue)
                .ToList(),
            Teams = analysis.Competition.Teams
                .Where(team => teamKeys.Contains(team.TeamKey))
                .OrderBy(team => team.TeamName, StringComparer.OrdinalIgnoreCase)
                .ToList(),
            Matches = competitionMatches,
            StandingsByPhase = analysis.Competition.StandingsByPhase
                .Where(standing => IsSameSeason(standing.SeasonStartYear, standing.SeasonLabel, season))
                .OrderBy(standing => standing.PhaseNumber)
                .ToList(),
            PlayerLeaders = analysis.Competition.PlayerLeaders
                .Where(player => IsSameSeason(player.SeasonStartYear, player.SeasonLabel, season))
                .OrderByDescending(player => player.Points)
                .ThenBy(player => player.PlayerName, StringComparer.OrdinalIgnoreCase)
                .ToList()
        };

        var seasonAnalysis = new AnalysisResult
        {
            SeasonStartYear = season.SeasonStartYear,
            SeasonLabel = season.SeasonLabel,
            GeneratedAtUtc = analysis.GeneratedAtUtc,
            TotalMatches = competitionMatches.Count,
            Competition = competition,
            Teams = teams
                .OrderBy(team => team.TeamName, StringComparer.OrdinalIgnoreCase)
                .ToList()
        };

        return new SeasonDataset(GetSeasonDirectoryName(season.SeasonStartYear, season.SeasonLabel), seasonAnalysis);
    }

    private static bool IsSeasonMatch(CompetitionMatch match, SeasonGrouping season)
    {
        return IsSameSeason(match.SeasonStartYear, match.SeasonLabel, season);
    }

    private static bool IsSameSeason(int? seasonStartYear, string? seasonLabel, SeasonGrouping season)
    {
        var normalizedLabel = NormalizeSeasonLabel(seasonStartYear, seasonLabel);

        return string.Equals(normalizedLabel, season.SeasonLabel, StringComparison.OrdinalIgnoreCase)
               && seasonStartYear == season.SeasonStartYear;
    }

    private static string NormalizeSeasonLabel(int? seasonStartYear, string? seasonLabel)
    {
        if (!string.IsNullOrWhiteSpace(seasonLabel))
            return seasonLabel.Trim();

        if (!seasonStartYear.HasValue)
            return "";

        return $"{seasonStartYear.Value}-{seasonStartYear.Value + 1}";
    }

    private static string GetSeasonDirectoryName(int? seasonStartYear, string seasonLabel)
    {
        var rawValue = !string.IsNullOrWhiteSpace(seasonLabel)
            ? seasonLabel
            : NormalizeSeasonLabel(seasonStartYear, seasonLabel);

        var invalidChars = Path.GetInvalidFileNameChars();
        var builder = new StringBuilder(rawValue.Length);

        foreach (var character in rawValue)
        {
            builder.Append(invalidChars.Contains(character) ? '_' : character);
        }

        return builder.ToString().Trim();
    }

    private static string GetTeamDirectoryName(string teamKey)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(teamKey.Trim()));
        return Convert.ToHexString(hash).ToLowerInvariant()[..16];
    }

    private static void DeleteStaleSeasonDirectories(string seasonsDir, ISet<string> expectedSeasonDirectories)
    {
        foreach (var existingDirectory in Directory.GetDirectories(seasonsDir, "*", SearchOption.TopDirectoryOnly))
        {
            if (expectedSeasonDirectories.Contains(Path.GetFileName(existingDirectory)))
                continue;

            Directory.Delete(existingDirectory, recursive: true);
        }

        foreach (var existingFile in Directory.GetFiles(seasonsDir, "*.json", SearchOption.TopDirectoryOnly))
        {
            if (string.Equals(Path.GetFileName(existingFile), "index.json", StringComparison.OrdinalIgnoreCase))
                continue;

            File.Delete(existingFile);
        }
    }

    private static void DeleteStaleTeamFiles(string teamDetailsDir, ISet<string> expectedTeamDirectories)
    {
        foreach (var existingDirectory in Directory.GetDirectories(teamDetailsDir, "*", SearchOption.TopDirectoryOnly))
        {
            if (expectedTeamDirectories.Contains(Path.GetFileName(existingDirectory)))
                continue;

            Directory.Delete(existingDirectory, recursive: true);
        }

        foreach (var existingFile in Directory.GetFiles(teamDetailsDir, "*.json", SearchOption.TopDirectoryOnly))
        {
            File.Delete(existingFile);
        }
    }

    private sealed class JsonOutput
    {
        private readonly string _webDataDir;
        private readonly string _webAnalysisJson;
        private readonly string _mirrorDataDir;
        private readonly string _mirrorAnalysisJson;
        private readonly SemaphoreSlim _gate = new(Math.Max(1, Environment.ProcessorCount) * 2);
        private readonly List<Task> _pendingWrites = [];

        public JsonOutput(AnalysisPaths paths)
        {
            _webDataDir = Path.GetFullPath(paths.WebDataDir);
            _webAnalysisJson = Path.GetFullPath(paths.WebAnalysisJson);
            _mirrorDataDir = Path.GetFullPath(paths.AnalysisDomainDir);
            _mirrorAnalysisJson = Path.GetFullPath(paths.AnalysisJson);
        }

        // Los payloads encolados no deben mutarse después: se serializan en segundo plano.
        public void Enqueue<T>(string webPath, T payload)
        {
            var targets = ResolveTargets(webPath);
            _pendingWrites.Add(Task.Run(async () =>
            {
                await _gate.WaitAsync();
                try
                {
                    var json = JsonSerializer.SerializeToUtf8Bytes(payload, JsonOptions);
                    foreach (var target in targets)
                    {
                        Directory.CreateDirectory(Path.GetDirectoryName(target)!);
                        await File.WriteAllBytesAsync(target, json);
                    }
                }
                finally
                {
                    _gate.Release();
                }
            }));
        }

        public void CreateDirectory(string webDirectory)
        {
            foreach (var target in ResolveTargets(webDirectory))
                Directory.CreateDirectory(target);
        }

        public Task FlushAsync() => Task.WhenAll(_pendingWrites);

        public IReadOnlyList<string> ResolveTargets(string webPath)
        {
            var fullPath = Path.GetFullPath(webPath);
            if (string.Equals(fullPath, _webAnalysisJson, StringComparison.Ordinal))
                return [fullPath, _mirrorAnalysisJson];

            var relativePath = Path.GetRelativePath(_webDataDir, fullPath);
            if (relativePath.StartsWith("..", StringComparison.Ordinal) || Path.IsPathRooted(relativePath))
                throw new InvalidOperationException($"Ruta fuera de {_webDataDir}: {fullPath}");

            return [fullPath, Path.Combine(_mirrorDataDir, relativePath)];
        }
    }

    private sealed record SeasonGrouping(int? SeasonStartYear, string SeasonLabel);

    private sealed record SeasonDataset(string DirectoryName, AnalysisResult Analysis);
}
