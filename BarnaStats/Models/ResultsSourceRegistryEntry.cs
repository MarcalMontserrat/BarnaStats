namespace BarnaStats.Models;

public sealed class ResultsSourceRegistryEntry
{
    public string SourceUrl { get; set; } = "";
    public int? PhaseId { get; set; }
    public string CategoryName { get; set; } = "";
    public string PhaseName { get; set; } = "";
    public string LevelName { get; set; } = "";
    public string LevelCode { get; set; } = "";
    public string GroupCode { get; set; } = "";
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset LastSyncedAtUtc { get; set; }
}
