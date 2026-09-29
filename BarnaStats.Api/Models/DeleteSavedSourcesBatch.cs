namespace BarnaStats.Api.Models;

public sealed class DeleteSavedSourcesRequest
{
    public List<int> PhaseIds { get; set; } = [];
}

public sealed class DeleteSavedSourcesResult
{
    public List<int> DeletedPhaseIds { get; init; } = [];
    public List<int> MissingPhaseIds { get; init; } = [];
    public List<string> References { get; init; } = [];
    public int RemovedRegistryEntries { get; init; }
    public int DeletedPhaseDirectories { get; init; }
    public bool AnalysisRegenerated { get; init; }
    public DateTimeOffset? AnalysisUpdatedAtUtc { get; init; }
    public bool Conflict { get; init; }
    public string? Error { get; init; }
    public string? Warning { get; init; }
}
