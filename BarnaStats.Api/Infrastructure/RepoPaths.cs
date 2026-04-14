namespace BarnaStats.Api.Infrastructure;

public sealed class RepoPaths
{
    private RepoPaths(string repoRoot)
    {
        RepoRoot = repoRoot;
        BarnaStatsProjectFile = Path.Combine(repoRoot, "BarnaStats", "BarnaStats.csproj");
        GenerateAnalysisProjectFile = Path.Combine(repoRoot, "GenerateAnalisys", "GenerateAnalisys.csproj");
        AnalysisJson = Path.Combine(repoRoot, "barna-stats-webapp", "public", "data", "analysis.json");
        ResultsSourcesRegistryFile = Path.Combine(repoRoot, "BarnaStats", "out", "results_sources.json");
        TempDir = Path.Combine(repoRoot, "BarnaStats", "out", "tmp");
    }

    public string RepoRoot { get; }
    public string BarnaStatsProjectFile { get; }
    public string GenerateAnalysisProjectFile { get; }
    public string AnalysisJson { get; }
    public string ResultsSourcesRegistryFile { get; }
    public string TempDir { get; }

    public static RepoPaths ResolveDefault()
    {
        foreach (var candidate in EnumerateSearchRoots())
        {
            var barnaStatsProjectFile = Path.Combine(candidate, "BarnaStats", "BarnaStats.csproj");
            if (File.Exists(barnaStatsProjectFile))
                return new RepoPaths(candidate);
        }

        throw new InvalidOperationException("No se pudo localizar el repo root desde BarnaStats.Api.");
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
