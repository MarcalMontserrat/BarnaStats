namespace BarnaStats.Api.Models;

public sealed class StartSyncBatchRequest
{
    public List<SyncSourceSelectionItem> Sources { get; set; } = [];
    public bool ForceRefresh { get; set; }
    public string Description { get; set; } = "";
}

public sealed class SyncSourceSelectionItem
{
    public string SourceUrl { get; set; } = "";
    public string Label { get; set; } = "";
}
