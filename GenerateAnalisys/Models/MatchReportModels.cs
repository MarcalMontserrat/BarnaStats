namespace GenerateAnalisys.Models;

public sealed class MatchReportCacheEntry
{
    public int MatchWebId { get; set; }
    public string ContentHash { get; set; } = "";
    public string Model { get; set; } = "";
    public DateTime GeneratedAtUtc { get; set; }
    public string Summary { get; set; } = "";
}

public sealed class MatchReportResult
{
    public string Summary { get; init; } = "";
    public string ContentHash { get; init; } = "";
    public string Model { get; init; } = "";
    public DateTime GeneratedAtUtc { get; init; }
}
