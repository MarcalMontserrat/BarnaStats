namespace BarnaStats.Api.Models;

public sealed class DiscoverBulkSourcesRequest
{
    public List<string> Genders { get; set; } = [];
    public List<int> Territories { get; set; } = [];
}

public sealed class DiscoverBulkSourcesResponse
{
    public List<string> Genders { get; set; } = [];
    public List<int> Territories { get; set; } = [];
    public int UniqueCategoryNamesCount { get; set; }
    public int CategoryScopesCount { get; set; }
    public int UniquePhasesCount { get; set; }
    public int DuplicatePhasesSkipped { get; set; }
    public List<string> Warnings { get; set; } = [];
    public List<DiscoveredCategoryScope> CategoryScopes { get; set; } = [];
    public List<SyncSourceSelectionItem> Sources { get; set; } = [];
}

public sealed class DiscoveredCategoryScope
{
    public string Gender { get; set; } = "";
    public string GenderLabel { get; set; } = "";
    public int Territory { get; set; }
    public string TerritoryLabel { get; set; } = "";
    public int CategoryId { get; set; }
    public string CategoryName { get; set; } = "";
    public int PhasesCount { get; set; }
}
