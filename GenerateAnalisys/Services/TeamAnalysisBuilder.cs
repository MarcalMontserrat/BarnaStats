using GenerateAnalisys.Models;

namespace GenerateAnalisys.Services;

internal static class TeamAnalysisBuilder
{
    internal static TeamAnalysis BuildTeamAnalysis(TeamAccumulator accumulator)
    {
        var seasonTotals = accumulator.SeasonTotals
            .Select(entry =>
            {
                entry.Value.ShirtNumber = accumulator.ResolveDominantShirtNumber(entry.Key, entry.Value.ShirtNumber);
                return entry.Value;
            })
            .OrderByDescending(player => player.Points)
            .ThenBy(player => player.PlayerName, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var matchSummaries = accumulator.MatchSummaries
            .OrderBy(summary => summary.MatchDate ?? DateTime.MaxValue)
            .ThenBy(summary => summary.MatchWebId)
            .ToList();

        for (var index = 0; index < matchSummaries.Count; index += 1)
        {
            matchSummaries[index].RoundNumber = index + 1;
        }

        var phaseRounds = new Dictionary<int, int>();
        foreach (var summary in matchSummaries)
        {
            var nextRound = phaseRounds.GetValueOrDefault(summary.PhaseNumber) + 1;
            phaseRounds[summary.PhaseNumber] = nextRound;
            summary.PhaseRound = nextRound;
        }

        var summariesByMatchId = matchSummaries.ToDictionary(summary => summary.MatchWebId);

        foreach (var row in accumulator.MatchPlayerRows)
        {
            if (!summariesByMatchId.TryGetValue(row.MatchWebId, out var summary))
                continue;

            row.MatchDate = summary.MatchDate;
            row.PhaseNumber = summary.PhaseNumber;
            row.SourcePhaseId = summary.SourcePhaseId;
            row.SeasonStartYear = summary.SeasonStartYear;
            row.SeasonLabel = summary.SeasonLabel;
            row.CategoryName = summary.CategoryName;
            row.PhaseName = summary.PhaseName;
            row.LevelName = summary.LevelName;
            row.LevelCode = summary.LevelCode;
            row.GroupCode = summary.GroupCode;
            row.PhaseRound = summary.PhaseRound;
        }

        var matchPlayers = accumulator.MatchPlayerRows
            .OrderBy(row => row.PhaseNumber)
            .ThenBy(row => row.PhaseRound)
            .ThenBy(row => row.MatchWebId)
            .ThenByDescending(row => row.Points)
            .ThenBy(row => row.PlayerName, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return new TeamAnalysis
        {
            SeasonStartYear = matchSummaries.Select(summary => summary.SeasonStartYear).FirstOrDefault(value => value.HasValue),
            SeasonLabel = matchSummaries.Select(summary => summary.SeasonLabel).FirstOrDefault(label => !string.IsNullOrWhiteSpace(label)) ?? "",
            TeamKey = accumulator.TeamKey,
            TeamIdIntern = accumulator.TeamIdIntern,
            TeamIdExtern = accumulator.TeamIdExtern,
            TeamName = accumulator.TeamName,
            MatchesPlayed = matchSummaries.Count,
            PlayersCount = seasonTotals.Count,
            Phases = BuildTeamPhases(matchSummaries),
            MatchSummaries = matchSummaries,
            MatchPlayers = matchPlayers,
            SeasonTotals = seasonTotals,
            MatchMVPs = BuildMatchMvps(matchPlayers),
            Ranking = BuildRanking(seasonTotals),
            Evolution = BuildEvolution(matchPlayers)
        };
    }

    private static List<TeamPhaseInfo> BuildTeamPhases(IEnumerable<MatchSummary> matchSummaries)
    {
        return matchSummaries
            .GroupBy(summary => new
            {
                summary.SeasonStartYear,
                summary.SeasonLabel,
                summary.PhaseNumber,
                summary.SourcePhaseId,
                summary.CategoryName,
                summary.PhaseName,
                summary.LevelName,
                summary.LevelCode,
                summary.GroupCode
            })
            .OrderBy(group => group.Key.PhaseNumber)
            .ThenBy(group => group.Key.SourcePhaseId ?? int.MaxValue)
            .Select(group => new TeamPhaseInfo
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
                MatchesPlayed = group.Count()
            })
            .ToList();
    }

    private static List<MatchMVP> BuildMatchMvps(IEnumerable<MatchPlayerRow> matchPlayerRows)
    {
        return matchPlayerRows
            .GroupBy(row => row.MatchWebId)
            .Select(group =>
            {
                var mvp = group
                    .OrderByDescending(row => row.Valuation)
                    .ThenByDescending(row => row.Points)
                    .ThenByDescending(row => row.Minutes)
                    .First();

                return new MatchMVP
                {
                    MatchWebId = group.Key,
                    PlayerUuid = mvp.PlayerUuid,
                    PlayerActorId = mvp.PlayerActorId,
                    PlayerIdentityKey = mvp.PlayerIdentityKey,
                    PlayerName = mvp.PlayerName,
                    Points = mvp.Points,
                    Valuation = mvp.Valuation,
                    Minutes = mvp.Minutes
                };
            })
            .OrderBy(row => row.MatchWebId)
            .ToList();
    }

    private static List<PlayerRanking> BuildRanking(IEnumerable<PlayerSeasonTotal> seasonTotals)
    {
        return seasonTotals
            .Select(player => new PlayerRanking
            {
                PlayerUuid = player.PlayerUuid,
                PlayerActorId = player.PlayerActorId,
                PlayerIdentityKey = player.PlayerIdentityKey,
                PlayerName = player.PlayerName,
                Dorsal = player.ShirtNumber,
                Games = player.Games,
                Points = player.Points,
                AvgPoints = player.Games > 0 ? (double)player.Points / player.Games : 0,
                Valuation = player.Valuation,
                AvgValuation = player.Games > 0 ? (double)player.Valuation / player.Games : 0,
                Minutes = player.Minutes
            })
            .OrderByDescending(row => row.Points)
            .ThenBy(row => row.PlayerName, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static List<PlayerEvolution> BuildEvolution(IEnumerable<MatchPlayerRow> matchPlayerRows)
    {
        return matchPlayerRows
            .GroupBy(row => BuildEvolutionKey(row))
            .SelectMany(group =>
                group.OrderBy(row => row.PhaseNumber)
                    .ThenBy(row => row.PhaseRound)
                    .ThenBy(row => row.MatchWebId)
                    .Select((row, index) => new PlayerEvolution
                    {
                        PlayerUuid = row.PlayerUuid,
                        PlayerActorId = row.PlayerActorId,
                        PlayerIdentityKey = row.PlayerIdentityKey,
                        PlayerName = row.PlayerName,
                        PhaseNumber = row.PhaseNumber,
                        PhaseRound = row.PhaseRound,
                        MatchNumber = index + 1,
                        MatchWebId = row.MatchWebId,
                        Points = row.Points,
                        Valuation = row.Valuation
                    }))
            .OrderBy(row => row.PlayerName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(row => row.PhaseNumber)
            .ThenBy(row => row.PhaseRound)
            .ThenBy(row => row.MatchWebId)
            .ToList();
    }

    private static string BuildEvolutionKey(MatchPlayerRow row)
    {
        return $"{row.TeamKey}|{row.PlayerIdentityKey}";
    }
}
