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

        foreach (var statsFile in statsFiles)
        {
            var statsPath = statsFile.Path;
            var fileName = Path.GetFileName(statsPath);
            var matchWebId = statsFile.MatchWebId;
            var phaseMetadata = statsFile.PhaseMetadata;

            Console.WriteLine($"Procesando partido {matchWebId}...");

            var json = await File.ReadAllTextAsync(statsPath);
            var match = JsonSerializer.Deserialize<StatsRoot>(json, _jsonOptions);

            if (match is null || match.Teams is null || match.Teams.Count < 2)
            {
                Console.WriteLine($"JSON inválido o sin equipos: {fileName}");
                continue;
            }

            var movesRaw = await TryReadMovesRawAsync(statsPath);
            var moves = DeserializeMoves(movesRaw);
            var matchReport = await _matchReportService.GetOrGenerateAsync(
                matchWebId,
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
            var seasonStartYear = ResolveSeasonStartYear(phaseMetadata, matchDate);
            var seasonLabel = ResolveSeasonLabel(phaseMetadata, seasonStartYear);
            var homeTeamKey = BuildTeamKey(localTeam, phaseMetadata, seasonLabel);
            var awayTeamKey = BuildTeamKey(visitTeam, phaseMetadata, seasonLabel);

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

                var teamKey = BuildTeamKey(team, phaseMetadata, seasonLabel);

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
                    SeasonStartYear = seasonStartYear,
                    SeasonLabel = seasonLabel,
                    HomeTeamKey = homeTeamKey,
                    AwayTeamKey = awayTeamKey,
                    MatchWebId = matchWebId,
                    MatchInternId = match.IdMatchIntern,
                    MatchExternId = match.IdMatchExtern,
                    MatchDate = matchDate,
                    PhaseNumber = GetPhaseNumber(matchDate),
                    SourcePhaseId = phaseMetadata?.PhaseId,
                    CategoryName = phaseMetadata?.CategoryName ?? "",
                    PhaseName = phaseMetadata?.PhaseName ?? "",
                    LevelName = phaseMetadata?.LevelName ?? "",
                    LevelCode = phaseMetadata?.LevelCode ?? "",
                    GroupCode = phaseMetadata?.GroupCode ?? "",
                    HomeTeam = localTeam.Name ?? "",
                    HomeScore = localTeam.Data?.Score ?? 0,
                    AwayTeam = visitTeam.Name ?? "",
                    AwayScore = visitTeam.Data?.Score ?? 0,
                    IsHome = isHome,
                    RivalTeamKey = BuildTeamKey(rivalTeam, phaseMetadata, seasonLabel),
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
                    Insights = BuildMatchInsights(match, team, isHome, moves),
                    MatchReport = matchReport?.Summary ?? "",
                    MatchReportGeneratedAtUtc = matchReport?.GeneratedAtUtc,
                    MatchReportModel = matchReport?.Model ?? ""
                });

                foreach (var player in team.Players ?? [])
                {
                    var data = player.Data ?? new StatBlock();
                    var playerName = player.Name ?? "";
                    var dorsal = player.Dorsal ?? "";
                    var playerUuid = NormalizePlayerUuid(player.Uuid);
                    var playerIdentityKey = BuildPlayerIdentityKey(playerUuid, player.ActorId, playerName);

                    accumulator.MatchPlayerRows.Add(new MatchPlayerRow
                    {
                        TeamKey = teamKey,
                        TeamIdIntern = team.TeamIdIntern,
                        TeamIdExtern = team.TeamIdExtern,
                        TeamName = team.Name ?? "",
                        SeasonStartYear = seasonStartYear,
                        SeasonLabel = seasonLabel,
                        MatchWebId = matchWebId,
                        MatchInternId = match.IdMatchIntern,
                        MatchExternId = match.IdMatchExtern,
                        MatchDate = matchDate,
                        PhaseNumber = GetPhaseNumber(matchDate),
                        SourcePhaseId = phaseMetadata?.PhaseId,
                        CategoryName = phaseMetadata?.CategoryName ?? "",
                        PhaseName = phaseMetadata?.PhaseName ?? "",
                        LevelName = phaseMetadata?.LevelName ?? "",
                        LevelCode = phaseMetadata?.LevelCode ?? "",
                        GroupCode = phaseMetadata?.GroupCode ?? "",
                        IsHome = isHome,
                        RivalTeamKey = BuildTeamKey(rivalTeam, phaseMetadata, seasonLabel),
                        Rival = rivalTeam.Name ?? "",
                        PlayerUuid = playerUuid,
                        PlayerActorId = player.ActorId,
                        PlayerIdentityKey = playerIdentityKey,
                        PlayerName = playerName,
                        Dorsal = dorsal,
                        Minutes = player.TimePlayed,
                        Points = data.Score,
                        Valuation = data.Valoration,
                        Fouls = data.Faults,
                        PlusMinus = player.InOut,
                        FtMade = data.ShotsOfOneSuccessful,
                        FtAttempted = data.ShotsOfOneAttempted,
                        TwoMade = data.ShotsOfTwoSuccessful,
                        TwoAttempted = data.ShotsOfTwoAttempted,
                        ThreeMade = data.ShotsOfThreeSuccessful,
                        ThreeAttempted = data.ShotsOfThreeAttempted
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
                            SeasonStartYear = seasonStartYear,
                            SeasonLabel = seasonLabel,
                            PlayerUuid = playerUuid,
                            PlayerActorId = player.ActorId,
                            PlayerIdentityKey = playerIdentityKey,
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
                    accumulator.TrackShirtNumber(playerKey, dorsal);
                }
            }
        }

        var teamAnalyses = teamsByKey.Values
            .Select(BuildTeamAnalysis)
            .OrderBy(team => team.TeamName, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return new AnalysisResult
        {
            SeasonStartYear = ResolveSingleSeasonStartYear(teamAnalyses),
            SeasonLabel = ResolveSingleSeasonLabel(teamAnalyses),
            GeneratedAtUtc = DateTime.UtcNow,
            TotalMatches = processedMatches,
            Competition = BuildCompetitionAnalysis(teamAnalyses),
            Teams = teamAnalyses
        };
    }

    private static TeamAnalysis BuildTeamAnalysis(TeamAccumulator accumulator)
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

    private static CompetitionAnalysis BuildCompetitionAnalysis(IReadOnlyCollection<TeamAnalysis> teamAnalyses)
    {
        var competitionTeams = teamAnalyses
            .Select(team => new CompetitionTeamOverview
            {
                TeamKey = team.TeamKey,
                TeamIdIntern = team.TeamIdIntern,
                TeamIdExtern = team.TeamIdExtern,
                TeamName = team.TeamName,
                MatchesPlayed = team.MatchesPlayed,
                PlayersCount = team.PlayersCount
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

    private IEnumerable<StatsFileContext> GetUniqueStatsFiles(string rawDataRootDir)
    {
        var selectedPaths = new List<string>();
        var duplicateMatchWebIds = new List<int>();
        var phaseMetadataByRoot = new Dictionary<string, PhaseMetadataFile?>(StringComparer.OrdinalIgnoreCase);

        var candidates = Directory.GetFiles(rawDataRootDir, "*_stats.json", SearchOption.AllDirectories)
            .Select(path => new
            {
                Path = path,
                MatchWebId = TryGetMatchWebIdFromFileName(Path.GetFileName(path)),
                IsScoped = path.Contains($"{Path.DirectorySeparatorChar}teams{Path.DirectorySeparatorChar}", StringComparison.OrdinalIgnoreCase) ||
                           path.Contains($"{Path.DirectorySeparatorChar}phases{Path.DirectorySeparatorChar}", StringComparison.OrdinalIgnoreCase),
                LastWriteTimeUtc = File.GetLastWriteTimeUtc(path)
            })
            .Where(x => x.MatchWebId.HasValue)
            .GroupBy(x => x.MatchWebId!.Value)
            .OrderBy(group => group.Key);

        foreach (var group in candidates)
        {
            var selected = group
                .OrderByDescending(x => x.IsScoped)
                .ThenByDescending(x => x.LastWriteTimeUtc)
                .ThenBy(x => x.Path, StringComparer.OrdinalIgnoreCase)
                .First();

            if (group.Count() > 1)
                duplicateMatchWebIds.Add(group.Key);

            selectedPaths.Add(selected.Path);
        }

        if (duplicateMatchWebIds.Count > 0)
        {
            Console.WriteLine($"Duplicados detectados en {duplicateMatchWebIds.Count} partidos. Se prioriza la versión más reciente, dando preferencia a las carpetas con scope dedicado como `out/phases`.");
        }

        return selectedPaths.Select(path => new StatsFileContext(
            path,
            TryGetMatchWebIdFromFileName(Path.GetFileName(path))!.Value,
            GetPhaseMetadataForStatsPath(path, phaseMetadataByRoot)));
    }

    private PhaseMetadataFile? GetPhaseMetadataForStatsPath(
        string statsPath,
        IDictionary<string, PhaseMetadataFile?> phaseMetadataByRoot)
    {
        var statsDir = Path.GetDirectoryName(statsPath);
        if (string.IsNullOrWhiteSpace(statsDir))
            return null;

        var phaseRootDir = Directory.GetParent(statsDir)?.FullName;
        if (string.IsNullOrWhiteSpace(phaseRootDir))
            return null;

        var directoryName = Path.GetFileName(Path.GetDirectoryName(statsPath));
        if (!string.Equals(directoryName, "stats", StringComparison.OrdinalIgnoreCase))
            return null;

        var phasesSegment = $"{Path.DirectorySeparatorChar}phases{Path.DirectorySeparatorChar}";
        if (!phaseRootDir.Contains(phasesSegment, StringComparison.OrdinalIgnoreCase))
            return null;

        if (phaseMetadataByRoot.TryGetValue(phaseRootDir, out var cachedMetadata))
            return cachedMetadata;

        var phaseMetadataPath = Path.Combine(phaseRootDir, "phase_metadata.json");
        if (!File.Exists(phaseMetadataPath))
        {
            phaseMetadataByRoot[phaseRootDir] = null;
            return null;
        }

        try
        {
            var json = File.ReadAllText(phaseMetadataPath);
            var metadata = JsonSerializer.Deserialize<PhaseMetadataFile>(json, _jsonOptions);
            phaseMetadataByRoot[phaseRootDir] = metadata;
            return metadata;
        }
        catch
        {
            phaseMetadataByRoot[phaseRootDir] = null;
            return null;
        }
    }

    private static List<MoveEvent> DeserializeMoves(string? movesRaw)
    {
        if (string.IsNullOrWhiteSpace(movesRaw))
            return [];

        try
        {
            return JsonSerializer.Deserialize<List<MoveEvent>>(movesRaw) ?? [];
        }
        catch
        {
            return [];
        }
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

    private static MatchInsights BuildMatchInsights(
        StatsRoot match,
        TeamInfo team,
        bool isHome,
        IReadOnlyList<MoveEvent> moves)
    {
        var scoringEvents = BuildScoringEvents(match);
        var periodScores = BuildPeriodScores(scoringEvents, isHome);
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
        IReadOnlyList<ScoringEvent> scoringEvents,
        bool isHome)
    {
        return scoringEvents
            .GroupBy(scoringEvent => scoringEvent.Period)
            .OrderBy(group => group.Key)
            .Select(group =>
            {
                var localPoints = group.Sum(item => item.DeltaLocal);
                var visitPoints = group.Sum(item => item.DeltaVisit);
                var teamPoints = isHome ? localPoints : visitPoints;
                var rivalPoints = isHome ? visitPoints : localPoints;

                return new MatchPeriodScore
                {
                    PeriodNumber = group.Key,
                    Label = $"Parcial {group.Key}",
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

    private static string BuildTeamKey(TeamInfo team, PhaseMetadataFile? phaseMetadata, string? seasonLabel)
    {
        var normalizedSeasonLabel = NameNormalizer.Normalize(seasonLabel);
        var categoryName = NameNormalizer.Normalize(phaseMetadata?.CategoryName);
        var teamIdentity = team.TeamIdExtern > 0
            ? $"TEAM:{team.TeamIdExtern}"
            : NameNormalizer.Normalize(team.Name);

        var scopeSegments = new List<string>();
        if (!string.IsNullOrWhiteSpace(normalizedSeasonLabel))
            scopeSegments.Add(normalizedSeasonLabel);

        if (string.IsNullOrWhiteSpace(categoryName))
        {
            scopeSegments.Add(teamIdentity);
            return string.Join("::", scopeSegments);
        }

        scopeSegments.Add(categoryName);
        scopeSegments.Add(teamIdentity);
        return string.Join("::", scopeSegments);
    }

    private static string BuildPlayerKey(string teamKey, PlayerInfo player)
    {
        return $"{teamKey}|{BuildPlayerIdentityKey(player.Uuid, player.ActorId, player.Name)}";
    }

    private static string BuildPlayerIdentityKey(string? playerUuid, long playerActorId, string? playerName)
    {
        var normalizedUuid = NormalizePlayerUuid(playerUuid);
        if (!string.IsNullOrWhiteSpace(normalizedUuid))
            return $"UUID:{normalizedUuid}";

        if (playerActorId > 0)
            return $"PLAYER:{playerActorId}";

        return $"NAME:{NameNormalizer.Normalize(playerName)}";
    }

    private static string NormalizePlayerUuid(string? playerUuid)
    {
        return string.IsNullOrWhiteSpace(playerUuid)
            ? ""
            : playerUuid.Trim().ToLowerInvariant();
    }

    private static int? ResolveSeasonStartYear(PhaseMetadataFile? phaseMetadata, DateTime? matchDate)
    {
        if (phaseMetadata?.SeasonStartYear is > 0)
            return phaseMetadata.SeasonStartYear;

        if (!matchDate.HasValue)
            return null;

        return matchDate.Value.Month >= 7 ? matchDate.Value.Year : matchDate.Value.Year - 1;
    }

    private static string ResolveSeasonLabel(PhaseMetadataFile? phaseMetadata, int? seasonStartYear)
    {
        if (!string.IsNullOrWhiteSpace(phaseMetadata?.SeasonLabel))
            return phaseMetadata.SeasonLabel;

        if (!seasonStartYear.HasValue)
            return "";

        return $"{seasonStartYear.Value}-{seasonStartYear.Value + 1}";
    }

    private static int? ResolveSingleSeasonStartYear(IEnumerable<TeamAnalysis> teamAnalyses)
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

    private static string ResolveSingleSeasonLabel(IEnumerable<TeamAnalysis> teamAnalyses)
    {
        var labels = teamAnalyses
            .Select(team => team.SeasonLabel)
            .Where(label => !string.IsNullOrWhiteSpace(label))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(2)
            .ToList();

        return labels.Count == 1 ? labels[0] : "";
    }

    private sealed record ScoringEvent(
        int Period,
        int MinuteAbsolute,
        int LocalScore,
        int VisitScore,
        int DeltaLocal,
        int DeltaVisit);

    private sealed record StatsFileContext(
        string Path,
        int MatchWebId,
        PhaseMetadataFile? PhaseMetadata);

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
        public Dictionary<string, Dictionary<string, int>> ShirtNumbersByPlayer { get; } = new(StringComparer.Ordinal);

        public void UpdateMetadata(TeamInfo team)
        {
            if (TeamIdIntern == 0 && team.TeamIdIntern > 0)
                TeamIdIntern = team.TeamIdIntern;

            if (TeamIdExtern == 0 && team.TeamIdExtern > 0)
                TeamIdExtern = team.TeamIdExtern;

            if (ShouldUseTeamName(team.Name, TeamName))
                TeamName = team.Name!;
        }

        public void TrackShirtNumber(string playerKey, string? shirtNumber)
        {
            if (string.IsNullOrWhiteSpace(playerKey) || string.IsNullOrWhiteSpace(shirtNumber))
                return;

            var normalizedShirtNumber = shirtNumber.Trim();
            if (normalizedShirtNumber.Length == 0)
                return;

            if (!ShirtNumbersByPlayer.TryGetValue(playerKey, out var shirtNumbers))
            {
                shirtNumbers = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
                ShirtNumbersByPlayer[playerKey] = shirtNumbers;
            }

            shirtNumbers[normalizedShirtNumber] = shirtNumbers.GetValueOrDefault(normalizedShirtNumber) + 1;
        }

        public string ResolveDominantShirtNumber(string playerKey, string? fallback)
        {
            if (!ShirtNumbersByPlayer.TryGetValue(playerKey, out var shirtNumbers) || shirtNumbers.Count == 0)
                return fallback?.Trim() ?? "";

            var normalizedFallback = fallback?.Trim() ?? "";

            return shirtNumbers
                .OrderByDescending(entry => entry.Value)
                .ThenByDescending(entry => string.Equals(entry.Key, normalizedFallback, StringComparison.OrdinalIgnoreCase))
                .ThenBy(entry => entry.Key, StringComparer.OrdinalIgnoreCase)
                .Select(entry => entry.Key)
                .FirstOrDefault() ?? normalizedFallback;
        }

        private static bool ShouldUseTeamName(string? candidateName, string currentName)
        {
            if (string.IsNullOrWhiteSpace(candidateName))
                return false;

            if (string.IsNullOrWhiteSpace(currentName))
                return true;

            return candidateName.Length > currentName.Length;
        }
    }
}
