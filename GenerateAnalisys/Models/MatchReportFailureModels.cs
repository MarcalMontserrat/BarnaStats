namespace GenerateAnalisys.Models;

public enum MatchReportFailureKind
{
    Disabled = 0,
    MissingApiKey,
    DailyQuotaReached,
    RequestFailed,
    EmptyResponse
}

public sealed class MatchReportFailure
{
    public MatchReportFailureKind Kind { get; init; }
    public string Message { get; init; } = "";
}
