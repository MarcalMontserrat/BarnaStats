namespace BarnaStats.Utilities;

public sealed class BarnaStatsPaths
{
    public string MappingFile { get; }
    public string OutputDir { get; }
    public string StatsDir { get; }
    public string MovesDir { get; }
    public string SummaryCsv { get; }

    public BarnaStatsPaths(string mappingFile, string outputDir, string statsDir, string movesDir, string summaryCsv)
    {
        MappingFile = mappingFile;
        OutputDir = outputDir;
        StatsDir = statsDir;
        MovesDir = movesDir;
        SummaryCsv = summaryCsv;
    }

    public static BarnaStatsPaths CreateDefault()
    {
        return new BarnaStatsPaths(
            mappingFile: "match_mapping.json",
            outputDir: "out",
            statsDir: "out/stats",
            movesDir: "out/moves",
            summaryCsv: "out/summary.csv");
    }

    public void EnsureDirectories()
    {
        Directory.CreateDirectory(OutputDir);
        Directory.CreateDirectory(StatsDir);
        Directory.CreateDirectory(MovesDir);
    }

    public string GetStatsPath(int matchWebId, string uuidMatch)
    {
        return Path.Combine(StatsDir, $"{matchWebId}_{uuidMatch}_stats.json");
    }

    public string GetMovesPath(int matchWebId, string uuidMatch)
    {
        return Path.Combine(MovesDir, $"{matchWebId}_{uuidMatch}_moves.json");
    }
}
