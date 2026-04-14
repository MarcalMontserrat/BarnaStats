namespace GenerateAnalisys.Models;

public sealed class PhaseMetadataFile
{
    public int? PhaseId { get; set; }
    public string SourceUrl { get; set; } = "";
    public string CategoryName { get; set; } = "";
    public string SubTitle { get; set; } = "";
    public string PhaseName { get; set; } = "";
    public string LevelName { get; set; } = "";
    public string LevelCode { get; set; } = "";
    public string GroupCode { get; set; } = "";
}
