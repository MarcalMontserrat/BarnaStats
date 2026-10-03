using System.Globalization;
using System.Text.Json;
using GenerateAnalisys.Models;

namespace GenerateAnalisys.Services;

// Convierte el formato de msstats de 2026-2027 al formato antiguo (StatsRoot / MoveEvent) para que
// el análisis, los insights y los informes de IA sigan funcionando sin cambios.
internal static class MsStatsMatchAdapter
{
    private const int DefaultPeriodDurationMinutes = 10;

    // Mismo texto que traían las jugadas antiguas para cada `idMove` (= `eventSubTypeId` en el pbp nuevo).
    private static readonly Dictionary<int, string> MoveNamesBySubType = new()
    {
        [92] = "Cistella de 1",
        [93] = "Cistella de 2",
        [94] = "Cistella de 3",
        [96] = "Intent fallat de 1",
        [97] = "Intent fallat de 2",
        [98] = "Intent fallat de 3",
        [106] = "Pèrdua",
        [109] = "Falta en atac",
        [112] = "Entra al camp",
        [113] = "Temps mort",
        [115] = "Surt del camp",
        [116] = "Final de període",
        [159] = "Personal",
        [160] = "Personal 1 tir lliure",
        [161] = "Personal 2 tirs lliures",
        [162] = "Personal 3 tirs lliures",
        [163] = "Personal TL Comp",
        [164] = "Personal sense falta d'equip",
        [166] = "Antiesportiva 2 tirs lliures",
        [174] = "Tècnica sense falta d'equip",
        [178] = "Salt guanyat",
        [179] = "Salt perdut",
        [540] = "Tècnica entrenador 1 tir lliure",
        [541] = "Tècnica entrenador 2 tirs lliures",
        [544] = "Tècnica banqueta 1 tir lliure"
    };

    // Faltas de jugadora: en el formato antiguo llevaban el sufijo ", Na falta".
    private static readonly HashSet<int> PlayerFoulSubTypes = [109, 159, 160, 161, 162, 163, 164, 166];
    private static readonly HashSet<string> SkippedEventCodes = new(StringComparer.OrdinalIgnoreCase) { "INIPER" };

    public static bool IsMsStatsMatchFormat(string statsRaw)
    {
        try
        {
            using var document = JsonDocument.Parse(statsRaw);
            var root = document.RootElement;
            return root.ValueKind == JsonValueKind.Object &&
                   root.TryGetProperty("header", out _) &&
                   root.TryGetProperty("boxscore", out _);
        }
        catch (JsonException)
        {
            return false;
        }
    }

    public static (StatsRoot Match, List<MoveEvent> Moves) Convert(
        string statsRaw,
        string? movesRaw,
        int? localTeamIdExtern,
        int? visitorTeamIdExtern)
    {
        var stats = JsonSerializer.Deserialize<MsStatsMatchStats>(statsRaw) ?? new MsStatsMatchStats();
        var playByPlay = TryDeserializePlayByPlay(movesRaw);
        var header = stats.Header ?? new MsStatsMatchHeader();
        var fullMatch = stats.Boxscore.FirstOrDefault(period => period.Period == 0);

        var localUuid = fullMatch?.Local?.Uuid ?? header.LocalTeam?.Uuid;
        var visitorUuid = fullMatch?.Visitor?.Uuid ?? header.VisitorTeam?.Uuid;
        var localId = ToStableInt(localUuid, fallback: 1);
        var visitorId = ToStableInt(visitorUuid, fallback: 2);
        if (visitorId == localId)
            visitorId += 1;

        var periodDurationMinutes = ResolvePeriodDurationMinutes(header, playByPlay);
        var scoreTimeline = BuildScoreTimeline(stats.ScoreEvolution, header.ResetScoreByPeriod, periodDurationMinutes);
        var stintsByPlayer = (stats.Stints?.Local ?? [])
            .Concat(stats.Stints?.Visitor ?? [])
            .Where(player => !string.IsNullOrWhiteSpace(player.Uuid))
            .GroupBy(player => player.Uuid!, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First().Stints, StringComparer.OrdinalIgnoreCase);

        var match = new StatsRoot
        {
            LocalId = localId,
            VisitId = visitorId,
            Time = NormalizeHeaderDate(header.Date),
            Period = header.RegulationPeriods ?? header.Periods.Count,
            PeriodDuration = periodDurationMinutes,
            Score = scoreTimeline.Select(point => point.Point).ToList(),
            Teams =
            [
                BuildTeam(fullMatch?.Local, header.LocalTeam, localId, localTeamIdExtern, isHome: true, stintsByPlayer, scoreTimeline),
                BuildTeam(fullMatch?.Visitor, header.VisitorTeam, visitorId, visitorTeamIdExtern, isHome: false, stintsByPlayer, scoreTimeline)
            ]
        };

        var teamIdsByUuid = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        if (!string.IsNullOrWhiteSpace(localUuid))
            teamIdsByUuid[localUuid] = localId;
        if (!string.IsNullOrWhiteSpace(visitorUuid))
            teamIdsByUuid[visitorUuid] = visitorId;

        var teamNamesById = match.Teams.ToDictionary(team => team.TeamIdIntern, team => team.Name ?? "");

        return (match, BuildMoves(playByPlay, header.ResetScoreByPeriod, teamIdsByUuid, teamNamesById));
    }

