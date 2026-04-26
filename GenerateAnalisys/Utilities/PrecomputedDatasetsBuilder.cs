using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using GenerateAnalisys.Models;

namespace GenerateAnalisys.Utilities;

public static class PrecomputedDatasetsBuilder
{
    private static readonly CultureInfo EsCulture = CultureInfo.GetCultureInfo("es-ES");
    private static readonly StringComparer EsComparer = StringComparer.Create(EsCulture, ignoreCase: true);
    private static readonly Regex TrailingLetterRegex = new(@"\b[A-Z]$", RegexOptions.Compiled);
    private static readonly Regex TeamSuffixRegex = new(@"\b(U\d{1,2}|PR[0-9A-Z]*|J[0-9A-Z]*|C[0-9A-Z]*|I[0-9A-Z]*|MINI|PREMINI|SOTS ?\d+)\b.*$", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    public static CompetitionOverview BuildCompetitionOverview(CompetitionAnalysis competition)
    {
        return new CompetitionOverview
        {
            SeasonStartYear = competition.SeasonStartYear,
            SeasonLabel = competition.SeasonLabel,
            TotalTeams = competition.TotalTeams,
            TotalMatches = competition.TotalMatches,
            Phases = competition.Phases,
            Teams = competition.Teams
        };
    }

    public static CompetitionStandingsDataset BuildCompetitionStandings(CompetitionAnalysis competition)
    {
        var scopes = competition.Matches
            .GroupBy(match => new StandingScopeKey(
                match.SeasonStartYear,
                match.SeasonLabel,
                match.SourcePhaseId,
                match.PhaseNumber,
                match.CategoryName,
                match.PhaseName,
                match.LevelName,
                match.LevelCode,
                match.GroupCode))
            .OrderBy(group => group.Key.SeasonStartYear ?? int.MaxValue)
            .ThenBy(group => group.Key.PhaseNumber)
            .ThenBy(group => group.Key.SourcePhaseId ?? int.MaxValue)
            .ThenBy(group => group.Key.CategoryName, EsComparer)
            .ThenBy(group => group.Key.LevelName, EsComparer)
            .ThenBy(group => group.Key.GroupCode, EsComparer)
            .Select(group => new CompetitionStandingScope
            {
                Key = BuildPhaseScopeKey(group.Key.SeasonLabel, group.Key.SourcePhaseId, group.Key.PhaseNumber, group.Key.CategoryName, group.Key.PhaseName, group.Key.LevelName, group.Key.LevelCode, group.Key.GroupCode),
                SeasonStartYear = group.Key.SeasonStartYear,
                SeasonLabel = group.Key.SeasonLabel,
                SourcePhaseId = group.Key.SourcePhaseId,
                PhaseNumber = group.Key.PhaseNumber,
                CategoryName = group.Key.CategoryName,
                PhaseName = group.Key.PhaseName,
                LevelName = group.Key.LevelName,
                LevelCode = group.Key.LevelCode,
                GroupCode = group.Key.GroupCode,
                MatchesCount = group.Count(),
                Rows = BuildCompetitionStandingRows(group)
            })
            .ToList();

        return new CompetitionStandingsDataset
        {
            SeasonStartYear = competition.SeasonStartYear,
            SeasonLabel = competition.SeasonLabel,
            Scopes = scopes
        };
    }

    public static IReadOnlyList<ClubDirectoryEntry> BuildClubDirectory(AnalysisResult analysis, string repoRoot)
    {
        var resolver = ClubBrandingResolver.Load(repoRoot);
        var standings = BuildCompetitionStandings(analysis.Competition);
        var matchesByTeamKey = BuildMatchesByTeamKey(analysis.Competition.Matches);
        var totalValuationByTeam = analysis.Competition.Teams
            .ToDictionary(team => team.TeamKey, team => team.TotalValuation, StringComparer.Ordinal);
        var entities = new Dictionary<string, MutableClubEntity>(StringComparer.Ordinal);

        foreach (var team in analysis.Teams)
        {
            var clubBranding = resolver.Resolve(team.TeamIdExtern, team.TeamName);
            if (clubBranding is null || string.IsNullOrWhiteSpace(clubBranding.ClubKey))
            {
                continue;
            }

            if (!entities.TryGetValue(clubBranding.ClubKey, out var entity))
            {
                entity = new MutableClubEntity(
                    clubBranding.ClubKey,
                    clubBranding.ClubName,
                    clubBranding.ShortName,
                    clubBranding.ClubId,
                    team.TeamIdExtern);
                entities[clubBranding.ClubKey] = entity;
            }

            var relevantMatches = matchesByTeamKey.GetValueOrDefault(team.TeamKey) ?? [];
            var record = BuildTeamRecord(relevantMatches, team.TeamKey);
            var latestPhase = team.Phases
                .OrderByDescending(phase => phase.PhaseNumber)
                .ThenByDescending(phase => phase.SourcePhaseId ?? 0)
                .FirstOrDefault();
            var categoryName = NormalizeValue(latestPhase?.CategoryName);
            var levelKey = NormalizeLevelKey(latestPhase?.LevelCode, latestPhase?.LevelName);
            var levelName = NormalizeValue(latestPhase?.LevelName);
            if (string.IsNullOrWhiteSpace(levelName))
            {
                levelName = levelKey;
            }

            var standingPosition = ResolveStandingPosition(
                standings.Scopes,
                team.Phases,
                categoryName,
                team.TeamKey);
            var latestPhaseOptionValue = latestPhase?.SourcePhaseId > 0
                ? $"source:{latestPhase.SourcePhaseId}"
                : latestPhase is not null
                    ? $"phase:{latestPhase.PhaseNumber}"
                    : "all";

            entity.PrimaryTeamIdExtern = entity.PrimaryTeamIdExtern > 0
                ? entity.PrimaryTeamIdExtern
                : team.TeamIdExtern;
            entity.SearchTerms.Add(team.TeamName);
            entity.SearchTerms.Add(categoryName);
            entity.SearchTerms.Add(levelName);

            if (!string.IsNullOrWhiteSpace(categoryName))
            {
                entity.Categories.Add(categoryName);
            }

            if (!string.IsNullOrWhiteSpace(levelName))
            {
                entity.Levels.Add(levelName);
            }

            entity.TeamEntries.Add(new ClubTeamEntry
            {
                Key = string.IsNullOrWhiteSpace(team.TeamKey)
                    ? NormalizeTeamName(team.TeamName)
                    : team.TeamKey,
                TeamKey = team.TeamKey,
                TeamIdExtern = team.TeamIdExtern,
                TeamName = team.TeamName,
                MatchesPlayed = team.MatchesPlayed,
                PlayersCount = team.PlayersCount,
                CategoryName = categoryName,
                LevelKey = levelKey,
                LevelName = levelName,
                PhaseLabel = BuildCompetitionPhaseLabel(latestPhase),
                LatestPhaseOptionValue = latestPhaseOptionValue,
                GroupCode = NormalizeValue(latestPhase?.GroupCode),
                StandingPosition = standingPosition,
                Record = record,
                PointDiff = record.PointsFor - record.PointsAgainst,
                AvgValuation = team.MatchesPlayed > 0
                    ? (double)totalValuationByTeam.GetValueOrDefault(team.TeamKey) / team.MatchesPlayed
                    : 0
            });
        }

        return entities.Values
            .Select(entity =>
            {
                var orderedTeamEntries = entity.TeamEntries
                    .OrderBy(entry => entry.CategoryName, EsComparer)
                    .ThenBy(entry => NormalizeLevelNameForSort(entry.LevelName, entry.LevelKey), EsComparer)
                    .ThenBy(entry => entry.GroupCode, EsComparer)
                    .ThenBy(entry => entry.TeamName, EsComparer)
                    .ToList();
                var totalMatches = orderedTeamEntries.Sum(team => team.MatchesPlayed);
                var totalPlayers = orderedTeamEntries.Sum(team => team.PlayersCount);

                return new ClubDirectoryEntry
                {
                    Key = entity.Key,
                    Label = entity.Label,
                    ShortName = entity.ShortName,
                    ClubId = entity.ClubId,
                    PrimaryTeamIdExtern = entity.PrimaryTeamIdExtern,
                    TotalTeams = orderedTeamEntries.Count,
                    TotalMatches = totalMatches,
                    TotalPlayers = totalPlayers,
                    CategoriesCount = entity.Categories.Count,
                    LevelsCount = entity.Levels.Count,
                    Meta = string.Join(" · ", new[]
                    {
                        $"{orderedTeamEntries.Count} equipo{(orderedTeamEntries.Count == 1 ? "" : "s")}",
                        entity.Categories.Count > 0 ? $"{entity.Categories.Count} categoria{(entity.Categories.Count == 1 ? "" : "s")}" : "",
                        totalMatches > 0 ? $"{totalMatches} partidos" : ""
                    }.Where(value => !string.IsNullOrWhiteSpace(value))),
                    SearchText = string.Join(" ", entity.SearchTerms.Where(value => !string.IsNullOrWhiteSpace(value))),
                    Categories = FinalizeClubCategories(orderedTeamEntries)
                };
            })
            .OrderBy(entry => entry.Label, EsComparer)
            .ToList();
    }

    public static HistoricalTeamDirectoryDataset BuildHistoricalTeamDirectory(
        DateTime generatedAtUtc,
        IReadOnlyCollection<AnalysisResult> seasonAnalyses)
    {
        var entities = new Dictionary<string, MutableHistoricalTeamEntity>(StringComparer.Ordinal);

        foreach (var analysis in seasonAnalyses)
        {
            var standings = BuildCompetitionStandings(analysis.Competition);
            var matchesByTeamKey = BuildMatchesByTeamKey(analysis.Competition.Matches);
            var totalValuationByTeam = analysis.Competition.Teams
                .ToDictionary(team => team.TeamKey, team => team.TotalValuation, StringComparer.Ordinal);

            foreach (var team in analysis.Teams)
            {
                var entityKey = team.TeamIdExtern > 0
                    ? $"TEAM:{team.TeamIdExtern}"
                    : $"NAME:{NormalizeTeamName(team.TeamName)}";

                if (!entities.TryGetValue(entityKey, out var entity))
                {
                    entity = new MutableHistoricalTeamEntity(entityKey, team.TeamName);
                    entities[entityKey] = entity;
                }

                entity.SearchTerms.Add(team.TeamName);

                var relevantMatches = matchesByTeamKey.GetValueOrDefault(team.TeamKey) ?? [];
                var record = BuildTeamRecord(relevantMatches, team.TeamKey);
                var latestPhase = team.Phases
                    .OrderByDescending(phase => phase.PhaseNumber)
                    .ThenByDescending(phase => phase.SourcePhaseId ?? 0)
                    .FirstOrDefault();
                var categoryName = NormalizeValue(latestPhase?.CategoryName);
                var levelName = NormalizeLevelKey(latestPhase?.LevelCode, latestPhase?.LevelName);
                var standingPosition = ResolveStandingPosition(
                    standings.Scopes,
                    team.Phases,
                    categoryName,
                    team.TeamKey);
                var totalValuation = totalValuationByTeam.GetValueOrDefault(team.TeamKey);

                if (!string.IsNullOrWhiteSpace(categoryName))
                {
                    entity.Categories.Add(categoryName);
                }

                if (!string.IsNullOrWhiteSpace(levelName))
                {
                    entity.Levels.Add(levelName);
                }

                entity.SeasonSummaries.Add(new HistoricalTeamSeasonSummary
                {
                    Key = $"{entityKey}:{team.SeasonLabel}",
                    SeasonStartYear = team.SeasonStartYear,
                    SeasonLabel = team.SeasonLabel,
                    TeamIdExtern = team.TeamIdExtern,
                    TeamName = team.TeamName,
                    CategoryName = categoryName,
                    LevelName = levelName,
                    MatchesPlayed = team.MatchesPlayed,
                    PlayersCount = team.PlayersCount,
                    PointsFor = record.PointsFor,
                    PointsAgainst = record.PointsAgainst,
                    PointDiff = record.PointsFor - record.PointsAgainst,
                    Wins = record.Wins,
                    Losses = record.Losses,
                    Ties = record.Ties,
                    StandingPosition = standingPosition,
                    AvgValuation = team.MatchesPlayed > 0
                        ? (double)totalValuation / team.MatchesPlayed
                        : 0
                });
            }
        }

        return new HistoricalTeamDirectoryDataset
        {
            GeneratedAtUtc = generatedAtUtc,
            Teams = entities.Values
                .Select(entity =>
                {
                    var seasonSummaries = entity.SeasonSummaries
                        .OrderByDescending(season => season.SeasonStartYear ?? int.MinValue)
                        .ThenByDescending(season => season.SeasonLabel, EsComparer)
                        .ToList();
                    var latestSeason = seasonSummaries.FirstOrDefault();
                    var metaParts = new List<string>();

                    if (seasonSummaries.Count > 0)
                    {
                        metaParts.Add($"{seasonSummaries.Count} temporada{(seasonSummaries.Count == 1 ? "" : "s")}");
                    }

                    if (!string.IsNullOrWhiteSpace(latestSeason?.CategoryName))
                    {
                        metaParts.Add(latestSeason.CategoryName);
                    }

                    if (!string.IsNullOrWhiteSpace(latestSeason?.LevelName))
                    {
                        metaParts.Add(latestSeason.LevelName);
                    }

                    return new HistoricalTeamDirectoryEntry
                    {
                        Key = entity.Key,
                        Label = latestSeason?.TeamName ?? entity.Label,
                        LatestTeamIdExtern = latestSeason?.TeamIdExtern ?? 0,
                        Meta = string.Join(" · ", metaParts),
                        SearchText = string.Join(" ", entity.SearchTerms
                            .Concat(entity.Categories)
                            .Concat(entity.Levels)
                            .Where(value => !string.IsNullOrWhiteSpace(value))),
                        SeasonSummaries = seasonSummaries
                    };
                })
                .OrderBy(entity => entity.Label, EsComparer)
                .ToList()
        };
    }

    public static HistoricalPlayerDirectoryDataset BuildHistoricalPlayerDirectory(
        DateTime generatedAtUtc,
        IReadOnlyCollection<AnalysisResult> seasonAnalyses)
    {
        var entities = new Dictionary<string, MutableHistoricalPlayerEntity>(StringComparer.Ordinal);

        foreach (var analysis in seasonAnalyses)
        {
            foreach (var player in analysis.Competition.PlayerLeaders)
            {
                var entityKey = ResolveHistoricalPlayerKey(player);
                if (!entities.TryGetValue(entityKey, out var entity))
                {
                    entity = new MutableHistoricalPlayerEntity(entityKey, player.PlayerName);
                    entities[entityKey] = entity;
                }

                entity.SearchTerms.Add(player.PlayerName);
                entity.SearchTerms.Add(player.TeamName);

                var seasonKey = NormalizeValue(player.SeasonLabel);
                if (!entity.SeasonMap.TryGetValue(seasonKey, out var seasonSummary))
                {
                    seasonSummary = new MutableHistoricalPlayerSeasonSummary(
                        player.SeasonStartYear,
                        player.SeasonLabel,
                        player.PlayerName);
                    entity.SeasonMap[seasonKey] = seasonSummary;
                }

                seasonSummary.Games += player.Games;
                seasonSummary.Points += player.Points;
                seasonSummary.Valuation += player.Valuation;
                seasonSummary.Fouls += player.Fouls;
                seasonSummary.Minutes += player.Minutes;
                seasonSummary.PlayerName = string.IsNullOrWhiteSpace(player.PlayerName)
                    ? seasonSummary.PlayerName
                    : player.PlayerName;
                IncrementCounter(seasonSummary.ShirtNumbers, player.ShirtNumber, player.Games);

                if (!seasonSummary.Teams.TryGetValue(player.TeamKey, out var teamSummary))
                {
                    teamSummary = new MutableHistoricalPlayerTeamSummary(
                        player.TeamKey,
                        player.TeamName,
                        player.TeamIdExtern);
                    seasonSummary.Teams[player.TeamKey] = teamSummary;
                }

                teamSummary.Games += player.Games;
            }
        }

        return new HistoricalPlayerDirectoryDataset
        {
            GeneratedAtUtc = generatedAtUtc,
            Players = entities.Values
                .Select(entity =>
                {
                    var seasonSummaries = entity.SeasonMap.Values
                        .Select(summary =>
                        {
                            var teams = summary.Teams.Values
                                .OrderByDescending(team => team.Games)
                                .ThenBy(team => team.TeamName, EsComparer)
                                .ToList();
                            var teamNames = teams
                                .Select(team => team.TeamName)
                                .Where(name => !string.IsNullOrWhiteSpace(name))
                                .ToList();

                            return new HistoricalPlayerSeasonSummary
                            {
                                Key = $"{entity.Key}:{summary.SeasonLabel}",
                                SeasonStartYear = summary.SeasonStartYear,
                                SeasonLabel = summary.SeasonLabel,
                                PlayerName = summary.PlayerName,
                                ShirtNumber = ResolveDominantCounterValue(summary.ShirtNumbers),
                                Games = summary.Games,
                                Points = summary.Points,
                                Valuation = summary.Valuation,
                                Fouls = summary.Fouls,
                                Minutes = summary.Minutes,
                                AvgPoints = summary.Games > 0 ? (double)summary.Points / summary.Games : 0,
                                AvgValuation = summary.Games > 0 ? (double)summary.Valuation / summary.Games : 0,
                                AvgFouls = summary.Games > 0 ? (double)summary.Fouls / summary.Games : 0,
                                AvgMinutes = summary.Games > 0 ? (double)summary.Minutes / summary.Games : 0,
                                TeamNames = teamNames,
                                PrimaryTeamName = teamNames.FirstOrDefault() ?? "",
                                PrimaryTeamKey = teams.FirstOrDefault()?.TeamKey ?? "",
                                PrimaryTeamIdExtern = teams.FirstOrDefault()?.TeamIdExtern ?? 0
                            };
                        })
                        .OrderByDescending(summary => summary.SeasonStartYear ?? int.MinValue)
                        .ThenByDescending(summary => summary.SeasonLabel, EsComparer)
                        .ToList();

                    var totalGames = seasonSummaries.Sum(summary => summary.Games);
                    var totalPoints = seasonSummaries.Sum(summary => summary.Points);
                    var totalValuation = seasonSummaries.Sum(summary => summary.Valuation);
                    var totalFouls = seasonSummaries.Sum(summary => summary.Fouls);
                    var totalMinutes = seasonSummaries.Sum(summary => summary.Minutes);
                    var latestSeason = seasonSummaries.FirstOrDefault();
                    var metaParts = new List<string>();

                    if (seasonSummaries.Count > 0)
                    {
                        metaParts.Add($"{seasonSummaries.Count} temporada{(seasonSummaries.Count == 1 ? "" : "s")}");
                    }

                    if (!string.IsNullOrWhiteSpace(latestSeason?.ShirtNumber))
                    {
                        metaParts.Add($"#{latestSeason.ShirtNumber}");
                    }

                    if (!string.IsNullOrWhiteSpace(latestSeason?.PrimaryTeamName))
                    {
                        metaParts.Add(latestSeason.PrimaryTeamName);
                    }

                    return new HistoricalPlayerDirectoryEntry
                    {
                        Key = entity.Key,
                        Label = latestSeason?.PlayerName ?? entity.Label,
                        LatestShirtNumber = latestSeason?.ShirtNumber ?? "",
                        Meta = string.Join(" · ", metaParts),
                        SearchText = string.Join(" ", entity.SearchTerms
                            .Concat(!string.IsNullOrWhiteSpace(latestSeason?.ShirtNumber)
                                ? [$"#{latestSeason!.ShirtNumber}"]
                                : [])
                            .Where(value => !string.IsNullOrWhiteSpace(value))),
                        Totals = new HistoricalPlayerTotals
                        {
                            Seasons = seasonSummaries.Count,
                            Games = totalGames,
                            Points = totalPoints,
                            Valuation = totalValuation,
                            Fouls = totalFouls,
                            Minutes = totalMinutes,
                            AvgPoints = totalGames > 0 ? (double)totalPoints / totalGames : 0,
                            AvgValuation = totalGames > 0 ? (double)totalValuation / totalGames : 0,
                            AvgFouls = totalGames > 0 ? (double)totalFouls / totalGames : 0,
                            AvgMinutes = totalGames > 0 ? (double)totalMinutes / totalGames : 0
                        },
                        SeasonSummaries = seasonSummaries
                    };
                })
                .OrderBy(entity => entity.Label, EsComparer)
                .ToList()
        };
    }

    private static IReadOnlyDictionary<string, List<CompetitionMatch>> BuildMatchesByTeamKey(IEnumerable<CompetitionMatch> matches)
    {
        var matchesByTeamKey = new Dictionary<string, List<CompetitionMatch>>(StringComparer.Ordinal);

        foreach (var match in matches)
        {
            AddMatch(matchesByTeamKey, match.HomeTeamKey, match);
            AddMatch(matchesByTeamKey, match.AwayTeamKey, match);
        }

        return matchesByTeamKey;
    }

    private static void AddMatch(
        IDictionary<string, List<CompetitionMatch>> matchesByTeamKey,
        string teamKey,
        CompetitionMatch match)
    {
        if (string.IsNullOrWhiteSpace(teamKey))
        {
            return;
        }

        if (!matchesByTeamKey.TryGetValue(teamKey, out var matches))
        {
            matches = [];
            matchesByTeamKey[teamKey] = matches;
        }

        matches.Add(match);
    }

    private static ClubTeamEntryRecord BuildTeamRecord(IEnumerable<CompetitionMatch> matches, string teamKey)
    {
        var wins = 0;
        var losses = 0;
        var ties = 0;
        var pointsFor = 0;
        var pointsAgainst = 0;

        foreach (var match in matches)
        {
            var isHome = string.Equals(match.HomeTeamKey, teamKey, StringComparison.Ordinal);
            var teamScore = isHome ? match.HomeScore : match.AwayScore;
            var rivalScore = isHome ? match.AwayScore : match.HomeScore;

            if (teamScore > rivalScore)
            {
                wins += 1;
            }
            else if (teamScore < rivalScore)
            {
                losses += 1;
            }
            else
            {
                ties += 1;
            }

            pointsFor += teamScore;
            pointsAgainst += rivalScore;
        }

        return new ClubTeamEntryRecord
        {
            Wins = wins,
            Losses = losses,
            Ties = ties,
            PointsFor = pointsFor,
            PointsAgainst = pointsAgainst
        };
    }

    private static List<ClubCategoryGroup> FinalizeClubCategories(IEnumerable<ClubTeamEntry> teamEntries)
    {
        var categories = new Dictionary<string, Dictionary<string, List<ClubTeamEntry>>>(StringComparer.Ordinal);
        var levelLabels = new Dictionary<(string CategoryName, string LevelKey), string>();

        foreach (var team in teamEntries)
        {
            var categoryName = string.IsNullOrWhiteSpace(team.CategoryName)
                ? "Sin categoria visible"
                : team.CategoryName.Trim();
            var levelKey = string.IsNullOrWhiteSpace(team.LevelKey)
                ? "__no-level__"
                : team.LevelKey.Trim();
            var levelName = string.IsNullOrWhiteSpace(team.LevelName)
                ? "Sin nivel visible"
                : team.LevelName.Trim();

            if (!categories.TryGetValue(categoryName, out var levels))
            {
                levels = new Dictionary<string, List<ClubTeamEntry>>(StringComparer.Ordinal);
                categories[categoryName] = levels;
            }

            if (!levels.TryGetValue(levelKey, out var levelTeams))
            {
                levelTeams = [];
                levels[levelKey] = levelTeams;
            }

            levelLabels[(categoryName, levelKey)] = levelName;
            levelTeams.Add(team);
        }

        return categories
            .OrderBy(entry => entry.Key, EsComparer)
            .Select(category => new ClubCategoryGroup
            {
                CategoryName = category.Key,
                Levels = category.Value
                    .OrderBy(level => NormalizeLevelNameForSort(levelLabels[(category.Key, level.Key)], level.Key), EsComparer)
                    .Select(level => new ClubLevelGroup
                    {
                        LevelKey = level.Key,
                        LevelName = levelLabels[(category.Key, level.Key)],
                        Teams = level.Value
                            .OrderBy(team => team.GroupCode, EsComparer)
                            .ThenBy(team => team.TeamName, EsComparer)
                            .ToList()
                    })
                    .ToList()
            })
            .ToList();
    }

    private static int? ResolveStandingPosition(
        IEnumerable<CompetitionStandingScope> scopes,
        IEnumerable<TeamPhaseInfo> phases,
        string fallbackCategoryName,
        string teamKey)
    {
        var scopeKeys = phases
            .Select(phase => BuildPhaseScopeKey(
                phase.SeasonLabel,
                phase.SourcePhaseId,
                phase.PhaseNumber,
                phase.CategoryName,
                phase.PhaseName,
                phase.LevelName,
                phase.LevelCode,
                phase.GroupCode))
            .Where(key => !string.IsNullOrWhiteSpace(key))
            .ToHashSet(StringComparer.Ordinal);

        var relevantRows = scopeKeys.Count > 0
            ? scopes.Where(scope => scopeKeys.Contains(scope.Key)).SelectMany(scope => scope.Rows)
            : scopes
                .Where(scope => string.Equals(NormalizeValue(scope.CategoryName), fallbackCategoryName, StringComparison.Ordinal))
                .SelectMany(scope => scope.Rows);

        return AggregateStandingRows(relevantRows)
            .FirstOrDefault(row => string.Equals(row.TeamKey, teamKey, StringComparison.Ordinal))
            ?.Position;
    }

    private static List<CompetitionStandingRow> AggregateStandingRows(IEnumerable<CompetitionStandingRow> rows)
    {
        var aggregate = new Dictionary<string, MutableStandingRow>(StringComparer.Ordinal);

        foreach (var row in rows)
        {
            if (!aggregate.TryGetValue(row.TeamKey, out var current))
            {
                current = new MutableStandingRow(row.TeamKey, row.TeamName);
                aggregate[row.TeamKey] = current;
            }

            current.Played += row.Played;
            current.Wins += row.Wins;
            current.Losses += row.Losses;
            current.Ties += row.Ties;
            current.PointsFor += row.PointsFor;
            current.PointsAgainst += row.PointsAgainst;
        }

        return aggregate.Values
            .OrderByDescending(row => row.Wins)
            .ThenBy(row => row.Losses)
            .ThenByDescending(row => row.PointDiff)
            .ThenByDescending(row => row.PointsFor)
            .ThenBy(row => row.TeamName, EsComparer)
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

    private static List<CompetitionStandingRow> BuildCompetitionStandingRows(IEnumerable<CompetitionMatch> matches)
    {
        var rows = new Dictionary<string, MutableStandingRow>(StringComparer.Ordinal);

        foreach (var match in matches)
        {
            var home = GetOrCreateStandingRow(rows, match.HomeTeamKey, match.HomeTeam);
            var away = GetOrCreateStandingRow(rows, match.AwayTeamKey, match.AwayTeam);

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

        return AggregateStandingRows(rows.Values.Select(row => new CompetitionStandingRow
        {
            TeamKey = row.TeamKey,
            TeamName = row.TeamName,
            Played = row.Played,
            Wins = row.Wins,
            Losses = row.Losses,
            Ties = row.Ties,
            PointsFor = row.PointsFor,
            PointsAgainst = row.PointsAgainst,
            PointDiff = row.PointDiff
        }));
    }

    private static MutableStandingRow GetOrCreateStandingRow(
        IDictionary<string, MutableStandingRow> rows,
        string teamKey,
        string teamName)
    {
        if (!rows.TryGetValue(teamKey, out var row))
        {
            row = new MutableStandingRow(teamKey, teamName);
            rows[teamKey] = row;
        }

        return row;
    }

    private static string BuildPhaseScopeKey(
        string? seasonLabel,
        int? sourcePhaseId,
        int phaseNumber,
        string? categoryName,
        string? phaseName,
        string? levelName,
        string? levelCode,
        string? groupCode)
    {
        var normalizedSeasonLabel = NormalizeValue(seasonLabel);
        if (sourcePhaseId is > 0)
        {
            return $"source:{normalizedSeasonLabel}:{sourcePhaseId}";
        }

        var levelKey = NormalizeLevelKey(levelCode, levelName);
        return $"phase:{normalizedSeasonLabel}|{phaseNumber}|{NormalizeValue(categoryName)}|{levelKey}|{NormalizeValue(groupCode)}|{NormalizeValue(phaseName)}";
    }

    private static string BuildCompetitionPhaseLabel(TeamPhaseInfo? phase)
    {
        if (phase is null)
        {
            return "";
        }

        var phaseName = NormalizeValue(phase.PhaseName);
        if (string.IsNullOrWhiteSpace(phaseName))
        {
            phaseName = $"Fase {phase.PhaseNumber}";
        }

        var extras = new List<string>();
        var levelName = NormalizeValue(phase.LevelName);
        if (!string.IsNullOrWhiteSpace(levelName))
        {
            extras.Add(levelName);
        }

        var groupCode = NormalizeValue(phase.GroupCode);
        if (!string.IsNullOrWhiteSpace(groupCode))
        {
            extras.Add($"Grupo {groupCode}");
        }

        return extras.Count > 0
            ? $"{phaseName} · {string.Join(" · ", extras)}"
            : phaseName;
    }

    private static void IncrementCounter(IDictionary<string, int> counter, string? rawValue, int weight)
    {
        var value = NormalizeValue(rawValue);
        if (string.IsNullOrWhiteSpace(value))
        {
            return;
        }

        var normalizedWeight = weight > 0 ? weight : 1;
        counter[value] = counter.TryGetValue(value, out var currentValue)
            ? currentValue + normalizedWeight
            : normalizedWeight;
    }

    private static string ResolveDominantCounterValue(IReadOnlyDictionary<string, int> counter)
    {
        return counter.Count == 0
            ? ""
            : counter
                .OrderByDescending(entry => entry.Value)
                .ThenBy(entry => entry.Key, EsComparer)
                .First()
                .Key;
    }

    private static string ResolveHistoricalPlayerKey(CompetitionPlayerLeader player)
    {
        if (!string.IsNullOrWhiteSpace(player.PlayerIdentityKey))
        {
            return player.PlayerIdentityKey.Trim();
        }

        if (!string.IsNullOrWhiteSpace(player.PlayerUuid))
        {
            return $"UUID:{player.PlayerUuid.Trim().ToLowerInvariant()}";
        }

        if (player.PlayerActorId > 0)
        {
            return $"PLAYER:{player.PlayerActorId}";
        }

        return $"NAME:{NormalizeLookupValue(player.PlayerName).ToLowerInvariant()}";
    }

    private static string NormalizeLevelKey(string? levelCode, string? levelName)
    {
        var normalizedLevelCode = NormalizeValue(levelCode);
        return !string.IsNullOrWhiteSpace(normalizedLevelCode)
            ? normalizedLevelCode
            : NormalizeValue(levelName);
    }

    private static string NormalizeLevelNameForSort(string? levelName, string? levelKey)
    {
        var value = !string.IsNullOrWhiteSpace(levelName)
            ? levelName!
            : levelKey ?? "";
        return Regex.Replace(value, @"^nivell\s+", "", RegexOptions.IgnoreCase).Trim();
    }

    private static string NormalizeTeamName(string? value)
    {
        return NormalizeLookupValue(value)
            .Replace(" ", "", StringComparison.Ordinal)
            .Length == 0
            ? ""
            : NormalizeLookupValue(value);
    }

    private static string NormalizeLookupValue(string? value)
    {
        var normalized = RemoveDiacritics(value)
            .Trim()
            .ToUpperInvariant();

        normalized = Regex.Replace(normalized, @"[^A-Z0-9]+", " ");
        normalized = Regex.Replace(normalized, @"\s+", " ");
        return normalized.Trim();
    }

    private static string NormalizeValue(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? ""
            : value.Trim();
    }

    private static string RemoveDiacritics(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return "";
        }

        var normalized = value.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(normalized.Length);

        foreach (var character in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(character) != UnicodeCategory.NonSpacingMark)
            {
                builder.Append(character);
            }
        }

        return builder.ToString().Normalize(NormalizationForm.FormC);
    }

    private sealed record StandingScopeKey(
        int? SeasonStartYear,
        string SeasonLabel,
        int? SourcePhaseId,
        int PhaseNumber,
        string CategoryName,
        string PhaseName,
        string LevelName,
        string LevelCode,
        string GroupCode);

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

    private sealed class MutableClubEntity
    {
        public MutableClubEntity(string key, string label, string shortName, int clubId, int primaryTeamIdExtern)
        {
            Key = key;
            Label = label;
            ShortName = shortName;
            ClubId = clubId;
            PrimaryTeamIdExtern = primaryTeamIdExtern;
            SearchTerms = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                label,
                shortName
            };
            Categories = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            Levels = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            TeamEntries = [];
        }

        public string Key { get; }
        public string Label { get; }
        public string ShortName { get; }
        public int ClubId { get; }
        public int PrimaryTeamIdExtern { get; set; }
        public HashSet<string> SearchTerms { get; }
        public HashSet<string> Categories { get; }
        public HashSet<string> Levels { get; }
        public List<ClubTeamEntry> TeamEntries { get; }
    }

