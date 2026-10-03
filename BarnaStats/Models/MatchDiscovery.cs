namespace BarnaStats.Models;

public sealed class MatchDiscovery
{
    public int MatchWebId { get; init; }
    public string? UuidMatch { get; init; }
    public DateTime? MatchDate { get; init; }
    public int? LocalTeamIdExtern { get; init; }
    public int? VisitorTeamIdExtern { get; init; }
}
