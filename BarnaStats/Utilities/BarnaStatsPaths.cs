namespace BarnaStats.Utilities;

public sealed class BarnaStatsPaths
{
    private BarnaStatsPaths(string projectDir)
    {
        ProjectDir = projectDir;
        MappingFile = Path.Combine(projectDir, "match_mapping.json");
        OutputDir = Path.Combine(projectDir, "out");
        StatsDir = Path.Combine(OutputDir, "stats");
        MovesDir = Path.Combine(OutputDir, "moves");
        BrowserProfileDir = Path.Combine(OutputDir, "browser-profile");
    }

    public string ProjectDir { get; }
    public string MappingFile { get; }
    public string OutputDir { get; }
    public string StatsDir { get; }
    public string MovesDir { get; }
    public string BrowserProfileDir { get; }

    public static BarnaStatsPaths CreateDefault()
    {
        var projectDir = ResolveProjectDirectory();
        return new BarnaStatsPaths(projectDir);
    }

    public void EnsureDirectories()
    {
        Directory.CreateDirectory(OutputDir);
        Directory.CreateDirectory(StatsDir);
        Directory.CreateDirectory(MovesDir);
        Directory.CreateDirectory(BrowserProfileDir);
    }

    public string GetStatsPath(int matchWebId, string uuidMatch)
    {
        return Path.Combine(StatsDir, $"{matchWebId}_{uuidMatch}_stats.json");
    }

    public string GetMovesPath(int matchWebId, string uuidMatch)
    {
        return Path.Combine(MovesDir, $"{matchWebId}_{uuidMatch}_moves.json");
    }

    private static string ResolveProjectDirectory()
    {
        foreach (var root in EnumerateSearchRoots())
        {
            var directProject = Path.Combine(root, "BarnaStats.csproj");
            if (File.Exists(directProject))
                return root;

            var nestedProject = Path.Combine(root, "BarnaStats", "BarnaStats.csproj");
            if (File.Exists(nestedProject))
                return Path.Combine(root, "BarnaStats");
        }

        return Directory.GetCurrentDirectory();
    }

    private static IEnumerable<string> EnumerateSearchRoots()
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var start in new[] { Directory.GetCurrentDirectory(), AppContext.BaseDirectory })
        {
            var current = Path.GetFullPath(start);

            while (!string.IsNullOrWhiteSpace(current))
            {
                if (seen.Add(current))
                    yield return current;

                var parent = Directory.GetParent(current);
                if (parent is null)
                    break;

                current = parent.FullName;
            }
        }
    }
}
