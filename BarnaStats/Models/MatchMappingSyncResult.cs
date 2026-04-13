namespace BarnaStats.Models;

public sealed class MatchMappingSyncResult
{
    public required IReadOnlyList<MatchDiscovery> DiscoveredMappings { get; init; }
    public required IReadOnlyList<int> TargetMatchWebIds { get; init; }
    public required IReadOnlyDictionary<int, string?> ResolvedUuids { get; init; }
}
