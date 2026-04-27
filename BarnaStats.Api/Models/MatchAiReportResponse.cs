namespace BarnaStats.Api.Models;

public sealed class MatchAiReportResponse
{
    public int MatchWebId { get; init; }
    public string Summary { get; init; } = "";
    public DateTime GeneratedAtUtc { get; init; }
    public string Model { get; init; } = "";
}

public enum MatchAiReportErrorKind
{
    None = 0,
    MatchDataNotFound,
    InvalidMatchData,
    MissingApiKey,
    DailyQuotaReached,
    GenerationFailed
}

public sealed class MatchAiReportOperationResult
{
    public MatchAiReportResponse? Report { get; init; }
    public MatchAiReportErrorKind ErrorKind { get; init; }
    public string ErrorMessage { get; init; } = "";

    public bool Succeeded => Report is not null;
}
