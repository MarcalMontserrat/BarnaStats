using GenerateAnalisys.Models;

namespace GenerateAnalisys.Services;

internal static class CompetitionAnalysisBuilder
{
    internal static CompetitionAnalysis BuildCompetitionAnalysis(IReadOnlyCollection<TeamAnalysis> teamAnalyses)
    {
        var totalValuationByTeam = teamAnalyses
            .ToDictionary(
                team => team.TeamKey,
                team => team.SeasonTotals.Sum(player => player.Valuation),
                StringComparer.Ordinal);

        var competitionTeams = teamAnalyses
            .Select(team => new CompetitionTeamOverview
            {
                TeamKey = team.TeamKey,
                TeamIdIntern = team.TeamIdIntern,
                TeamIdExtern = team.TeamIdExtern,
                TeamName = team.TeamName,
                MatchesPlayed = team.MatchesPlayed,
                PlayersCount = team.PlayersCount,
                TotalValuation = totalValuationByTeam.GetValueOrDefault(team.TeamKey)
            })
            .OrderBy(team => team.TeamName, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var competitionMatches = BuildCompetitionMatches(teamAnalyses);
        var competitionPhases = competitionMatches
            .GroupBy(match => new
            {
                match.SeasonStartYear,
                match.SeasonLabel,
                match.PhaseNumber,
                match.SourcePhaseId,
                match.CategoryName,
                match.PhaseName,
                match.LevelName,
                match.LevelCode,
                match.GroupCode
            })
            .OrderBy(group => group.Key.PhaseNumber)
            .ThenBy(group => group.Key.SourcePhaseId ?? int.MaxValue)
            .Select(group => new CompetitionPhase
            {
                SeasonStartYear = group.Key.SeasonStartYear,
                SeasonLabel = group.Key.SeasonLabel,
                PhaseNumber = group.Key.PhaseNumber,
                SourcePhaseId = group.Key.SourcePhaseId,
                CategoryName = group.Key.CategoryName,
                PhaseName = group.Key.PhaseName,
                LevelName = group.Key.LevelName,
                LevelCode = group.Key.LevelCode,
                GroupCode = group.Key.GroupCode,
                MatchesCount = group.Count()
            })
            .ToList();

        return new CompetitionAnalysis
        {
            SeasonStartYear = ResolveSingleSeasonStartYear(teamAnalyses),
            SeasonLabel = ResolveSingleSeasonLabel(teamAnalyses),
            TotalTeams = competitionTeams.Count,
            TotalMatches = competitionMatches.Count,
            Phases = competitionPhases,
            Teams = competitionTeams,
            Matches = competitionMatches,
            StandingsByPhase = BuildCompetitionStandings(competitionMatches),
            PlayerLeaders = BuildCompetitionPlayerLeaders(teamAnalyses)
        };
    }

    private static List<CompetitionMatch> BuildCompetitionMatches(IReadOnlyCollection<TeamAnalysis> teamAnalyses)
    {
        return teamAnalyses
            .SelectMany(team => team.MatchSummaries)
            .GroupBy(summary => summary.MatchWebId)
            .Select(group =>
            {
                var homePerspective = group.FirstOrDefault(summary => summary.IsHome) ?? group.First();
                var homeScore = homePerspective.IsHome ? homePerspective.TeamScore : homePerspective.RivalScore;
                var awayScore = homePerspective.IsHome ? homePerspective.RivalScore : homePerspective.TeamScore;

                return new CompetitionMatch
                {
                    SeasonStartYear = homePerspective.SeasonStartYear,
                    SeasonLabel = homePerspective.SeasonLabel,
                    MatchWebId = homePerspective.MatchWebId,
                    MatchInternId = homePerspective.MatchInternId,
                    MatchExternId = homePerspective.MatchExternId,
                    MatchDate = homePerspective.MatchDate,
                    PhaseNumber = homePerspective.PhaseNumber,
                    SourcePhaseId = homePerspective.SourcePhaseId,
                    CategoryName = homePerspective.CategoryName,
                    PhaseName = homePerspective.PhaseName,
                    LevelName = homePerspective.LevelName,
                    LevelCode = homePerspective.LevelCode,
                    GroupCode = homePerspective.GroupCode,
                    HomeTeamKey = homePerspective.HomeTeamKey,
                    HomeTeam = homePerspective.HomeTeam,
                    HomeScore = homeScore,
                    AwayTeamKey = homePerspective.AwayTeamKey,
                    AwayTeam = homePerspective.AwayTeam,
                    AwayScore = awayScore,
                    TopScorer = homePerspective.TopScorer,
                    TopScorerTeam = homePerspective.TopScorerTeam,
                    TopScorerPoints = homePerspective.TopScorerPoints
                };
            })
            .OrderBy(match => match.MatchDate ?? DateTime.MaxValue)
            .ThenBy(match => match.MatchWebId)
            .ToList();
    }

    private static List<CompetitionPhaseStandings> BuildCompetitionStandings(IReadOnlyCollection<CompetitionMatch> matches)
    {
        return matches
            .GroupBy(match => new
            {
                match.SeasonStartYear,
                match.SeasonLabel,
                match.PhaseNumber
            })
            .OrderBy(group => group.Key.SeasonStartYear ?? int.MaxValue)
            .ThenBy(group => group.Key.PhaseNumber)
            .Select(group => new CompetitionPhaseStandings
            {
                SeasonStartYear = group.Key.SeasonStartYear,
                SeasonLabel = group.Key.SeasonLabel,
                PhaseNumber = group.Key.PhaseNumber,
                Rows = BuildCompetitionStandingRows(group)
            })
            .ToList();
    }

    private static List<CompetitionStandingRow> BuildCompetitionStandingRows(IEnumerable<CompetitionMatch> matches)
    {
        var rowsByTeam = new Dictionary<string, MutableStandingRow>(StringComparer.Ordinal);

        foreach (var match in matches)
        {
            var home = GetOrCreateStandingRow(rowsByTeam, match.HomeTeamKey, match.HomeTeam);
            var away = GetOrCreateStandingRow(rowsByTeam, match.AwayTeamKey, match.AwayTeam);

            home.Played += 1;
            home.PointsFor += match.HomeScore;
            home.PointsAgainst += match.AwayScore;

            away.Played += 1;
            away.PointsFor += match.AwayScore;
            away.PointsAgainst += match.HomeScore;

            if (match.HomeScore > match.AwayScore)
            {
                home.Wins += 1;
                away.Losses += 1;
            }
            else if (match.HomeScore < match.AwayScore)
            {
                away.Wins += 1;
                home.Losses += 1;
            }
            else
            {
                home.Ties += 1;
                away.Ties += 1;
            }
        }

        return rowsByTeam.Values
            .OrderByDescending(row => row.Wins)
            .ThenBy(row => row.Losses)
            .ThenByDescending(row => row.PointDiff)
            .ThenByDescending(row => row.PointsFor)
            .ThenBy(row => row.TeamName, StringComparer.OrdinalIgnoreCase)
            .Select((row, index) => new CompetitionStandingRow
            {
                Position = index + 1,
                TeamKey = row.TeamKey,
                TeamName = row.TeamName,
                Played = row.Played,
                Wins = row.Wins,
                Losses = row.Losses,
                Ties = row.Ties,
                PointsFor = row.PointsFor,
                PointsAgainst = row.PointsAgainst,
                PointDiff = row.PointDiff
            })
            .ToList();
    }

    private static MutableStandingRow GetOrCreateStandingRow(
        IDictionary<string, MutableStandingRow> rowsByTeam,
        string teamKey,
        string teamName)
    {
        if (!rowsByTeam.TryGetValue(teamKey, out var row))
        {
            row = new MutableStandingRow(teamKey, teamName);
            rowsByTeam[teamKey] = row;
        }

        return row;
    }

    private static List<CompetitionPlayerLeader> BuildCompetitionPlayerLeaders(IReadOnlyCollection<TeamAnalysis> teamAnalyses)
    {
        return teamAnalyses
            .SelectMany(team => team.SeasonTotals)
            .Select(player => new CompetitionPlayerLeader
            {
                Key = $"{player.TeamKey}:{player.PlayerIdentityKey}:{player.ShirtNumber}",
                TeamKey = player.TeamKey,
                TeamIdIntern = player.TeamIdIntern,
                TeamIdExtern = player.TeamIdExtern,
                TeamName = player.TeamName,
                SeasonStartYear = player.SeasonStartYear,
                SeasonLabel = player.SeasonLabel,
                PlayerUuid = player.PlayerUuid,
                PlayerActorId = player.PlayerActorId,
                PlayerIdentityKey = player.PlayerIdentityKey,
                PlayerName = player.PlayerName,
                ShirtNumber = player.ShirtNumber,
                Games = player.Games,
                Minutes = player.Minutes,
                Points = player.Points,
                AvgPoints = player.Games > 0 ? (double)player.Points / player.Games : 0,
                Valuation = player.Valuation,
                AvgValuation = player.Games > 0 ? (double)player.Valuation / player.Games : 0,
                Fouls = player.Fouls,
                AvgFouls = player.Games > 0 ? (double)player.Fouls / player.Games : 0
            })
            .OrderByDescending(player => player.Points)
            .ThenBy(player => player.PlayerName, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    internal static int? ResolveSingleSeasonStartYear(IEnumerable<TeamAnalysis> teamAnalyses)
    {
        var seasons = teamAnalyses
            .Select(team => team.SeasonStartYear)
            .Where(value => value.HasValue)
            .Select(value => value!.Value)
            .Distinct()
            .Take(2)
            .ToList();

        return seasons.Count == 1 ? seasons[0] : null;
    }

    internal static string ResolveSingleSeasonLabel(IEnumerable<TeamAnalysis> teamAnalyses)
    {
        var labels = teamAnalyses
            .Select(team => team.SeasonLabel)
            .Where(label => !string.IsNullOrWhiteSpace(label))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(2)
            .ToList();

        return labels.Count == 1 ? labels[0] : "";
    }

    private sealed class MutableStandingRow
    {
        public MutableStandingRow(string teamKey, string teamName)
        {
            TeamKey = teamKey;
            TeamName = teamName;
        }

        public string TeamKey { get; }
        public string TeamName { get; }
        public int Played { get; set; }
        public int Wins { get; set; }
        public int Losses { get; set; }
        public int Ties { get; set; }
        public int PointsFor { get; set; }
        public int PointsAgainst { get; set; }
        public int PointDiff => PointsFor - PointsAgainst;
    }
}