    private static TeamInfo BuildTeam(
        MsStatsBoxscoreTeam? boxscoreTeam,
        MsStatsTeamRef? headerTeam,
        int teamIdIntern,
        int? teamIdExtern,
        bool isHome,
        IReadOnlyDictionary<string, List<MsStatsStint>> stintsByPlayer,
        IReadOnlyList<TimelinePoint> scoreTimeline)
    {
        return new TeamInfo
        {
            TeamIdIntern = teamIdIntern,
            TeamIdExtern = teamIdExtern ?? 0,
            Name = boxscoreTeam?.Name ?? headerTeam?.Name,
            Data = BuildStatBlock(boxscoreTeam?.Accumulated),
            Players = (boxscoreTeam?.Players ?? [])
                .Select(player => new PlayerInfo
                {
                    ActorId = ToStableLong(player.Uuid),
                    Uuid = player.Uuid,
                    Name = player.Name,
                    Dorsal = player.Dorsal,
                    Starting = player.Starting,
                    TimePlayed = (int)Math.Round((player.Computed?.Seconds ?? 0) / 60.0, MidpointRounding.AwayFromZero),
                    InOut = player.Computed?.OnCourtPlusMinus ?? 0,
                    InOutsList = BuildInOutMarks(player.Uuid, isHome, stintsByPlayer, scoreTimeline),
                    Data = BuildStatBlock(player.Accumulated)
                })
                .ToList()
        };
    }

    private static StatBlock BuildStatBlock(MsStatsAccumulated? accumulated)
    {
        if (accumulated is null)
            return new StatBlock();

        var twoAttempted = Math.Max(accumulated.T2a ?? accumulated.T2m, accumulated.T2m);
        var threeAttempted = Math.Max(accumulated.T3a ?? accumulated.T3m, accumulated.T3m);

        return new StatBlock
        {
            Score = accumulated.Pts,
            // La fuente ya no publica la valoración. Con los datos que se registran (puntos, tiros y faltas),
            // la antigua salía de: puntos - tiros fallados - faltas cometidas.
            Valoration = accumulated.Pts
                         - (accumulated.Fta - accumulated.Ftm)
                         - (twoAttempted - accumulated.T2m)
                         - (threeAttempted - accumulated.T3m)
                         - accumulated.Fc,
            Faults = accumulated.Fc,
            ShotsOfOneAttempted = accumulated.Fta,
            ShotsOfOneSuccessful = accumulated.Ftm,
            ShotsOfTwoAttempted = twoAttempted,
            ShotsOfTwoSuccessful = accumulated.T2m,
            ShotsOfThreeAttempted = threeAttempted,
            ShotsOfThreeSuccessful = accumulated.T3m
        };
    }

