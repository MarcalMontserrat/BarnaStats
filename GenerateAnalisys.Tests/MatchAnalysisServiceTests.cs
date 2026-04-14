using GenerateAnalisys.Services;

namespace GenerateAnalisys.Tests;

public sealed class MatchAnalysisServiceTests
{
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