    private sealed class MutableHistoricalTeamEntity
    {
        public MutableHistoricalTeamEntity(string key, string label)
        {
            Key = key;
            Label = label;
            SearchTerms = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            Categories = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            Levels = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            SeasonSummaries = [];
        }

        public string Key { get; }
        public string Label { get; }
        public HashSet<string> SearchTerms { get; }
        public HashSet<string> Categories { get; }
        public HashSet<string> Levels { get; }
        public List<HistoricalTeamSeasonSummary> SeasonSummaries { get; }
    }

    private sealed class MutableHistoricalPlayerEntity
    {
        public MutableHistoricalPlayerEntity(string key, string label)
        {
            Key = key;
            Label = label;
            SearchTerms = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            SeasonMap = new Dictionary<string, MutableHistoricalPlayerSeasonSummary>(StringComparer.OrdinalIgnoreCase);
        }

        public string Key { get; }
        public string Label { get; }
        public HashSet<string> SearchTerms { get; }
        public Dictionary<string, MutableHistoricalPlayerSeasonSummary> SeasonMap { get; }
    }

    private sealed class MutableHistoricalPlayerSeasonSummary
    {
        public MutableHistoricalPlayerSeasonSummary(int? seasonStartYear, string seasonLabel, string playerName)
        {
            SeasonStartYear = seasonStartYear;
            SeasonLabel = seasonLabel;
            PlayerName = playerName;
            ShirtNumbers = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            Teams = new Dictionary<string, MutableHistoricalPlayerTeamSummary>(StringComparer.Ordinal);
        }