    private static List<PlayerInOutMark> BuildInOutMarks(
        string? playerUuid,
        bool isHome,
        IReadOnlyDictionary<string, List<MsStatsStint>> stintsByPlayer,
        IReadOnlyList<TimelinePoint> scoreTimeline)
    {
        if (string.IsNullOrWhiteSpace(playerUuid) || !stintsByPlayer.TryGetValue(playerUuid, out var stints))
            return [];

        return stints
            .OrderBy(stint => stint.StartSeconds)
            .SelectMany(stint => new[]
            {
                new PlayerInOutMark
                {
                    Type = "IN_TYPE",
                    MinuteAbsolut = stint.StartSeconds / 60,
                    PointDiff = GetTeamDiffAt(scoreTimeline, stint.StartSeconds, isHome)
                },
                new PlayerInOutMark
                {
                    Type = "OUT_TYPE",
                    MinuteAbsolut = stint.EndSeconds / 60,
                    PointDiff = GetTeamDiffAt(scoreTimeline, stint.EndSeconds, isHome)
                }
            })
            .ToList();
    }

    private static int GetTeamDiffAt(IReadOnlyList<TimelinePoint> scoreTimeline, int elapsedSeconds, bool isHome)
    {
        var point = scoreTimeline.LastOrDefault(item => item.ElapsedSeconds <= elapsedSeconds)?.Point;
        if (point is null)
            return 0;

        return isHome ? point.Local - point.Visit : point.Visit - point.Local;
    }

    private static List<TimelinePoint> BuildScoreTimeline(
        IReadOnlyList<MsStatsScorePoint> scoreEvolution,
        bool resetScoreByPeriod,
        int periodDurationMinutes)
    {
        var periodSeconds = periodDurationMinutes * 60;
        var timeline = new List<TimelinePoint>
        {
            new(0, new ScoreTimelinePoint { Local = 0, Visit = 0, MinuteQuarter = 0, MinuteAbsolute = 0, Period = 1 })
        };
        var accumulator = new ResetScoreAccumulator(resetScoreByPeriod);

        foreach (var point in scoreEvolution)
        {
            var (local, visitor) = accumulator.Add(point.Period, point.Local, point.Visitor);
            // Los minutos de la fuente son cuenta atrás dentro del periodo, como en las jugadas antiguas.
            var elapsedInPeriod = Math.Clamp(periodSeconds - (point.Minute * 60 + point.Second), 0, periodSeconds);
            var elapsedSeconds = Math.Max(0, point.Period - 1) * periodSeconds + elapsedInPeriod;
            var minuteQuarter = Math.Min(elapsedInPeriod / 60, Math.Max(0, periodDurationMinutes - 1));

            timeline.Add(new TimelinePoint(elapsedSeconds, new ScoreTimelinePoint
            {
                Local = local,
                Visit = visitor,
                MinuteQuarter = minuteQuarter,
                MinuteAbsolute = Math.Max(0, point.Period - 1) * periodDurationMinutes + minuteQuarter,
                Period = point.Period
            }));
        }

        return timeline;
    }

    private static List<MoveEvent> BuildMoves(
        MsStatsPlayByPlay playByPlay,
        bool resetScoreByPeriod,
        IReadOnlyDictionary<string, int> teamIdsByUuid,
        IReadOnlyDictionary<int, string> teamNamesById)
    {
        var moves = new List<MoveEvent>();
        var foulsByPlayer = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var accumulator = new ResetScoreAccumulator(resetScoreByPeriod);

        foreach (var item in playByPlay.PlayByPlay)
        {
            var (local, visitor) = accumulator.Add(item.Period, item.LocalScore, item.VisitorScore);
            if (SkippedEventCodes.Contains(item.EventTypeCode ?? ""))
                continue;

            var teamId = !string.IsNullOrWhiteSpace(item.TeamUuid) && teamIdsByUuid.TryGetValue(item.TeamUuid, out var resolvedTeamId)
                ? resolvedTeamId
                : 0;
            var isTeamAction = string.IsNullOrWhiteSpace(item.Uuid);
            var moveName = MoveNamesBySubType.GetValueOrDefault(item.EventSubTypeId) ?? item.EventTypeCode ?? "";

            if (!isTeamAction && PlayerFoulSubTypes.Contains(item.EventSubTypeId))
            {
                var fouls = foulsByPlayer.GetValueOrDefault(item.Uuid!) + 1;
                foulsByPlayer[item.Uuid!] = fouls;
                moveName = $"{moveName}, {fouls}a falta";
            }

            moves.Add(new MoveEvent
            {
                IdTeam = teamId,
                ActorName = item.ActorName ?? (isTeamAction ? teamNamesById.GetValueOrDefault(teamId) ?? "" : ""),
                ActorId = isTeamAction ? 0 : ToStableLong(item.Uuid),
                ActorShirtNumber = item.Dorsal,
                IdMove = item.EventSubTypeId,
                Move = moveName,
                Min = item.Minute,
                Sec = item.Second,
                Period = item.Period,
                Score = $"{local}-{visitor}",
                TeamAction = isTeamAction
            });
        }

        return moves;
    }

