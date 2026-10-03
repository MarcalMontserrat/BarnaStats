using GenerateAnalisys.Services;

namespace GenerateAnalisys.Tests;

// Partido real de la temporada 2026-2027 (fase 23391) en el formato nuevo de msstats.
public sealed class MsStatsMatchFormatTests
{
    private const string MatchFilePrefix = "10908_8b28b862-4159-4ba4-b5ae-c86974853856";

    [Fact]
    public async Task ProcessAsync_converts_the_2026_msstats_format_into_the_existing_analysis()
    {
        using var sandbox = new TemporaryDirectory();
        var rawRoot = Path.Combine(sandbox.Path, "raw");
        var phaseRoot = Path.Combine(rawRoot, "phases", "23391");
        Directory.CreateDirectory(Path.Combine(phaseRoot, "stats"));
        Directory.CreateDirectory(Path.Combine(phaseRoot, "moves"));

        foreach (var relativePath in new[]
                 {
                     "phase_metadata.json",
                     "match_mapping.json",
                     Path.Combine("stats", $"{MatchFilePrefix}_stats.json"),
                     Path.Combine("moves", $"{MatchFilePrefix}_moves.json")
                 })
        {
            File.Copy(Path.Combine(FixturePaths.MsStats2026PhaseRoot, relativePath), Path.Combine(phaseRoot, relativePath));
        }

        var previousFlag = Environment.GetEnvironmentVariable("BARNASTATS_ENABLE_AI_MATCH_REPORTS");
        Environment.SetEnvironmentVariable("BARNASTATS_ENABLE_AI_MATCH_REPORTS", "false");

        try
        {
            var service = new MatchAnalysisService(
                new OpenAiMatchReportService(Path.Combine(sandbox.Path, "match-reports")));

            var result = await service.ProcessAsync(rawRoot);

            Assert.Equal(1, result.TotalMatches);
            Assert.Equal("2026-2027", result.SeasonLabel);

            var competitionMatch = Assert.Single(result.Competition.Matches);
            Assert.Equal(10908, competitionMatch.MatchWebId);
            Assert.Equal("ARENYS SHIPYARD ARENYS BÀSQUET", competitionMatch.HomeTeam);
            Assert.Equal("UE.MONTGAT", competitionMatch.AwayTeam);
            Assert.Equal(46, competitionMatch.HomeScore);
            Assert.Equal(52, competitionMatch.AwayScore);

            var homeTeam = Assert.Single(result.Teams, team => team.TeamName == "ARENYS SHIPYARD ARENYS BÀSQUET");
            var awayTeam = Assert.Single(result.Teams, team => team.TeamName == "UE.MONTGAT");
            Assert.Equal(89058, homeTeam.TeamIdExtern);
            Assert.Equal(89556, awayTeam.TeamIdExtern);
            Assert.Equal(12, homeTeam.MatchPlayers.Count);
            Assert.Equal(12, awayTeam.MatchPlayers.Count);

            var homeSummary = Assert.Single(homeTeam.MatchSummaries);
            Assert.Equal(new DateTime(2026, 9, 26, 16, 0, 0), homeSummary.MatchDate);
            Assert.Equal(46, homeSummary.TeamScore);
            Assert.Equal(52, homeSummary.RivalScore);
            Assert.Equal("L", homeSummary.Result);
            Assert.Equal(
                [(4, 14), (13, 5), (12, 25), (17, 8)],
                homeSummary.Insights.PeriodScores.Select(period => (period.TeamPoints, period.RivalPoints)).ToList());
            Assert.Equal("PAULA MARTÍN CABEZAS", homeSummary.Insights.FirstScorer);
            Assert.Equal("UE.MONTGAT", homeSummary.Insights.FirstScorerTeam);

            var player = Assert.Single(homeTeam.MatchPlayers, row => row.PlayerName == "MARINA ZURDO GONZALEZ");
            Assert.Equal(7, player.Points);
            Assert.Equal(2, player.TwoMade);
            Assert.Equal(1, player.ThreeMade);
            Assert.Equal(3, player.Fouls);
            Assert.Equal(14, player.Minutes);
            Assert.Equal(5, player.PlusMinus);
            // Sin valoración en la fuente: puntos - tiros fallados - faltas.
            Assert.Equal(4, player.Valuation);
            Assert.Equal("UUID:000fd03e-98d1-11e9-a2a5-0216824770c2", player.PlayerIdentityKey);
        }
        finally
        {
            Environment.SetEnvironmentVariable("BARNASTATS_ENABLE_AI_MATCH_REPORTS", previousFlag);
        }
    }