        public int? SeasonStartYear { get; }
        public string SeasonLabel { get; }
        public string PlayerName { get; set; }
        public int Games { get; set; }
        public int Points { get; set; }
        public int Valuation { get; set; }
        public int Fouls { get; set; }
        public int Minutes { get; set; }
        public Dictionary<string, int> ShirtNumbers { get; }
        public Dictionary<string, MutableHistoricalPlayerTeamSummary> Teams { get; }
    }

    private sealed class MutableHistoricalPlayerTeamSummary
    {
        public MutableHistoricalPlayerTeamSummary(string teamKey, string teamName, int teamIdExtern)
        {
            TeamKey = teamKey;
            TeamName = teamName;
            TeamIdExtern = teamIdExtern;
        }

        public string TeamKey { get; }
        public string TeamName { get; }
        public int TeamIdExtern { get; }
        public int Games { get; set; }
    }

    private sealed class ClubBrandingResolver
    {
        private static readonly Regex SplitCandidateRegex = new(@"\s+-\s+|/|\||,|\(|\)", RegexOptions.Compiled);
        private static readonly Regex ClubMarkerRegex = new(@"\b(AE|AB|BC|BF|CB|CE|UE|BASQUET|BASKET|JET|SESE|AESE|LLUISOS|MANYANET)\b", RegexOptions.Compiled);
        private static readonly Regex DerivedClubSuffixRegex = new(
            @"\b(U\d{1,2}|PR[0-9A-Z]*|J[0-9A-Z]*|C[0-9A-Z]*|I[0-9A-Z]*|SF|JF|CF|IF|1ER ANY|2N ANY|3ER ANY|MINI|PREMINI|SOTS ?\d+)\b.*$",
            RegexOptions.Compiled | RegexOptions.IgnoreCase);
        private static readonly Regex DerivedTrailingVariantRegex = new(
            @"(?:\s+|^)(A|B|C|D|VERMELL|VERMELLA|NEGRE|NEGRA|VERD|VERDA|GROC|GROGA|BLAU|BLAUA|LILA|TARONJA|ROSA|BLANC|BLANCA)\s*$",
            RegexOptions.Compiled | RegexOptions.IgnoreCase);
        private static readonly HashSet<string> ClubTokenStopWords = new(StringComparer.Ordinal)
        {
            "A",
            "AB",
            "ADB",
            "AE",
            "AESE",
            "ANY",
            "ASSOCIACIO",
            "ATENEU",
            "B",
            "BASQUET",
            "BASQUETB",
            "BASQUETBOL",
            "BASKET",
            "BC",
            "BF",
            "BLAU",
            "BLAUA",
            "BLANC",
            "BLANCA",
            "C",
            "CADET",
            "CB",
            "CE",
            "CLUB",
            "CLUBS",
            "D",
            "DE",
            "DEL",
            "EL",
            "ESCOLA",
            "ESPORTIVA",
            "FEMENI",
            "GROC",
            "GROGA",
            "I",
            "INFANTIL",
            "JET",
            "JUNIOR",
            "L",
            "LA",
            "LES",
            "LILA",
            "MASCULI",
            "MINI",
            "NEGRE",
            "NEGRA",
            "NIVELL",
            "PREMINI",
            "PROMOCIO",
            "QUARTA",
            "ROSA",
            "SENIOR",
            "SEGONA",
            "SESE",
            "TERCERA",
            "TARONJA",
            "U",
            "UE",
            "VERD",
            "VERDA",
            "VERMELL",
            "VERMELLA",
            "Y"
        };

