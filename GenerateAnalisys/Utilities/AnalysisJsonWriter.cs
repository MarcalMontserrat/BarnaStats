using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
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

        await WriteDatasetAsync(
            latestDataset,
            paths.AnalysisJson,
            paths.CompetitionJson,
            paths.TeamDetailsDir,
            teamFilesRelativeRoot: "teams");

        await WriteDatasetAsync(
            latestDataset,
            paths.WebAnalysisJson,
            paths.WebCompetitionJson,
            paths.WebTeamDetailsDir,
            teamFilesRelativeRoot: "teams");

        await WriteSeasonDatasetsAsync(
            paths.AnalysisSeasonsDir,
            paths.AnalysisSeasonIndexJson,
            analysis.GeneratedAtUtc,
            seasonDatasets);

        await WriteSeasonDatasetsAsync(
            paths.WebSeasonsDir,
            paths.WebSeasonIndexJson,
            analysis.GeneratedAtUtc,
            seasonDatasets);
    }

    private static async Task WriteSeasonDatasetsAsync(
        string seasonsDir,
        string seasonIndexPath,
        DateTime generatedAtUtc,
        IReadOnlyList<SeasonDataset> seasonDatasets)
    {
        Directory.CreateDirectory(seasonsDir);

        var expectedSeasonDirectories = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var seasonSummaries = new List<SeasonDatasetSummary>();

        foreach (var seasonDataset in seasonDatasets)
        {
            expectedSeasonDirectories.Add(seasonDataset.DirectoryName);

            var seasonDir = Path.Combine(seasonsDir, seasonDataset.DirectoryName);
            var analysisPath = Path.Combine(seasonDir, "analysis.json");
            var competitionPath = Path.Combine(seasonDir, "competition.json");
            var teamDetailsDir = Path.Combine(seasonDir, "teams");

            await WriteDatasetAsync(
                seasonDataset.Analysis,
                analysisPath,
                competitionPath,
                teamDetailsDir,
                teamFilesRelativeRoot: $"seasons/{seasonDataset.DirectoryName}/teams");

            seasonSummaries.Add(new SeasonDatasetSummary
            {
                SeasonStartYear = seasonDataset.Analysis.SeasonStartYear,
                SeasonLabel = seasonDataset.Analysis.SeasonLabel,
                TotalTeams = seasonDataset.Analysis.Teams.Count,
                TotalMatches = seasonDataset.Analysis.TotalMatches,
                AnalysisFile = $"seasons/{seasonDataset.DirectoryName}/analysis.json",
                CompetitionFile = $"seasons/{seasonDataset.DirectoryName}/competition.json"
            });
        }

        DeleteStaleSeasonDirectories(seasonsDir, expectedSeasonDirectories);

        var index = new SeasonDatasetIndex
        {
            GeneratedAtUtc = generatedAtUtc,
            DefaultSeasonLabel = seasonDatasets.FirstOrDefault()?.Analysis.SeasonLabel ?? "",
            Seasons = seasonSummaries
        };

        await WriteJsonAsync(seasonIndexPath, index);
    }

    private static async Task WriteDatasetAsync(
        AnalysisResult analysis,
        string analysisIndexPath,
        string competitionPath,
        string teamDetailsDir,
        string teamFilesRelativeRoot)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(analysisIndexPath)!);
        Directory.CreateDirectory(Path.GetDirectoryName(competitionPath)!);
        Directory.CreateDirectory(teamDetailsDir);

        var index = BuildIndex(analysis, teamFilesRelativeRoot);

        await WriteJsonAsync(analysisIndexPath, index);
        await WriteJsonAsync(competitionPath, analysis.Competition);

        var expectedTeamDirectories = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var team in analysis.Teams)
        {
            var teamDirectoryName = GetTeamDirectoryName(team.TeamKey);
            expectedTeamDirectories.Add(teamDirectoryName);

            var teamDirectory = Path.Combine(teamDetailsDir, teamDirectoryName);
            Directory.CreateDirectory(teamDirectory);

            await WriteJsonAsync(Path.Combine(teamDirectory, "matches.json"), team.MatchSummaries);
            await WriteJsonAsync(Path.Combine(teamDirectory, "players.json"), team.MatchPlayers);
        }

        DeleteStaleTeamFiles(teamDetailsDir, expectedTeamDirectories);
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

    private static async Task WriteJsonAsync<T>(string path, T payload)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var json = JsonSerializer.Serialize(payload, JsonOptions);
        await File.WriteAllTextAsync(path, json);
    }

    private sealed record SeasonGrouping(int? SeasonStartYear, string SeasonLabel);

    private sealed record SeasonDataset(string DirectoryName, AnalysisResult Analysis);
}
