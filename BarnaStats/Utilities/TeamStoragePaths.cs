namespace BarnaStats.Utilities;

public sealed class TeamStoragePaths
{
    public TeamStoragePaths(
        StorageScope scope,
        string rootDir,
        string mappingFile,
        string phaseMetadataFile,
        string statsDir,
        string movesDir)
    {
        Scope = scope;
        RootDir = rootDir;
        MappingFile = mappingFile;
        PhaseMetadataFile = phaseMetadataFile;
        StatsDir = statsDir;
        MovesDir = movesDir;
    }

    public StorageScope Scope { get; }
    public string RootDir { get; }
    public string MappingFile { get; }
    public string PhaseMetadataFile { get; }
    public string StatsDir { get; }
    public string MovesDir { get; }

    public void EnsureDirectories()
    {
        Directory.CreateDirectory(RootDir);
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