        private readonly IReadOnlyDictionary<string, string> _teamClubMap;
        private readonly IReadOnlyDictionary<string, ClubBrandingCatalogEntry> _clubsByKey;
        private readonly IReadOnlyDictionary<string, ClubBrandingCatalogEntry> _clubsByAlias;
        private readonly IReadOnlyList<ClubSearchEntry> _searchEntries;
        private readonly IReadOnlyDictionary<string, HashSet<string>> _singleTokenClubKeys;

        private ClubBrandingResolver(
            IReadOnlyDictionary<string, string> teamClubMap,
            IReadOnlyDictionary<string, ClubBrandingCatalogEntry> clubsByKey,
            IReadOnlyDictionary<string, ClubBrandingCatalogEntry> clubsByAlias,
            IReadOnlyList<ClubSearchEntry> searchEntries,
            IReadOnlyDictionary<string, HashSet<string>> singleTokenClubKeys)
        {
            _teamClubMap = teamClubMap;
            _clubsByKey = clubsByKey;
            _clubsByAlias = clubsByAlias;
            _searchEntries = searchEntries;
            _singleTokenClubKeys = singleTokenClubKeys;
        }

        public static ClubBrandingResolver Load(string repoRoot)
        {
            var dataDir = Path.Combine(repoRoot, "barna-stats-webapp", "src", "data");
            var generatedTeamClubMap = ParseGeneratedJs<Dictionary<string, string>>(
                                           Path.Combine(dataDir, "teamClubMap.generated.js"),
                                           "TEAM_CLUB_MAP")
                                       ?? new Dictionary<string, string>(StringComparer.Ordinal);
            var generatedClubCatalog = ParseGeneratedJs<List<ClubBrandingCatalogEntry>>(
                                           Path.Combine(dataDir, "clubBrandingCatalog.generated.js"),
                                           "CLUB_BRANDING_CATALOG")
                                       ?? [];
            var supplemental = LoadJson<ClubBrandingSupplementalData>(
                Path.Combine(dataDir, "clubBrandingSupplemental.json"))
                               ?? new ClubBrandingSupplementalData();

            var teamClubMap = new Dictionary<string, string>(generatedTeamClubMap, StringComparer.Ordinal);
            foreach (var entry in supplemental.TeamClubMap)
            {
                teamClubMap[entry.Key] = entry.Value;
            }

            var clubCatalog = generatedClubCatalog
                .Concat(supplemental.Clubs ?? [])
                .Where(entry => !string.IsNullOrWhiteSpace(entry.ClubKey))
                .GroupBy(entry => entry.ClubKey, StringComparer.Ordinal)
                .Select(MergeClubEntries)
                .ToList();

            var clubsByKey = clubCatalog
                .ToDictionary(entry => entry.ClubKey, entry => entry, StringComparer.Ordinal);
            var clubsByAlias = new Dictionary<string, ClubBrandingCatalogEntry>(StringComparer.Ordinal);
            var searchEntries = new List<ClubSearchEntry>();
            var singleTokenClubKeys = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal);

