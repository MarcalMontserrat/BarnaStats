using BarnaStats.Models;

namespace BarnaStats.Services;

public interface IMatchMappingSyncRunner
{
    Task<MatchMappingSyncResult> SyncAsync(
        IReadOnlyList<MatchMapping> existingMappings,
        IReadOnlyCollection<int> explicitMatchWebIds,
        bool includeAll,
        string? sourceUrl = null,
        bool interactive = true);
}
