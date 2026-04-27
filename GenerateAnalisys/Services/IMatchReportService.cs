using GenerateAnalisys.Models;

namespace GenerateAnalisys.Services;

public interface IMatchReportService
{
    Task<MatchReportResult?> GetCachedAsync(
        int matchWebId,
        string statsRaw,
        string? movesRaw,
        int? focusTeamIdExtern = null);

    Task<MatchReportResult?> GetOrGenerateAsync(
        int matchWebId,
        StatsRoot match,
        string statsRaw,
        string? movesRaw,
        int? focusTeamIdExtern = null);
}

public interface IMatchReportProviderService : IMatchReportService
{
    string ProviderName { get; }
    MatchReportFailure? LastFailure { get; }
}
