namespace BarnaStats.Api.Models;

public sealed class ResultsSourceSnapshot
{
    public string SourceUrl { get; init; } = "";
    public int? PhaseId { get; init; }
    public string CategoryName { get; init; } = "";
    public string PhaseName { get; init; } = "";
    public string LevelName { get; init; } = "";
    public string LevelCode { get; init; } = "";
    public string GroupCode { get; init; } = "";
    public DateTimeOffset CreatedAtUtc { get; init; }
    public DateTimeOffset LastSyncedAtUtc { get; init; }
}