            foreach (var club in clubCatalog)
            {
                foreach (var alias in new[] { club.ClubName, club.ShortName }.Concat(club.Aliases ?? []))
                {
                    var normalizedAlias = NormalizeLookupValue(alias);
                    if (string.IsNullOrWhiteSpace(normalizedAlias))
                    {
                        continue;
                    }

                    if (!clubsByAlias.ContainsKey(normalizedAlias))
                    {
                        clubsByAlias[normalizedAlias] = club;
                    }

                    var tokens = BuildSignificantTokens(normalizedAlias);
                    searchEntries.Add(new ClubSearchEntry(club, normalizedAlias, tokens));

                    if (tokens.Count == 1)
                    {
                        var token = tokens[0];
                        if (!singleTokenClubKeys.TryGetValue(token, out var clubKeys))
                        {
                            clubKeys = new HashSet<string>(StringComparer.Ordinal);
                            singleTokenClubKeys[token] = clubKeys;
                        }

                        clubKeys.Add(club.ClubKey);
                    }
                }
            }

            return new ClubBrandingResolver(teamClubMap, clubsByKey, clubsByAlias, searchEntries, singleTokenClubKeys);
        }

        public ClubBrandingCatalogEntry Resolve(int teamIdExtern, string teamName)
        {
            if (teamIdExtern > 0 && _teamClubMap.TryGetValue(teamIdExtern.ToString(CultureInfo.InvariantCulture), out var clubKey))
            {
                var mappedClub = _clubsByKey.GetValueOrDefault(clubKey);
                if (mappedClub is not null)
                {
                    return mappedClub;
                }
            }

            return ResolveOfficialByName(teamName) ?? BuildDerivedClub(teamName);
        }

