using System.Globalization;
using System.Text.Json;
using GenerateAnalisys.Models;
using GenerateAnalisys.Utilities;

namespace GenerateAnalisys.Services;

public sealed class MatchAnalysisService
{
    private readonly IMatchReportService _matchReportService;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public MatchAnalysisService(IMatchReportService matchReportService)
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
            var match = JsonSerializer.Deserialize<StatsRoot>(json, JsonOptions);

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
            var cachedReportsByTeamIdExtern = new Dictionary<int, MatchReportResult?>();

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
                MatchReportResult? teamSpecificReport = null;
                if (team.TeamIdExtern > 0)
                {
                    if (!cachedReportsByTeamIdExtern.TryGetValue(team.TeamIdExtern, out teamSpecificReport))
                    {
                        teamSpecificReport = await _matchReportService.GetCachedAsync(
                            matchWebId,
                            json,
                            movesRaw,
                            team.TeamIdExtern);
                        cachedReportsByTeamIdExtern[team.TeamIdExtern] = teamSpecificReport;
                    }
                }

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
                    Insights = MatchInsightsBuilder.BuildMatchInsights(match, team, isHome, moves),
                    MatchReport = teamSpecificReport?.Summary ?? matchReport?.Summary ?? "",
                    MatchReportGeneratedAtUtc = teamSpecificReport?.GeneratedAtUtc ?? matchReport?.GeneratedAtUtc,
                    MatchReportModel = teamSpecificReport?.Model ?? matchReport?.Model ?? ""
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
            .Select(TeamAnalysisBuilder.BuildTeamAnalysis)
            .OrderBy(team => team.TeamName, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return new AnalysisResult
        {
            SeasonStartYear = CompetitionAnalysisBuilder.ResolveSingleSeasonStartYear(teamAnalyses),
            SeasonLabel = CompetitionAnalysisBuilder.ResolveSingleSeasonLabel(teamAnalyses),
            GeneratedAtUtc = DateTime.UtcNow,
            TotalMatches = processedMatches,
            Competition = CompetitionAnalysisBuilder.BuildCompetitionAnalysis(teamAnalyses),
            Teams = teamAnalyses
        };
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
            var metadata = JsonSerializer.Deserialize<PhaseMetadataFile>(json, JsonOptions);
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

    private sealed record StatsFileContext(
        string Path,
        int MatchWebId,
        PhaseMetadataFile? PhaseMetadata);
}

internal sealed class TeamAccumulator
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
