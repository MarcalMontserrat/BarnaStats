using GenerateAnalisys.Services;
using GenerateAnalisys.Models;
using System.Text.Json;

namespace GenerateAnalisys.Tests;

public sealed class MatchAnalysisServiceTests
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true
    };

    [Fact]
    public async Task ProcessAsync_builds_a_coherent_analysis_from_a_real_fixture()
    {
        using var sandbox = new TemporaryDirectory();
        var rawRoot = Path.Combine(sandbox.Path, "raw");
        var phaseRoot = Path.Combine(rawRoot, "phases", "20856");
        var statsDir = Path.Combine(phaseRoot, "stats");
        var movesDir = Path.Combine(phaseRoot, "moves");

        Directory.CreateDirectory(statsDir);
        Directory.CreateDirectory(movesDir);

        File.Copy(
            Path.Combine(FixturePaths.SinglePhaseRoot, "phase_metadata.json"),
            Path.Combine(phaseRoot, "phase_metadata.json"));
        File.Copy(
            Path.Combine(FixturePaths.SinglePhaseRoot, "stats", "34951_68fcb7c91497f200013e2648_stats.json"),
            Path.Combine(statsDir, "34951_68fcb7c91497f200013e2648_stats.json"));
        File.Copy(
            Path.Combine(FixturePaths.SinglePhaseRoot, "moves", "34951_68fcb7c91497f200013e2648_moves.json"),
            Path.Combine(movesDir, "34951_68fcb7c91497f200013e2648_moves.json"));

        var previousFlag = Environment.GetEnvironmentVariable("BARNASTATS_ENABLE_AI_MATCH_REPORTS");
        Environment.SetEnvironmentVariable("BARNASTATS_ENABLE_AI_MATCH_REPORTS", "false");

        try
        {
            var service = new MatchAnalysisService(
                new OpenAiMatchReportService(Path.Combine(sandbox.Path, "match-reports")));

            var result = await service.ProcessAsync(rawRoot);

            Assert.Equal(1, result.TotalMatches);
            Assert.Equal(2, result.Teams.Count);
            Assert.Equal(1, result.Competition.TotalMatches);
            Assert.Equal(2, result.Competition.TotalTeams);

            var competitionPhase = Assert.Single(result.Competition.Phases);
            Assert.Equal(1, competitionPhase.PhaseNumber);
            Assert.Equal(20856, competitionPhase.SourcePhaseId);
            Assert.Equal("Primera Fase", competitionPhase.PhaseName);
            Assert.Equal("Nivell B/c", competitionPhase.LevelName);
            Assert.Equal("04", competitionPhase.GroupCode);

            var competitionMatch = Assert.Single(result.Competition.Matches);
            Assert.Equal(34951, competitionMatch.MatchWebId);
            Assert.Equal("BASQUET ATENEU MONTSERRAT GROC", competitionMatch.HomeTeam);
            Assert.Equal("CB MANYANET LES CORTS GROC", competitionMatch.AwayTeam);
            Assert.Equal(12, competitionMatch.HomeScore);
            Assert.Equal(18, competitionMatch.AwayScore);

            var homeTeam = Assert.Single(result.Teams, team => team.TeamName == "BASQUET ATENEU MONTSERRAT GROC");
            var awayTeam = Assert.Single(result.Teams, team => team.TeamName == "CB MANYANET LES CORTS GROC");

            Assert.Equal(1, homeTeam.MatchesPlayed);
            Assert.Equal(10, homeTeam.PlayersCount);
            Assert.Equal(1, awayTeam.MatchesPlayed);
            Assert.Equal(12, awayTeam.PlayersCount);

            var homeSummary = Assert.Single(homeTeam.MatchSummaries);
            Assert.Equal(1, homeSummary.PhaseNumber);
            Assert.Equal(1, homeSummary.PhaseRound);
            Assert.Equal(1, homeSummary.RoundNumber);
            Assert.Equal("Primera Fase", homeSummary.PhaseName);
            Assert.Equal("Nivell B/c", homeSummary.LevelName);
            Assert.Equal("04", homeSummary.GroupCode);
            Assert.Equal(12, homeSummary.TeamScore);
            Assert.Equal(18, homeSummary.RivalScore);
            Assert.Equal("L", homeSummary.Result);
            Assert.Equal(string.Empty, homeSummary.MatchReport);

            Assert.Equal(10, homeTeam.MatchPlayers.Count);
            Assert.Equal(12, awayTeam.MatchPlayers.Count);
            Assert.NotEmpty(homeTeam.Ranking);
            Assert.NotEmpty(homeTeam.Evolution);
            Assert.Contains(homeTeam.MatchPlayers, row => row.PlayerName == "LAIA HOSPITAL AUGE");
        }
        finally
        {
            Environment.SetEnvironmentVariable("BARNASTATS_ENABLE_AI_MATCH_REPORTS", previousFlag);
        }
    }

    [Fact]
    public async Task ProcessAsync_keeps_same_team_name_separated_across_categories()
    {
        using var sandbox = new TemporaryDirectory();
        var rawRoot = Path.Combine(sandbox.Path, "raw");
        var firstPhaseRoot = Path.Combine(rawRoot, "phases", "20856");
        var secondPhaseRoot = Path.Combine(rawRoot, "phases", "20857");
        var firstStatsDir = Path.Combine(firstPhaseRoot, "stats");
        var firstMovesDir = Path.Combine(firstPhaseRoot, "moves");
        var secondStatsDir = Path.Combine(secondPhaseRoot, "stats");
        var secondMovesDir = Path.Combine(secondPhaseRoot, "moves");

        Directory.CreateDirectory(firstStatsDir);
        Directory.CreateDirectory(firstMovesDir);
        Directory.CreateDirectory(secondStatsDir);
        Directory.CreateDirectory(secondMovesDir);

        var fixtureMetadataPath = Path.Combine(FixturePaths.SinglePhaseRoot, "phase_metadata.json");
        var fixtureStatsPath = Path.Combine(FixturePaths.SinglePhaseRoot, "stats", "34951_68fcb7c91497f200013e2648_stats.json");
        var fixtureMovesPath = Path.Combine(FixturePaths.SinglePhaseRoot, "moves", "34951_68fcb7c91497f200013e2648_moves.json");

        File.Copy(fixtureMetadataPath, Path.Combine(firstPhaseRoot, "phase_metadata.json"));
        File.Copy(fixtureStatsPath, Path.Combine(firstStatsDir, "34951_68fcb7c91497f200013e2648_stats.json"));
        File.Copy(fixtureMovesPath, Path.Combine(firstMovesDir, "34951_68fcb7c91497f200013e2648_moves.json"));

        var secondMetadata = JsonSerializer.Deserialize<PhaseMetadataFile>(File.ReadAllText(fixtureMetadataPath), JsonOptions)!;
        secondMetadata.PhaseId = 20857;
        secondMetadata.CategoryName = "1a. Territorial Sènior Femení";
        secondMetadata.PhaseName = "Fase regular";
        secondMetadata.LevelName = "";
        secondMetadata.LevelCode = "";
        secondMetadata.GroupCode = "02";

        await File.WriteAllTextAsync(
            Path.Combine(secondPhaseRoot, "phase_metadata.json"),
            JsonSerializer.Serialize(secondMetadata, JsonOptions));
        File.Copy(fixtureStatsPath, Path.Combine(secondStatsDir, "44951_68fcb7c91497f200013e2648_stats.json"));
        File.Copy(fixtureMovesPath, Path.Combine(secondMovesDir, "44951_68fcb7c91497f200013e2648_moves.json"));

        var previousFlag = Environment.GetEnvironmentVariable("BARNASTATS_ENABLE_AI_MATCH_REPORTS");
        Environment.SetEnvironmentVariable("BARNASTATS_ENABLE_AI_MATCH_REPORTS", "false");

        try
        {
            var service = new MatchAnalysisService(
                new OpenAiMatchReportService(Path.Combine(sandbox.Path, "match-reports")));

            var result = await service.ProcessAsync(rawRoot);

            Assert.Equal(2, result.TotalMatches);
            Assert.Equal(4, result.Teams.Count);

            var duplicatedByName = result.Teams
                .Where(team => team.TeamName == "BASQUET ATENEU MONTSERRAT GROC")
                .ToList();

            Assert.Equal(2, duplicatedByName.Count);
            Assert.Equal(2, duplicatedByName.Select(team => team.TeamKey).Distinct().Count());
            Assert.Contains(duplicatedByName, team => team.Phases.All(phase => phase.CategoryName == "C.t. Pre-mini Femení 1r. Any"));
            Assert.Contains(duplicatedByName, team => team.Phases.All(phase => phase.CategoryName == "1a. Territorial Sènior Femení"));
        }
        finally
        {
            Environment.SetEnvironmentVariable("BARNASTATS_ENABLE_AI_MATCH_REPORTS", previousFlag);
        }
    }

    [Fact]
    public async Task ProcessAsync_merges_same_team_when_name_changes_but_external_id_stays_the_same()
    {
        using var sandbox = new TemporaryDirectory();
        var rawRoot = Path.Combine(sandbox.Path, "raw");
        var phaseRoot = Path.Combine(rawRoot, "phases", "20856");
        var statsDir = Path.Combine(phaseRoot, "stats");
        var movesDir = Path.Combine(phaseRoot, "moves");

        Directory.CreateDirectory(statsDir);
        Directory.CreateDirectory(movesDir);

        File.Copy(
            Path.Combine(FixturePaths.SinglePhaseRoot, "phase_metadata.json"),
            Path.Combine(phaseRoot, "phase_metadata.json"));

        var fixtureStatsPath = Path.Combine(FixturePaths.SinglePhaseRoot, "stats", "34951_68fcb7c91497f200013e2648_stats.json");
        var fixtureMovesPath = Path.Combine(FixturePaths.SinglePhaseRoot, "moves", "34951_68fcb7c91497f200013e2648_moves.json");

        var firstMatch = JsonSerializer.Deserialize<StatsRoot>(File.ReadAllText(fixtureStatsPath), JsonOptions)!;
        var secondMatch = JsonSerializer.Deserialize<StatsRoot>(File.ReadAllText(fixtureStatsPath), JsonOptions)!;

        secondMatch.IdMatchIntern = 44951;
        secondMatch.IdMatchExtern = 144951;
        secondMatch.Time = "2025-10-04T10:00:00+02:00";
        secondMatch.LocalId = 569264;
        secondMatch.Teams[0].TeamIdIntern = 569264;
        secondMatch.Teams[0].Name = "BASQUET ATENEU MONTSERRAT GROC - PATROCINI";

        await File.WriteAllTextAsync(
            Path.Combine(statsDir, "34951_68fcb7c91497f200013e2648_stats.json"),
            JsonSerializer.Serialize(firstMatch, JsonOptions));
        await File.WriteAllTextAsync(
            Path.Combine(statsDir, "44951_68fcb7c91497f200013e2648_stats.json"),
            JsonSerializer.Serialize(secondMatch, JsonOptions));

        File.Copy(
            fixtureMovesPath,
            Path.Combine(movesDir, "34951_68fcb7c91497f200013e2648_moves.json"));
        File.Copy(
            fixtureMovesPath,
            Path.Combine(movesDir, "44951_68fcb7c91497f200013e2648_moves.json"));

        var previousFlag = Environment.GetEnvironmentVariable("BARNASTATS_ENABLE_AI_MATCH_REPORTS");
        Environment.SetEnvironmentVariable("BARNASTATS_ENABLE_AI_MATCH_REPORTS", "false");

        try
        {
            var service = new MatchAnalysisService(
                new OpenAiMatchReportService(Path.Combine(sandbox.Path, "match-reports")));

            var result = await service.ProcessAsync(rawRoot);

            Assert.Equal(2, result.TotalMatches);
            Assert.Equal(2, result.Teams.Count);

            var mergedTeam = Assert.Single(
                result.Teams,
                team => team.TeamIdExtern == 82648);

            Assert.Equal(2, mergedTeam.MatchesPlayed);
            Assert.Equal("BASQUET ATENEU MONTSERRAT GROC - PATROCINI", mergedTeam.TeamName);
            Assert.Single(result.Competition.Matches.Select(match => match.HomeTeamKey).Distinct());
        }
        finally
        {
            Environment.SetEnvironmentVariable("BARNASTATS_ENABLE_AI_MATCH_REPORTS", previousFlag);
        }
    }

    [Fact]
    public async Task ProcessAsync_uses_the_most_frequent_shirt_number_for_the_season_total()
    {
        using var sandbox = new TemporaryDirectory();
        var rawRoot = Path.Combine(sandbox.Path, "raw");
        var phaseRoot = Path.Combine(rawRoot, "phases", "20856");
        var statsDir = Path.Combine(phaseRoot, "stats");
        var movesDir = Path.Combine(phaseRoot, "moves");

        Directory.CreateDirectory(statsDir);
        Directory.CreateDirectory(movesDir);

        File.Copy(
            Path.Combine(FixturePaths.SinglePhaseRoot, "phase_metadata.json"),
            Path.Combine(phaseRoot, "phase_metadata.json"));

        var fixtureStatsPath = Path.Combine(FixturePaths.SinglePhaseRoot, "stats", "34951_68fcb7c91497f200013e2648_stats.json");
        var fixtureMovesPath = Path.Combine(FixturePaths.SinglePhaseRoot, "moves", "34951_68fcb7c91497f200013e2648_moves.json");

        var firstMatch = JsonSerializer.Deserialize<StatsRoot>(File.ReadAllText(fixtureStatsPath), JsonOptions)!;
        var secondMatch = JsonSerializer.Deserialize<StatsRoot>(File.ReadAllText(fixtureStatsPath), JsonOptions)!;
        var thirdMatch = JsonSerializer.Deserialize<StatsRoot>(File.ReadAllText(fixtureStatsPath), JsonOptions)!;

        secondMatch.IdMatchIntern = 44951;
        secondMatch.IdMatchExtern = 144951;
        secondMatch.Time = "2025-09-28T10:00:00+02:00";

        thirdMatch.IdMatchIntern = 54951;
        thirdMatch.IdMatchExtern = 154951;
        thirdMatch.Time = "2025-10-05T10:00:00+02:00";

        const string trackedPlayerName = "LAIA HOSPITAL AUGE";
        var trackedPlayerFirst = firstMatch.Teams
            .SelectMany(team => team.Players ?? [])
            .First(player => player.Name == trackedPlayerName);
        var trackedPlayerSecond = secondMatch.Teams
            .SelectMany(team => team.Players ?? [])
            .First(player => player.Name == trackedPlayerName);
        var trackedPlayerThird = thirdMatch.Teams
            .SelectMany(team => team.Players ?? [])
            .First(player => player.Name == trackedPlayerName);

        var dominantDorsal = trackedPlayerFirst.Dorsal ?? "7";
        var alternateDorsal = dominantDorsal == "99" ? "9" : "99";

        trackedPlayerFirst.Dorsal = dominantDorsal;
        trackedPlayerSecond.Dorsal = dominantDorsal;
        trackedPlayerThird.Dorsal = alternateDorsal;

        await File.WriteAllTextAsync(
            Path.Combine(statsDir, "34951_68fcb7c91497f200013e2648_stats.json"),
            JsonSerializer.Serialize(firstMatch, JsonOptions));
        await File.WriteAllTextAsync(
            Path.Combine(statsDir, "44951_68fcb7c91497f200013e2648_stats.json"),
            JsonSerializer.Serialize(secondMatch, JsonOptions));
        await File.WriteAllTextAsync(
            Path.Combine(statsDir, "54951_68fcb7c91497f200013e2648_stats.json"),
            JsonSerializer.Serialize(thirdMatch, JsonOptions));

        File.Copy(fixtureMovesPath, Path.Combine(movesDir, "34951_68fcb7c91497f200013e2648_moves.json"));
        File.Copy(fixtureMovesPath, Path.Combine(movesDir, "44951_68fcb7c91497f200013e2648_moves.json"));
        File.Copy(fixtureMovesPath, Path.Combine(movesDir, "54951_68fcb7c91497f200013e2648_moves.json"));

        var previousFlag = Environment.GetEnvironmentVariable("BARNASTATS_ENABLE_AI_MATCH_REPORTS");
        Environment.SetEnvironmentVariable("BARNASTATS_ENABLE_AI_MATCH_REPORTS", "false");

        try
        {
            var service = new MatchAnalysisService(
                new OpenAiMatchReportService(Path.Combine(sandbox.Path, "match-reports")));

            var result = await service.ProcessAsync(rawRoot);

            var homeTeam = Assert.Single(result.Teams, team => team.TeamName == "BASQUET ATENEU MONTSERRAT GROC");
            var playerSeasonTotal = Assert.Single(homeTeam.SeasonTotals, player => player.PlayerName == trackedPlayerName);
            Assert.Equal(dominantDorsal, playerSeasonTotal.ShirtNumber);

            var playerLeader = Assert.Single(result.Competition.PlayerLeaders, player =>
                player.TeamKey == homeTeam.TeamKey && player.PlayerName == trackedPlayerName);
            Assert.Equal(dominantDorsal, playerLeader.ShirtNumber);
        }
        finally
        {
            Environment.SetEnvironmentVariable("BARNASTATS_ENABLE_AI_MATCH_REPORTS", previousFlag);
        }
    }

    private sealed class TemporaryDirectory : IDisposable
    {
        public TemporaryDirectory()
        {
            Path = System.IO.Path.Combine(System.IO.Path.GetTempPath(), $"barna-tests-{Guid.NewGuid():N}");
            Directory.CreateDirectory(Path);
        }

        public string Path { get; }

        public void Dispose()
        {
            if (Directory.Exists(Path))
            {
                Directory.Delete(Path, true);
            }
        }
    }
}
