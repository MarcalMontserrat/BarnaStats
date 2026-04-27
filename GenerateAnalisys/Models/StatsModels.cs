using System.Text.Json.Serialization;

namespace GenerateAnalisys.Models;

public sealed class StatsRoot
{
    [JsonPropertyName("idMatchIntern")]
    public int IdMatchIntern { get; set; }

    [JsonPropertyName("idMatchExtern")]
    public int IdMatchExtern { get; set; }

    [JsonPropertyName("localId")]
    public int LocalId { get; set; }

    [JsonPropertyName("visitId")]
    public int VisitId { get; set; }

    [JsonPropertyName("time")]
    public string? Time { get; set; }

    [JsonPropertyName("period")]
    public int Period { get; set; }

    [JsonPropertyName("periodDuration")]
    public int PeriodDuration { get; set; }

    [JsonPropertyName("score")]
    public List<ScoreTimelinePoint> Score { get; set; } = new();

    [JsonPropertyName("teams")]
    public List<TeamInfo> Teams { get; set; } = new();
}

public sealed class ScoreTimelinePoint
{
    [JsonPropertyName("local")]
    public int Local { get; set; }

    [JsonPropertyName("visit")]
    public int Visit { get; set; }

    [JsonPropertyName("minuteQuarter")]
    public int MinuteQuarter { get; set; }

    [JsonPropertyName("minuteAbsolute")]
    public int MinuteAbsolute { get; set; }

    [JsonPropertyName("period")]
    public int Period { get; set; }
}

public sealed class TeamInfo
{
    [JsonPropertyName("teamIdIntern")]
    public int TeamIdIntern { get; set; }

    [JsonPropertyName("teamIdExtern")]
    public int TeamIdExtern { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("players")]
    public List<PlayerInfo> Players { get; set; } = new();

    [JsonPropertyName("data")]
    public StatBlock? Data { get; set; }
}

public sealed class PlayerInfo
{
    [JsonPropertyName("actorId")]
    public long ActorId { get; set; }

    [JsonPropertyName("uuid")]
    public string? Uuid { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("dorsal")]
    public string? Dorsal { get; set; }

    [JsonPropertyName("starting")]
    public bool Starting { get; set; }

    [JsonPropertyName("timePlayed")]
    public int TimePlayed { get; set; }

    [JsonPropertyName("inOut")]
    public int InOut { get; set; }

    [JsonPropertyName("inOutsList")]
    public List<PlayerInOutMark> InOutsList { get; set; } = new();

    [JsonPropertyName("data")]
    public StatBlock? Data { get; set; }
}

public sealed class PlayerInOutMark
{
    [JsonPropertyName("type")]
    public string? Type { get; set; }

    [JsonPropertyName("minuteAbsolut")]
    public int MinuteAbsolut { get; set; }

    [JsonPropertyName("pointDiff")]
    public int PointDiff { get; set; }
}

public sealed class StatBlock
{
    [JsonPropertyName("score")]
    public int Score { get; set; }

    [JsonPropertyName("valoration")]
    public int Valoration { get; set; }

    [JsonPropertyName("faults")]
    public int Faults { get; set; }

    [JsonPropertyName("shotsOfOneAttempted")]
    public int ShotsOfOneAttempted { get; set; }

    [JsonPropertyName("shotsOfOneSuccessful")]
    public int ShotsOfOneSuccessful { get; set; }

    [JsonPropertyName("shotsOfTwoAttempted")]
    public int ShotsOfTwoAttempted { get; set; }

    [JsonPropertyName("shotsOfTwoSuccessful")]
    public int ShotsOfTwoSuccessful { get; set; }

    [JsonPropertyName("shotsOfThreeAttempted")]
    public int ShotsOfThreeAttempted { get; set; }

    [JsonPropertyName("shotsOfThreeSuccessful")]
    public int ShotsOfThreeSuccessful { get; set; }
}