        private ClubBrandingCatalogEntry? ResolveOfficialByName(string teamName)
        {
            var exactMatch = ResolveByAlias(teamName);
            if (exactMatch is not null)
            {
                return exactMatch;
            }

            return ResolveByTokens(teamName);
        }

        private ClubBrandingCatalogEntry? ResolveByAlias(string teamName)
        {
            ClubBrandingCatalogEntry? bestMatch = null;
            var bestScore = -1;

            foreach (var candidate in BuildLookupCandidates(teamName))
            {
                if (_clubsByAlias.TryGetValue(candidate, out var exactMatch))
                {
                    return exactMatch;
                }

                foreach (var aliasEntry in _clubsByAlias)
                {
                    if (aliasEntry.Key.Length < 6)
                    {
                        continue;
                    }

                    if (string.Equals(candidate, aliasEntry.Key, StringComparison.Ordinal)
                        || candidate.StartsWith($"{aliasEntry.Key} ", StringComparison.Ordinal)
                        || aliasEntry.Key.StartsWith($"{candidate} ", StringComparison.Ordinal))
                    {
                        if (aliasEntry.Key.Length > bestScore)
                        {
                            bestScore = aliasEntry.Key.Length;
                            bestMatch = aliasEntry.Value;
                        }
                    }
                }
            }

            return bestMatch;
        }

