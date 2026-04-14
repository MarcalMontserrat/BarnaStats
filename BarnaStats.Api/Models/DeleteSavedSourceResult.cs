namespace BarnaStats.Api.Models;

public sealed class DeleteSavedSourceResult
{
    public bool Deleted { get; init; }
    public int PhaseId { get; init; }
    public string Reference { get; init; } = "";
    public int RemovedRegistryEntries { get; init; }
    public bool DeletedPhaseDirectory { get; init; }
    public bool AnalysisRegenerated { get; init; }
    public DateTimeOffset? AnalysisUpdatedAtUtc { get; init; }
    public string? Error { get; init; }
    public string? Warning { get; init; }
}
