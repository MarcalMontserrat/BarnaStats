using System.Globalization;
using System.Text.Json;
using GenerateAnalisys.Models;
using GenerateAnalisys.Utilities;

namespace GenerateAnalisys.Services;

public sealed class MatchAnalysisService
{
    private readonly OpenAiMatchReportService _matchReportService;
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public MatchAnalysisService(OpenAiMatchReportService matchReportService)
    {
        _matchReportService = matchReportService;
    }

    public async Task<AnalysisResult> ProcessAsync(string rawDataRootDir)
    {
        var teamsByKey = new Dictionary<string, TeamAccumulator>(StringComparer.Ordinal);
        var processedMatches = 0;

        var statsFiles = GetUniqueStatsFiles(rawDataRootDir)
            .ToList();

        foreach (var statsPath in statsFiles)
        {
            var fileName = Path.GetFileName(statsPath);
            var matchWebId = TryGetMatchWebIdFromFileName(fileName);

            if (matchWebId is null)
            {
                Console.WriteLine($"No se pudo inferir matchWebId desde {fileName}");
                continue;
            }

            Console.WriteLine($"Procesando partido {matchWebId}...");

            var json = await File.ReadAllTextAsync(statsPath);
            var match = JsonSerializer.Deserialize<StatsRoot>(json, _jsonOptions);

            if (match is null || match.Teams is null || match.Teams.Count < 2)
            {
                Console.WriteLine($"JSON inválido o sin equipos: {fileName}");
                continue;
            }

            var movesRaw = await TryReadMovesRawAsync(statsPath);
            var matchReport = await _matchReportService.GetOrGenerateAsync(
                matchWebId.Value,
                match,
                json,
                movesRaw);

            processedMatches += 1;

            var localTeam = match.Teams.FirstOrDefault(t => t.TeamIdIntern == match.LocalId)
                            ?? match.Teams.First();

            var visitTeam = match.Teams.FirstOrDefault(t => t.TeamIdIntern == match.VisitId)
                            ?? match.Teams.Skip(1).FirstOrDefault()
                            ?? match.Teams.Last();
            var matchDate = TryParseMatchDate(match.Time);

            var matchTopScorer = match.Teams
                .SelectMany(team => (team.Players ?? []).Select(player => new
                {
                    TeamName = team.Name ?? "",
                    PlayerName = player.Name ?? "",
                    Points = player.Data?.Score ?? 0,
                    Valoration = player.Data?.Valoration ?? 0
                }))
                .OrderByDescending(x => x.Points)
                .ThenByDescending(x => x.Valoration)
                .FirstOrDefault();

            foreach (var team in match.Teams)
            {
                if (string.IsNullOrWhiteSpace(team.Name))
                    continue;

                var rivalTeam = match.Teams.FirstOrDefault(other => !ReferenceEquals(other, team))
                                ?? match.Teams.First();

                var teamKey = BuildTeamKey(team);

                if (!teamsByKey.TryGetValue(teamKey, out var accumulator))
                {
                    accumulator = new TeamAccumulator(teamKey, team);
                    teamsByKey[teamKey] = accumulator;
                }

                accumulator.UpdateMetadata(team);

                var isHome = team.TeamIdIntern == match.LocalId;
                var teamPlayerScore = (team.Players ?? [])
                    .Sum(player => player.Data?.Score ?? 0);
                var rivalPlayerScore = (rivalTeam.Players ?? [])
                    .Sum(player => player.Data?.Score ?? 0);
                var teamTopScorer = (team.Players ?? [])
                    .Select(player => new
                    {
                        PlayerName = player.Name ?? "",
                        Points = player.Data?.Score ?? 0,
                        Valoration = player.Data?.Valoration ?? 0
                    })
                    .OrderByDescending(x => x.Points)
                    .ThenByDescending(x => x.Valoration)
                    .FirstOrDefault();

                accumulator.MatchSummaries.Add(new MatchSummary
                {
                    TeamKey = teamKey,
                    TeamIdIntern = team.TeamIdIntern,
                    TeamIdExtern = team.TeamIdExtern,
                    TeamName = team.Name ?? "",
                    MatchWebId = matchWebId.Value,
                    MatchInternId = match.IdMatchIntern,
                    MatchExternId = match.IdMatchExtern,
                    MatchDate = matchDate,
                    PhaseNumber = GetPhaseNumber(matchDate),
                    HomeTeam = localTeam.Name ?? "",
                    HomeScore = localTeam.Data?.Score ?? 0,
                    AwayTeam = visitTeam.Name ?? "",
                    AwayScore = visitTeam.Data?.Score ?? 0,
                    IsHome = isHome,
                    RivalTeam = rivalTeam.Name ?? "",
                    OfficialTeamScore = team.Data?.Score ?? 0,
                    OfficialRivalScore = rivalTeam.Data?.Score ?? 0,
                    TeamScore = teamPlayerScore,
                    RivalScore = rivalPlayerScore,
                    Result = BuildResult(teamPlayerScore, rivalPlayerScore),
                    TopScorer = matchTopScorer?.PlayerName ?? "",
                    TopScorerTeam = matchTopScorer?.TeamName ?? "",
                    TopScorerPoints = matchTopScorer?.Points ?? 0,
                    TeamTopScorer = teamTopScorer?.PlayerName ?? "",
                    TeamTopScorerPoints = teamTopScorer?.Points ?? 0,
                    MatchReport = matchReport?.Summary ?? "",
                    MatchReportGeneratedAtUtc = matchReport?.GeneratedAtUtc,
                    MatchReportModel = matchReport?.Model ?? ""
                });

                foreach (var player in team.Players ?? [])
                {
                    var data = player.Data ?? new StatBlock();
                    var playerName = player.Name ?? "";
                    var dorsal = player.Dorsal ?? "";

                    accumulator.MatchPlayerRows.Add(new MatchPlayerRow
                    {
                        TeamKey = teamKey,
                        TeamIdIntern = team.TeamIdIntern,
                        TeamIdExtern = team.TeamIdExtern,
                        TeamName = team.Name ?? "",
                        MatchWebId = matchWebId.Value,
                        MatchInternId = match.IdMatchIntern,
                        MatchExternId = match.IdMatchExtern,
                        MatchDate = matchDate,
                        IsHome = isHome,
                        Rival = rivalTeam.Name ?? "",
                        PlayerActorId = player.ActorId,
                        PlayerName = playerName,
                        Dorsal = dorsal,
                        Minutes = player.TimePlayed,
                        Points = data.Score,
                        Valuation = data.Valoration,
                        Fouls = data.Faults,
                        PlusMinus = player.InOut
                    });

                    var playerKey = BuildPlayerKey(teamKey, player);

                    if (!accumulator.SeasonTotals.TryGetValue(playerKey, out var seasonTotal))
                    {
                        seasonTotal = new PlayerSeasonTotal
                        {
                            TeamKey = teamKey,
                            TeamIdIntern = team.TeamIdIntern,
                            TeamIdExtern = team.TeamIdExtern,
                            TeamName = team.Name ?? "",
                            PlayerActorId = player.ActorId,
                            PlayerName = playerName,
                            ShirtNumber = dorsal
                        };

                        accumulator.SeasonTotals[playerKey] = seasonTotal;
                    }

                    seasonTotal.Games += 1;
                    seasonTotal.Minutes += player.TimePlayed;
                    seasonTotal.Points += data.Score;
                    seasonTotal.Valuation += data.Valoration;
                    seasonTotal.Fouls += data.Faults;
                    seasonTotal.PlusMinus += player.InOut;
                    seasonTotal.FtMade += data.ShotsOfOneSuccessful;
                    seasonTotal.FtAttempted += data.ShotsOfOneAttempted;
                    seasonTotal.TwoMade += data.ShotsOfTwoSuccessful;
                    seasonTotal.TwoAttempted += data.ShotsOfTwoAttempted;
                    seasonTotal.ThreeMade += data.ShotsOfThreeSuccessful;
                    seasonTotal.ThreeAttempted += data.ShotsOfThreeAttempted;
                }
            }
        }

        return new AnalysisResult
        {
            GeneratedAtUtc = DateTime.UtcNow,
            TotalMatches = processedMatches,
            Teams = teamsByKey.Values
                .Select(BuildTeamAnalysis)
                .OrderBy(team => team.TeamName, StringComparer.OrdinalIgnoreCase)
                .ToList()
        };
    }