        private ClubBrandingCatalogEntry? ResolveByTokens(string teamName)
        {
            var teamTokens = BuildLookupCandidates(teamName)
                .SelectMany(BuildSignificantTokens)
                .Distinct(StringComparer.Ordinal)
                .ToArray();
            if (teamTokens.Length == 0)
            {
                return null;
            }

            ClubBrandingCatalogEntry? bestMatch = null;
            var bestScore = int.MinValue;
            var bestOverlapCount = -1;
            var bestAliasTokenCount = -1;

            foreach (var searchEntry in _searchEntries)
            {
                if (searchEntry.Tokens.Count == 0)
                {
                    continue;
                }

                var overlapTokens = searchEntry.Tokens
                    .Where(token => teamTokens.Contains(token, StringComparer.Ordinal))
                    .Distinct(StringComparer.Ordinal)
                    .ToArray();
                if (overlapTokens.Length == 0)
                {
                    continue;
                }

                var allAliasTokensInTeam = searchEntry.Tokens.All(token => teamTokens.Contains(token, StringComparer.Ordinal));
                var coverageAlias = (double)overlapTokens.Length / searchEntry.Tokens.Count;
                var coverageTeam = (double)overlapTokens.Length / teamTokens.Length;
                var hasUniqueSingleTokenMatch = overlapTokens.Length == 1
                                                && searchEntry.Tokens.Count == 1
                                                && overlapTokens[0].Length >= 7
                                                && _singleTokenClubKeys.TryGetValue(overlapTokens[0], out var clubKeys)
                                                && clubKeys.Count == 1
                                                && !teamTokens.Any(token => token.Length >= 4
                                                                            && !searchEntry.Tokens.Contains(token, StringComparer.Ordinal));
                var strongMatch = (overlapTokens.Length >= 2 && allAliasTokensInTeam)
                                  || (overlapTokens.Length >= 2 && coverageAlias >= 0.75 && coverageTeam >= 0.4)
                                  || hasUniqueSingleTokenMatch;
                if (!strongMatch)
                {
                    continue;
                }

                var overlapLength = overlapTokens.Sum(token => token.Length);
                var score = (allAliasTokensInTeam ? 100 : 0)
                            + overlapTokens.Length * 20
                            + overlapLength
                            + (int)Math.Round(coverageAlias * 10)
                            + (int)Math.Round(coverageTeam * 5)
                            - searchEntry.Tokens.Count;

                if (score > bestScore
                    || (score == bestScore && overlapTokens.Length > bestOverlapCount)
                    || (score == bestScore && overlapTokens.Length == bestOverlapCount && searchEntry.Tokens.Count > bestAliasTokenCount))
                {
                    bestMatch = searchEntry.Club;
                    bestScore = score;
                    bestOverlapCount = overlapTokens.Length;
                    bestAliasTokenCount = searchEntry.Tokens.Count;
                }
            }

            return bestMatch;
        }

