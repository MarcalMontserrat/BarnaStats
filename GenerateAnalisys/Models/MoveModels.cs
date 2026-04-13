using System.Text.Json.Serialization;

namespace GenerateAnalisys.Models;

public sealed class MoveEvent
{
    [JsonPropertyName("idTeam")]
    public int IdTeam { get; set; }

    [JsonPropertyName("actorName")]
    public string? ActorName { get; set; }

    [JsonPropertyName("actorId")]
    public long ActorId { get; set; }

    [JsonPropertyName("actorShirtNumber")]
    public string? ActorShirtNumber { get; set; }

    [JsonPropertyName("idMove")]
    public int IdMove { get; set; }

    [JsonPropertyName("move")]
    public string? Move { get; set; }

    [JsonPropertyName("min")]
    public int Min { get; set; }

    [JsonPropertyName("sec")]
    public int Sec { get; set; }

    [JsonPropertyName("period")]
    public int Period { get; set; }

    [JsonPropertyName("score")]
    public string? Score { get; set; }

    [JsonPropertyName("teamAction")]
    public bool TeamAction { get; set; }
}
