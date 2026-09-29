namespace BarnaStats.Api.Models;

// Fase guardada tal y como la ve la pantalla de sync: el registro más su estado de temporada.
// Es solo de lectura: el registro en disco sigue siendo `ResultsSourceSnapshot`.
public sealed class ResultsSourceListItem
{
    public string SourceUrl { get; init; } = "";
    public int? PhaseId { get; init; }
    public int? SeasonStartYear { get; init; }
    public string SeasonLabel { get; init; } = "";
    public string CategoryName { get; init; } = "";
    public string PhaseName { get; init; } = "";
    public string LevelName { get; init; } = "";
    public string LevelCode { get; init; } = "";
    public string GroupCode { get; init; } = "";
    public DateTimeOffset CreatedAtUtc { get; init; }
    public DateTimeOffset LastSyncedAtUtc { get; init; }
    public bool IsCurrentSeason { get; init; }
    public bool ImportBlocked { get; init; }
    public string? ImportBlockedReason { get; init; }
}
