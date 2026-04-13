namespace GenerateAnalisys.Utilities;

public sealed class AnalysisPaths
{
    private AnalysisPaths(string repoRoot, string statsDir)
    {
        RepoRoot = repoRoot;
        StatsDir = statsDir;
        OutputDir = Path.GetDirectoryName(statsDir)!;
        AnalysisJson = Path.Combine(OutputDir, "analysis.json");
        WebDataDir = Path.Combine(repoRoot, "barna-stats-webapp", "public", "data");
        WebAnalysisJson = Path.Combine(WebDataDir, "analysis.json");
    }

    public string RepoRoot { get; }
    public string StatsDir { get; }
    public string OutputDir { get; }
    public string AnalysisJson { get; }
    public string WebDataDir { get; }
    public string WebAnalysisJson { get; }

    public static AnalysisPaths? ResolveDefault()
    {
        foreach (var root in EnumerateSearchRoots())
        {
            var statsDir = Path.Combine(root, "BarnaStats", "out", "stats");
            if (Directory.Exists(statsDir))
                return new AnalysisPaths(root, statsDir);
        }

        return null;
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