    private static int ResolvePeriodDurationMinutes(MsStatsMatchHeader header, MsStatsPlayByPlay playByPlay)
    {
        if (header.PeriodDurationSeconds is > 0)
            return Math.Max(1, header.PeriodDurationSeconds.Value / 60);

        // Sin duración en la cabecera: el inicio de periodo marca el reloj completo (cuenta atrás).
        var periodStartMinute = playByPlay.PlayByPlay
            .Where(item => string.Equals(item.EventTypeCode, "INIPER", StringComparison.OrdinalIgnoreCase) && item.Period == 1)
            .Select(item => item.Minute)
            .FirstOrDefault();

        return periodStartMinute > 0 ? periodStartMinute : DefaultPeriodDurationMinutes;
    }

    private static MsStatsPlayByPlay TryDeserializePlayByPlay(string? movesRaw)
    {
        if (string.IsNullOrWhiteSpace(movesRaw))
            return new MsStatsPlayByPlay();

        try
        {
            return JsonSerializer.Deserialize<MsStatsPlayByPlay>(movesRaw) ?? new MsStatsPlayByPlay();
        }
        catch (JsonException)
        {
            return new MsStatsPlayByPlay();
        }
    }

    private static string? NormalizeHeaderDate(string? rawDate)
    {
        // La fuente marca la hora local del partido con `+0000`: se conserva la hora de pared sin zona.
        if (string.IsNullOrWhiteSpace(rawDate) || rawDate.Length < 19)
            return rawDate;

        return DateTime.TryParseExact(rawDate[..19], "yyyy-MM-ddTHH:mm:ss", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed)
            ? parsed.ToString("yyyy-MM-ddTHH:mm:ss", CultureInfo.InvariantCulture)
            : rawDate;
    }

    // Ids numéricos estables a partir de los uuids (los modelos antiguos identifican equipos y jugadoras por número).
    private static int ToStableInt(string? uuid, int fallback)
    {
        var hex = uuid?.Replace("-", "");
        return !string.IsNullOrWhiteSpace(hex) && hex.Length >= 7 &&
               int.TryParse(hex[..7], NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var value)
            ? value + 1
            : fallback;
    }

    private static long ToStableLong(string? uuid)
    {
        var hex = uuid?.Replace("-", "");
        return !string.IsNullOrWhiteSpace(hex) && hex.Length >= 15 &&
               long.TryParse(hex[..15], NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var value)
            ? value + 1
            : 0;
    }

    private sealed record TimelinePoint(int ElapsedSeconds, ScoreTimelinePoint Point);

    // En categorías con `resetScoreByPeriod` el marcador puede volver a cero en cada periodo;
    // el formato antiguo siempre era acumulado, así que se suman los periodos anteriores.
    private sealed class ResetScoreAccumulator(bool resetScoreByPeriod)
    {
        private int _period;
        private int _lastLocal;
        private int _lastVisitor;
        private int _offsetLocal;
        private int _offsetVisitor;

        public (int Local, int Visitor) Add(int period, int local, int visitor)
        {
            if (resetScoreByPeriod && period != _period && (local < _lastLocal || visitor < _lastVisitor))
            {
                _offsetLocal += _lastLocal;
                _offsetVisitor += _lastVisitor;
            }

            _period = period;
            _lastLocal = local;
            _lastVisitor = visitor;
            return (local + _offsetLocal, visitor + _offsetVisitor);
        }
    }
}
