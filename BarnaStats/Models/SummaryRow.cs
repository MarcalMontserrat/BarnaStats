namespace BarnaStats.Models;

public sealed class SummaryRow
{
    public int MatchWebId { get; set; }
    public string UuidMatch { get; set; } = "";
    public string Status { get; set; } = "";
    public string HomeTeam { get; set; } = "";
    public int? HomeScore { get; set; }
    public int? AwayScore { get; set; }
    public string AwayTeam { get; set; } = "";
    public bool HasStats { get; set; }
    public bool HasMoves { get; set; }
    public string Error { get; set; } = "";
}
