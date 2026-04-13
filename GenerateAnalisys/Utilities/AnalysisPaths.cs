namespace GenerateAnalisys.Utilities;

public sealed class AnalysisPaths
{
    private AnalysisPaths(string repoRoot, string rawDataRootDir)
    {
        RepoRoot = repoRoot;
        RawDataRootDir = rawDataRootDir;
        OutputDir = rawDataRootDir;
        AnalysisJson = Path.Combine(OutputDir, "analysis.json");
        MatchReportsDir = Path.Combine(OutputDir, "match-reports");
        WebDataDir = Path.Combine(repoRoot, "barna-stats-webapp", "public", "data");
        WebAnalysisJson = Path.Combine(WebDataDir, "analysis.json");
    }

    public string RepoRoot { get; }
    public string RawDataRootDir { get; }
    public string OutputDir { get; }
    public string AnalysisJson { get; }
    public string MatchReportsDir { get; }
    public string WebDataDir { get; }
    public string WebAnalysisJson { get; }

    public static AnalysisPaths? ResolveDefault()
    {
        foreach (var root in EnumerateSearchRoots())
        {
            var rawDataRootDir = Path.Combine(root, "BarnaStats", "out");
            if (Directory.Exists(rawDataRootDir))
                return new AnalysisPaths(root, rawDataRootDir);
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