    private static TeamAnalysis BuildTeamAnalysis(TeamAccumulator accumulator)
    {
        var seasonTotals = accumulator.SeasonTotals.Values
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
            TeamKey = accumulator.TeamKey,
            TeamIdIntern = accumulator.TeamIdIntern,
            TeamIdExtern = accumulator.TeamIdExtern,
            TeamName = accumulator.TeamName,
            MatchesPlayed = matchSummaries.Count,
            PlayersCount = seasonTotals.Count,
            MatchSummaries = matchSummaries,
            MatchPlayers = matchPlayers,
            SeasonTotals = seasonTotals,
            MatchMVPs = BuildMatchMvps(matchPlayers),
            Ranking = BuildRanking(seasonTotals),
            Evolution = BuildEvolution(matchPlayers)
        };
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
                    PlayerActorId = mvp.PlayerActorId,
                    PlayerName = mvp.PlayerName,
                    Points = mvp.Points,
                    Valuation = mvp.Valuation,
                    Minutes = mvp.Minutes
                };
            })
            .OrderBy(row => row.MatchWebId)
            .ToList();
    }

    private static IEnumerable<string> GetUniqueStatsFiles(string rawDataRootDir)
    {
        var selectedPaths = new List<string>();
        var duplicateMatchWebIds = new List<int>();

        var candidates = Directory.GetFiles(rawDataRootDir, "*_stats.json", SearchOption.AllDirectories)
            .Select(path => new
            {
                Path = path,
                MatchWebId = TryGetMatchWebIdFromFileName(Path.GetFileName(path)),
                IsTeamScoped = path.Contains($"{Path.DirectorySeparatorChar}teams{Path.DirectorySeparatorChar}", StringComparison.OrdinalIgnoreCase),
                LastWriteTimeUtc = File.GetLastWriteTimeUtc(path)
            })
            .Where(x => x.MatchWebId.HasValue)
            .GroupBy(x => x.MatchWebId!.Value)
            .OrderBy(group => group.Key);

        foreach (var group in candidates)
        {
            var selected = group
                .OrderByDescending(x => x.IsTeamScoped)
                .ThenByDescending(x => x.LastWriteTimeUtc)
                .ThenBy(x => x.Path, StringComparer.OrdinalIgnoreCase)
                .First();

            if (group.Count() > 1)
                duplicateMatchWebIds.Add(group.Key);

            selectedPaths.Add(selected.Path);
        }

        if (duplicateMatchWebIds.Count > 0)
        {
            Console.WriteLine($"Duplicados detectados en {duplicateMatchWebIds.Count} partidos. Se prioriza la versión guardada en `out/teams` y, si empatan, la más reciente.");
        }

        return selectedPaths;
    }

    private static async Task<string?> TryReadMovesRawAsync(string statsPath)
    {
        var movesPath = statsPath
            .Replace($"{Path.DirectorySeparatorChar}stats{Path.DirectorySeparatorChar}", $"{Path.DirectorySeparatorChar}moves{Path.DirectorySeparatorChar}")
            .Replace("_stats.json", "_moves.json", StringComparison.OrdinalIgnoreCase);

        if (!File.Exists(movesPath))
            return null;

        return await File.ReadAllTextAsync(movesPath);
    }

    private static List<PlayerRanking> BuildRanking(IEnumerable<PlayerSeasonTotal> seasonTotals)
    {
        return seasonTotals
            .Select(player => new PlayerRanking
            {
                PlayerActorId = player.PlayerActorId,
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
                        PlayerActorId = row.PlayerActorId,
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
        return $"{row.TeamKey}|{NameNormalizer.Normalize(row.PlayerName)}";
    }

    private static string BuildResult(int teamScore, int rivalScore)
    {
        if (teamScore > rivalScore)
            return "W";

        if (teamScore < rivalScore)
            return "L";

        return "T";
    }

    private static DateTime? TryParseMatchDate(string? rawTime)
    {
        if (string.IsNullOrWhiteSpace(rawTime))
            return null;

        if (DateTime.TryParse(
                rawTime,
                CultureInfo.InvariantCulture,
                DateTimeStyles.AllowWhiteSpaces | DateTimeStyles.AssumeLocal,
                out var parsed))
        {
            return parsed;
        }

        return null;
    }

    private static int GetPhaseNumber(DateTime? matchDate)
    {
        if (!matchDate.HasValue)
            return 1;

        return matchDate.Value.Month >= 1 && matchDate.Value.Month <= 8 ? 2 : 1;
    }

    private static int? TryGetMatchWebIdFromFileName(string fileName)
    {
        var firstUnderscore = fileName.IndexOf('_');
        if (firstUnderscore <= 0)
            return null;

        var prefix = fileName[..firstUnderscore];
        return int.TryParse(prefix, out var id) ? id : null;
    }

    private static string BuildTeamKey(TeamInfo team)
    {
        return NameNormalizer.Normalize(team.Name);
    }

    private static string BuildPlayerKey(string teamKey, PlayerInfo player)
    {
        return $"{teamKey}|{NameNormalizer.Normalize(player.Name)}";
    }

    private sealed class TeamAccumulator
    {
        public TeamAccumulator(string teamKey, TeamInfo team)
        {
            TeamKey = teamKey;
            TeamIdIntern = team.TeamIdIntern;
            TeamIdExtern = team.TeamIdExtern;
            TeamName = team.Name ?? "";
        }

        public string TeamKey { get; }
        public int TeamIdIntern { get; private set; }
        public int TeamIdExtern { get; private set; }
        public string TeamName { get; private set; }
        public List<MatchSummary> MatchSummaries { get; } = [];
        public List<MatchPlayerRow> MatchPlayerRows { get; } = [];
        public Dictionary<string, PlayerSeasonTotal> SeasonTotals { get; } = new(StringComparer.Ordinal);

        public void UpdateMetadata(TeamInfo team)
        {
            if (TeamIdIntern == 0 && team.TeamIdIntern > 0)
                TeamIdIntern = team.TeamIdIntern;

            if (TeamIdExtern == 0 && team.TeamIdExtern > 0)
                TeamIdExtern = team.TeamIdExtern;

            if (string.IsNullOrWhiteSpace(TeamName) && !string.IsNullOrWhiteSpace(team.Name))
                TeamName = team.Name!;
        }
    }
}
