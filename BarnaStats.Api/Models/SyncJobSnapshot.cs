namespace BarnaStats.Api.Models;

public sealed class SyncJobSnapshot
{
    public required string JobId { get; init; }
    public required string Status { get; init; }
    public required string CalendarUrl { get; init; }
    public required DateTimeOffset CreatedAtUtc { get; init; }
    public DateTimeOffset? StartedAtUtc { get; init; }
    public DateTimeOffset? CompletedAtUtc { get; init; }
    public int? ExitCode { get; init; }
    public int? TeamCalendarId { get; init; }
    public string? Error { get; init; }
    public required IReadOnlyList<string> Logs { get; init; }
    public DateTimeOffset? AnalysisUpdatedAtUtc { get; init; }
}
