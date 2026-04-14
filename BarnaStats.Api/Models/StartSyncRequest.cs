namespace BarnaStats.Api.Models;

public sealed class StartSyncRequest
{
    public string SourceUrl { get; set; } = "";
    public bool ForceRefresh { get; set; }
}