        private static ClubBrandingCatalogEntry BuildDerivedClub(string teamName)
        {
            var fallbackLabel = BuildDerivedClubLabel(teamName);
            var normalizedKey = NormalizeLookupValue(fallbackLabel);
            if (string.IsNullOrWhiteSpace(normalizedKey))
            {
                normalizedKey = "EQUIPO";
                fallbackLabel = NormalizeValue(teamName);
            }

            var clubKey = $"derived-club:{normalizedKey.ToLowerInvariant().Replace(" ", "-", StringComparison.Ordinal)}";
            return new ClubBrandingCatalogEntry
            {
                ClubKey = clubKey,
                ClubId = 0,
                ClubName = fallbackLabel,
                ShortName = fallbackLabel,
                Aliases = [fallbackLabel]
            };
        }

        private static string BuildDerivedClubLabel(string teamName)
        {
            var rawParts = SplitCandidateRegex.Split(NormalizeValue(teamName))
                .Select(NormalizeValue)
                .Where(part => !string.IsNullOrWhiteSpace(part))
                .ToArray();
            if (rawParts.Length == 0)
            {
                return NormalizeValue(teamName);
            }

            var bestPart = rawParts
                .OrderByDescending(ScoreDerivedClubPart)
                .ThenByDescending(part => part.Length)
                .First();
            var cleaned = bestPart;

            while (!string.IsNullOrWhiteSpace(cleaned))
            {
                var next = DerivedClubSuffixRegex.Replace(cleaned, "").Trim().Trim('-', '/', '|');
                next = DerivedTrailingVariantRegex.Replace(next, "").Trim().Trim('-', '/', '|');
                if (string.Equals(next, cleaned, StringComparison.Ordinal))
                {
                    break;
                }

                cleaned = next;
            }

            return string.IsNullOrWhiteSpace(cleaned) ? bestPart : cleaned;
        }

        private static int ScoreDerivedClubPart(string value)
        {
            var normalized = NormalizeLookupValue(value);
            if (string.IsNullOrWhiteSpace(normalized))
            {
                return 0;
            }

            var tokens = BuildSignificantTokens(normalized);
            return (ClubMarkerRegex.IsMatch(normalized) ? 25 : 0)
                   + tokens.Count * 8
                   + tokens.Sum(token => Math.Min(token.Length, 10))
                   + Math.Min(normalized.Length, 20);
        }

        private static IReadOnlyList<string> BuildLookupCandidates(string rawValue)
        {
            var expanded = new HashSet<string>(StringComparer.Ordinal);
            var initial = NormalizeValue(rawValue);

            if (!string.IsNullOrWhiteSpace(initial))
            {
                expanded.Add(initial);
            }

            foreach (var part in SplitCandidateRegex.Split(initial))
            {
                var trimmed = NormalizeValue(part);
                if (!string.IsNullOrWhiteSpace(trimmed))
                {
                    expanded.Add(trimmed);
                }
            }

            var candidates = new HashSet<string>(StringComparer.Ordinal);
            foreach (var entry in expanded)
            {
                var normalized = NormalizeLookupValue(entry);
                if (string.IsNullOrWhiteSpace(normalized))
                {
                    continue;
                }

                candidates.Add(normalized);

                var withoutTrailingLetter = TrailingLetterRegex.Replace(normalized, "").Trim();
                if (!string.IsNullOrWhiteSpace(withoutTrailingLetter))
                {
                    candidates.Add(withoutTrailingLetter);
                }

                var withoutSuffix = TeamSuffixRegex.Replace(normalized, "").Trim();
                if (!string.IsNullOrWhiteSpace(withoutSuffix))
                {
                    candidates.Add(withoutSuffix);
                }
            }

            return [.. candidates];
        }

        private static List<string> BuildSignificantTokens(string value)
        {
            return NormalizeLookupValue(value)
                .Split(' ', StringSplitOptions.RemoveEmptyEntries)
                .Where(token => token.Length > 1
                                && !Regex.IsMatch(token, @"^\d+$", RegexOptions.None)
                                && !ClubTokenStopWords.Contains(token))
                .Distinct(StringComparer.Ordinal)
                .ToList();
        }

        private static ClubBrandingCatalogEntry MergeClubEntries(IGrouping<string, ClubBrandingCatalogEntry> group)
        {
            var entries = group.ToList();
            var primary = entries[0];
            var aliases = entries
                .SelectMany(entry => entry.Aliases ?? [])
                .Where(alias => !string.IsNullOrWhiteSpace(alias))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            return new ClubBrandingCatalogEntry
            {
                ClubKey = primary.ClubKey,
                ClubId = entries.Select(entry => entry.ClubId).FirstOrDefault(id => id > 0),
                ClubName = entries.Select(entry => NormalizeValue(entry.ClubName)).FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? "",
                ShortName = entries.Select(entry => NormalizeValue(entry.ShortName)).FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? "",
                Aliases = aliases
            };
        }

        private static T? ParseGeneratedJs<T>(string path, string exportName)
        {
            if (!File.Exists(path))
            {
                return default;
            }

            var content = File.ReadAllText(path).Trim();
            var prefix = $"export const {exportName} =";
            if (!content.StartsWith(prefix, StringComparison.Ordinal))
            {
                return default;
            }

            var payload = content[prefix.Length..].Trim();
            if (payload.EndsWith(';'))
            {
                payload = payload[..^1];
            }

            return JsonSerializer.Deserialize<T>(payload, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
        }

        private static T? LoadJson<T>(string path)
        {
            if (!File.Exists(path))
            {
                return default;
            }

            return JsonSerializer.Deserialize<T>(File.ReadAllText(path), new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
        }

        private sealed class ClubSearchEntry
        {
            public ClubSearchEntry(ClubBrandingCatalogEntry club, string alias, IReadOnlyList<string> tokens)
            {
                Club = club;
                Alias = alias;
                Tokens = tokens;
            }

            public ClubBrandingCatalogEntry Club { get; }
            public string Alias { get; }
            public IReadOnlyList<string> Tokens { get; }
        }
    }

    private sealed class ClubBrandingSupplementalData
    {
        public List<ClubBrandingCatalogEntry> Clubs { get; init; } = [];
        public Dictionary<string, string> TeamClubMap { get; init; } = new(StringComparer.Ordinal);
    }

    public sealed class ClubBrandingCatalogEntry
    {
        public string ClubKey { get; init; } = "";
        public int ClubId { get; init; }
        public string ClubName { get; init; } = "";
        public string ShortName { get; init; } = "";
        public List<string> Aliases { get; init; } = [];
    }
}
