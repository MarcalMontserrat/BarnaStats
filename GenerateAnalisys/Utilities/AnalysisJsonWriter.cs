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
        await WriteDatasetAsync(
            analysis,
            paths.AnalysisJson,
            paths.CompetitionJson,
            paths.TeamDetailsDir);

        await WriteDatasetAsync(
            analysis,
            paths.WebAnalysisJson,
            paths.WebCompetitionJson,
            paths.WebTeamDetailsDir);
    }

    private static async Task WriteDatasetAsync(
        AnalysisResult analysis,
        string analysisIndexPath,
        string competitionPath,
        string teamDetailsDir)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(analysisIndexPath)!);
        Directory.CreateDirectory(Path.GetDirectoryName(competitionPath)!);
        Directory.CreateDirectory(teamDetailsDir);

        var index = BuildIndex(analysis);

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

    private static AnalysisIndex BuildIndex(AnalysisResult analysis)
    {
        return new AnalysisIndex
        {
            GeneratedAtUtc = analysis.GeneratedAtUtc,
            TotalMatches = analysis.TotalMatches,
            TotalTeams = analysis.Teams.Count,
            Teams = analysis.Teams
                .Select(team => new AnalysisIndexTeam
                {
                    TeamKey = team.TeamKey,
                    TeamIdIntern = team.TeamIdIntern,
                    TeamIdExtern = team.TeamIdExtern,
                    TeamName = team.TeamName,
                    MatchesPlayed = team.MatchesPlayed,
                    PlayersCount = team.PlayersCount,
                    MatchesFile = $"teams/{GetTeamDirectoryName(team.TeamKey)}/matches.json",
                    PlayersFile = $"teams/{GetTeamDirectoryName(team.TeamKey)}/players.json",
                    Phases = team.Phases
                })
                .OrderBy(team => team.TeamName, StringComparer.OrdinalIgnoreCase)
                .ToList()
        };
    }

    private static string GetTeamDirectoryName(string teamKey)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(teamKey.Trim()));
        return Convert.ToHexString(hash).ToLowerInvariant()[..16];
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
        var json = JsonSerializer.Serialize(payload, JsonOptions);
        await File.WriteAllTextAsync(path, json);
    }
}