    [Fact]
    public async Task ProcessAsync_includes_matches_downloaded_with_the_app_account()
    {
        using var sandbox = new TemporaryDirectory();
        var rawRoot = Path.Combine(sandbox.Path, "raw");
        var phaseRoot = Path.Combine(rawRoot, "phases", "20856");
        Directory.CreateDirectory(Path.Combine(phaseRoot, "stats"));
        Directory.CreateDirectory(Path.Combine(phaseRoot, "moves"));

        const string prefix = "34951_68fcb7c91497f200013e2648";
        File.Copy(Path.Combine(FixturePaths.SinglePhaseRoot, "phase_metadata.json"), Path.Combine(phaseRoot, "phase_metadata.json"));
        File.Copy(Path.Combine(FixturePaths.SinglePhaseRoot, "stats", $"{prefix}_stats.json"), Path.Combine(phaseRoot, "stats", $"{prefix}_stats.json"));
        File.Copy(Path.Combine(FixturePaths.SinglePhaseRoot, "moves", $"{prefix}_moves.json"), Path.Combine(phaseRoot, "moves", $"{prefix}_moves.json"));
        await File.WriteAllTextAsync(
            Path.Combine(phaseRoot, "match_mapping.json"),
            """[{"matchWebId":34951,"uuidMatch":"68fcb7c91497f200013e2648","statsSource":"app"}]""");

        var previousFlag = Environment.GetEnvironmentVariable("BARNASTATS_ENABLE_AI_MATCH_REPORTS");
        Environment.SetEnvironmentVariable("BARNASTATS_ENABLE_AI_MATCH_REPORTS", "false");

        try
        {
            var service = new MatchAnalysisService(
                new OpenAiMatchReportService(Path.Combine(sandbox.Path, "match-reports")));

            var result = await service.ProcessAsync(rawRoot);

            Assert.Equal(1, result.TotalMatches);
        }
        finally
        {
            Environment.SetEnvironmentVariable("BARNASTATS_ENABLE_AI_MATCH_REPORTS", previousFlag);
        }
    }

    [Fact]
    public async Task ProcessAsync_keeps_matches_that_reuse_a_match_web_id_in_another_season()
    {
        using var sandbox = new TemporaryDirectory();
        var rawRoot = Path.Combine(sandbox.Path, "raw");
        const string legacyPrefix = "34951_68fcb7c91497f200013e2648";

        // Misma fase de la temporada pasada, y el partido nuevo de 2026-2027 con el mismo matchWebId (10908 -> 34951).
        var pastPhaseRoot = Path.Combine(rawRoot, "phases", "20856");
        Directory.CreateDirectory(Path.Combine(pastPhaseRoot, "stats"));
        Directory.CreateDirectory(Path.Combine(pastPhaseRoot, "moves"));
        File.Copy(Path.Combine(FixturePaths.SinglePhaseRoot, "phase_metadata.json"), Path.Combine(pastPhaseRoot, "phase_metadata.json"));
        File.Copy(Path.Combine(FixturePaths.SinglePhaseRoot, "stats", $"{legacyPrefix}_stats.json"), Path.Combine(pastPhaseRoot, "stats", $"{legacyPrefix}_stats.json"));
        File.Copy(Path.Combine(FixturePaths.SinglePhaseRoot, "moves", $"{legacyPrefix}_moves.json"), Path.Combine(pastPhaseRoot, "moves", $"{legacyPrefix}_moves.json"));

        var currentPhaseRoot = Path.Combine(rawRoot, "phases", "23391");
        Directory.CreateDirectory(Path.Combine(currentPhaseRoot, "stats"));
        Directory.CreateDirectory(Path.Combine(currentPhaseRoot, "moves"));
        File.Copy(Path.Combine(FixturePaths.MsStats2026PhaseRoot, "phase_metadata.json"), Path.Combine(currentPhaseRoot, "phase_metadata.json"));
        File.Copy(
            Path.Combine(FixturePaths.MsStats2026PhaseRoot, "stats", $"{MatchFilePrefix}_stats.json"),
            Path.Combine(currentPhaseRoot, "stats", $"{MatchFilePrefix.Replace("10908_", "34951_")}_stats.json"));
        File.Copy(
            Path.Combine(FixturePaths.MsStats2026PhaseRoot, "moves", $"{MatchFilePrefix}_moves.json"),
            Path.Combine(currentPhaseRoot, "moves", $"{MatchFilePrefix.Replace("10908_", "34951_")}_moves.json"));

        var previousFlag = Environment.GetEnvironmentVariable("BARNASTATS_ENABLE_AI_MATCH_REPORTS");
        Environment.SetEnvironmentVariable("BARNASTATS_ENABLE_AI_MATCH_REPORTS", "false");

        try
        {
            var service = new MatchAnalysisService(
                new OpenAiMatchReportService(Path.Combine(sandbox.Path, "match-reports")));

            var result = await service.ProcessAsync(rawRoot);

            Assert.Equal(2, result.TotalMatches);
            Assert.Equal(2, result.Competition.Matches.Count(match => match.MatchWebId == 34951));
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
