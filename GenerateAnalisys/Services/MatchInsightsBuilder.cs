using GenerateAnalisys.Models;

namespace GenerateAnalisys.Services;

internal static class MatchInsightsBuilder
{
    internal static MatchInsights BuildMatchInsights(
        StatsRoot match,
        TeamInfo team,
        bool isHome,
        IReadOnlyList<MoveEvent> moves)
    {
        var scoringEvents = BuildScoringEvents(match);
        var periodScores = BuildPeriodScores(match, scoringEvents, isHome);
        var bestPeriod = periodScores
            .OrderByDescending(period => period.Diff)
            .ThenBy(period => period.PeriodNumber)
            .FirstOrDefault();
        var worstPeriod = periodScores
            .OrderBy(period => period.Diff)
            .ThenBy(period => period.PeriodNumber)
            .FirstOrDefault();

        var leadChanges = 0;
        var ties = 0;
        var maxLead = 0;
        var maxDeficit = 0;
        var bestRun = 0;
        var rivalBestRun = 0;
        var currentRun = 0;
        var rivalCurrentRun = 0;

        var previousDiff = 0;
        foreach (var scoringEvent in scoringEvents)
        {
            var teamDelta = isHome ? scoringEvent.DeltaLocal : scoringEvent.DeltaVisit;
            var rivalDelta = isHome ? scoringEvent.DeltaVisit : scoringEvent.DeltaLocal;
            var teamDiff = isHome
                ? scoringEvent.LocalScore - scoringEvent.VisitScore
                : scoringEvent.VisitScore - scoringEvent.LocalScore;

            maxLead = Math.Max(maxLead, teamDiff);
            maxDeficit = Math.Max(maxDeficit, -teamDiff);

            var previousSign = Math.Sign(previousDiff);
            var currentSign = Math.Sign(teamDiff);

            if (currentSign == 0 && previousSign != 0)
            {
                ties += 1;
            }
            else if (previousSign != 0 && currentSign != 0 && previousSign != currentSign)
            {
                leadChanges += 1;
            }

            if (teamDelta > 0)
            {
                currentRun += teamDelta;
                rivalCurrentRun = 0;
                bestRun = Math.Max(bestRun, currentRun);
            }

            if (rivalDelta > 0)
            {
                rivalCurrentRun += rivalDelta;
                currentRun = 0;
                rivalBestRun = Math.Max(rivalBestRun, rivalCurrentRun);
            }

            previousDiff = teamDiff;
        }

        var scoringMoves = moves
            .Where(IsScoringMove)
            .ToList();
        var firstScorer = scoringMoves.FirstOrDefault();
        var lastScorer = scoringMoves.LastOrDefault();
        var teamFirstScorer = scoringMoves.FirstOrDefault(move => move.IdTeam == team.TeamIdIntern);
        var teamLastScorer = scoringMoves.LastOrDefault(move => move.IdTeam == team.TeamIdIntern);

        return new MatchInsights
        {
            LeadChanges = leadChanges,
            Ties = ties,
            MaxLead = maxLead,
            MaxDeficit = maxDeficit,
            BestRun = bestRun,
            RivalBestRun = rivalBestRun,
            ClosingRun = currentRun,
            RivalClosingRun = rivalCurrentRun,
            FirstScorer = firstScorer?.ActorName ?? "",
            FirstScorerTeam = ResolveMoveTeamName(match, firstScorer?.IdTeam),
            LastScorer = lastScorer?.ActorName ?? "",
            LastScorerTeam = ResolveMoveTeamName(match, lastScorer?.IdTeam),
            TeamFirstScorer = teamFirstScorer?.ActorName ?? "",
            TeamLastScorer = teamLastScorer?.ActorName ?? "",
            BestPeriodLabel = bestPeriod?.Label ?? "",
            BestPeriodDiff = bestPeriod?.Diff ?? 0,
            WorstPeriodLabel = worstPeriod?.Label ?? "",
            WorstPeriodDiff = worstPeriod?.Diff ?? 0,
            PeriodScores = periodScores
        };
    }

    private static List<MatchPeriodScore> BuildPeriodScores(
        StatsRoot match,
        IReadOnlyList<ScoringEvent> scoringEvents,
        bool isHome)
    {
        var periodPointsByPeriod = scoringEvents
            .GroupBy(scoringEvent => scoringEvent.Period)
            .ToDictionary(
                group => group.Key,
                group =>
                {
                    var localPoints = group.Sum(item => item.DeltaLocal);
                    var visitPoints = group.Sum(item => item.DeltaVisit);
                    return (LocalPoints: localPoints, VisitPoints: visitPoints);
                });

        return match.Score
            .Select(point => point.Period)
            .Where(period => period > 0)
            .Distinct()
            .OrderBy(period => period)
            .Select(period =>
            {
                if (!periodPointsByPeriod.TryGetValue(period, out var points))
                {
                    points = (LocalPoints: 0, VisitPoints: 0);
                }
                var localPoints = points.LocalPoints;
                var visitPoints = points.VisitPoints;
                var teamPoints = isHome ? localPoints : visitPoints;
                var rivalPoints = isHome ? visitPoints : localPoints;

                return new MatchPeriodScore
                {
                    PeriodNumber = period,
                    Label = $"Parcial {period}",
                    TeamPoints = teamPoints,
                    RivalPoints = rivalPoints,
                    Diff = teamPoints - rivalPoints
                };
            })
            .ToList();
    }

    private static List<ScoringEvent> BuildScoringEvents(StatsRoot match)
    {
        var scoringEvents = new List<ScoringEvent>();

        if (match.Score is null || match.Score.Count < 2)
            return scoringEvents;

        var previousPoint = match.Score[0];

        foreach (var point in match.Score.Skip(1))
        {
            var deltaLocal = Math.Max(0, point.Local - previousPoint.Local);
            var deltaVisit = Math.Max(0, point.Visit - previousPoint.Visit);

            if (deltaLocal == 0 && deltaVisit == 0)
            {
                previousPoint = point;
                continue;
            }

            scoringEvents.Add(new ScoringEvent(
                point.Period,
                point.MinuteAbsolute,
                point.Local,
                point.Visit,
                deltaLocal,
                deltaVisit));

            previousPoint = point;
        }

        return scoringEvents;
    }

    private static bool IsScoringMove(MoveEvent move)
    {
        return move.IdTeam > 0
               && !string.IsNullOrWhiteSpace(move.ActorName)
               && !string.IsNullOrWhiteSpace(move.Move)
               && move.Move.StartsWith("Cistella de ", StringComparison.OrdinalIgnoreCase);
    }

    private static string ResolveMoveTeamName(StatsRoot match, int? teamId)
    {
        if (!teamId.HasValue || teamId.Value <= 0)
            return "";

        return match.Teams.FirstOrDefault(team => team.TeamIdIntern == teamId.Value)?.Name ?? "";
    }

    private sealed record ScoringEvent(
        int Period,
        int MinuteAbsolute,
        int LocalScore,
        int VisitScore,
        int DeltaLocal,
        int DeltaVisit);
}
