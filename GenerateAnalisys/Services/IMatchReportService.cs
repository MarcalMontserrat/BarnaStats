using GenerateAnalisys.Models;

namespace GenerateAnalisys.Services;

public interface IMatchReportService
{
    Task<MatchReportResult?> GetOrGenerateAsync(
        int matchWebId,
        StatsRoot match,
        string statsRaw,
        string? movesRaw);
}
