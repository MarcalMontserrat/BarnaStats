using System.Text.Json.Serialization;

namespace GenerateAnalisys.Models;

// Formato de msstats desde la temporada 2026-2027 (`/v1/fcbq/matches/{guid}/stats` y `/pbp`).
// Solo se modela lo que el adaptador convierte al formato antiguo (StatsRoot / MoveEvent).
public sealed class MsStatsMatchStats
{
    [JsonPropertyName("header")]
    public MsStatsMatchHeader? Header { get; set; }

    [JsonPropertyName("boxscore")]
    public List<MsStatsBoxscorePeriod> Boxscore { get; set; } = new();

    [JsonPropertyName("stints")]
    public MsStatsSides<List<MsStatsPlayerStints>>? Stints { get; set; }

    [JsonPropertyName("scoreEvolution")]
    public List<MsStatsScorePoint> ScoreEvolution { get; set; } = new();
}

public sealed class MsStatsMatchHeader
{
    [JsonPropertyName("date")]
    public string? Date { get; set; }

    [JsonPropertyName("localTeam")]
    public MsStatsTeamRef? LocalTeam { get; set; }

    [JsonPropertyName("visitorTeam")]
    public MsStatsTeamRef? VisitorTeam { get; set; }

    [JsonPropertyName("periods")]
    public List<MsStatsPeriodScore> Periods { get; set; } = new();

    [JsonPropertyName("resetScoreByPeriod")]
    public bool ResetScoreByPeriod { get; set; }

    [JsonPropertyName("regulationPeriods")]
    public int? RegulationPeriods { get; set; }

    [JsonPropertyName("periodDurationSeconds")]
    public int? PeriodDurationSeconds { get; set; }
}

public sealed class MsStatsTeamRef
{
    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("uuid")]
    public string? Uuid { get; set; }
}

public sealed class MsStatsPeriodScore
{
    [JsonPropertyName("period")]
    public int Period { get; set; }
}

public sealed class MsStatsSides<T>
{
    [JsonPropertyName("local")]
    public T? Local { get; set; }

    [JsonPropertyName("visitor")]
    public T? Visitor { get; set; }
}

public sealed class MsStatsBoxscorePeriod
{
    [JsonPropertyName("period")]
    public int Period { get; set; }

    [JsonPropertyName("local")]
    public MsStatsBoxscoreTeam? Local { get; set; }

    [JsonPropertyName("visitor")]
    public MsStatsBoxscoreTeam? Visitor { get; set; }
}

public sealed class MsStatsBoxscoreTeam
{
    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("uuid")]
    public string? Uuid { get; set; }

    [JsonPropertyName("accumulated")]
    public MsStatsAccumulated? Accumulated { get; set; }

    [JsonPropertyName("players")]
    public List<MsStatsBoxscorePlayer> Players { get; set; } = new();
}

public sealed class MsStatsBoxscorePlayer
{
    [JsonPropertyName("uuid")]
    public string? Uuid { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("dorsal")]
    public string? Dorsal { get; set; }

    [JsonPropertyName("starting")]
    public bool Starting { get; set; }

    [JsonPropertyName("accumulated")]
    public MsStatsAccumulated? Accumulated { get; set; }

    [JsonPropertyName("computed")]
    public MsStatsComputed? Computed { get; set; }
}

public sealed class MsStatsAccumulated
{
    [JsonPropertyName("pts")]
    public int Pts { get; set; }

    [JsonPropertyName("t2m")]
    public int T2m { get; set; }

    // Los intentos solo vienen en los modos de visualización con tiros fallados; si faltan, se asumen los anotados.
    [JsonPropertyName("t2a")]
    public int? T2a { get; set; }

    [JsonPropertyName("t3m")]
    public int T3m { get; set; }

    [JsonPropertyName("t3a")]
    public int? T3a { get; set; }

    [JsonPropertyName("ftm")]
    public int Ftm { get; set; }

    [JsonPropertyName("fta")]
    public int Fta { get; set; }

    [JsonPropertyName("fc")]
    public int Fc { get; set; }
}

public sealed class MsStatsComputed
{
    [JsonPropertyName("seconds")]
    public int Seconds { get; set; }

    [JsonPropertyName("onCourtPlusMinus")]
    public int OnCourtPlusMinus { get; set; }
}

public sealed class MsStatsPlayerStints
{
    [JsonPropertyName("uuid")]
    public string? Uuid { get; set; }

    [JsonPropertyName("stints")]
    public List<MsStatsStint> Stints { get; set; } = new();
}

public sealed class MsStatsStint
{
    [JsonPropertyName("startSeconds")]
    public int StartSeconds { get; set; }

    [JsonPropertyName("endSeconds")]
    public int EndSeconds { get; set; }
}

public sealed class MsStatsScorePoint
{
    [JsonPropertyName("local")]
    public int Local { get; set; }

    [JsonPropertyName("visitor")]
    public int Visitor { get; set; }

    [JsonPropertyName("period")]
    public int Period { get; set; }

    [JsonPropertyName("minute")]
    public int Minute { get; set; }

    [JsonPropertyName("second")]
    public int Second { get; set; }
}

public sealed class MsStatsPlayByPlay
{
    [JsonPropertyName("playByPlay")]
    public List<MsStatsPlayByPlayEvent> PlayByPlay { get; set; } = new();
}

public sealed class MsStatsPlayByPlayEvent
{
    [JsonPropertyName("eventSubTypeId")]
    public int EventSubTypeId { get; set; }

    [JsonPropertyName("eventTypeCode")]
    public string? EventTypeCode { get; set; }

    [JsonPropertyName("period")]
    public int Period { get; set; }

    [JsonPropertyName("minute")]
    public int Minute { get; set; }

    [JsonPropertyName("second")]
    public int Second { get; set; }

    [JsonPropertyName("localScore")]
    public int LocalScore { get; set; }

    [JsonPropertyName("visitorScore")]
    public int VisitorScore { get; set; }

    [JsonPropertyName("dorsal")]
    public string? Dorsal { get; set; }

    [JsonPropertyName("actorName")]
    public string? ActorName { get; set; }

    [JsonPropertyName("uuid")]
    public string? Uuid { get; set; }

    [JsonPropertyName("teamUuid")]
    public string? TeamUuid { get; set; }
}
