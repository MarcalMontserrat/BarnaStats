namespace BarnaStats.Api.Infrastructure;

public sealed class RepoPaths
{
    private RepoPaths(string repoRoot)
    {
        RepoRoot = repoRoot;
        BarnaStatsProjectDir = Path.Combine(repoRoot, "BarnaStats");
        BarnaStatsProjectFile = Path.Combine(repoRoot, "BarnaStats", "BarnaStats.csproj");
        GenerateAnalysisProjectFile = Path.Combine(repoRoot, "GenerateAnalisys", "GenerateAnalisys.csproj");
        BarnaStatsDll = ResolveBuiltDllPath(repoRoot, "BarnaStats");
        GenerateAnalysisDll = ResolveBuiltDllPath(repoRoot, "GenerateAnalisys");
        BarnaStatsOutputDir = Path.Combine(BarnaStatsProjectDir, "out");
        BarnaStatsPhasesDir = Path.Combine(BarnaStatsOutputDir, "phases");
        AnalysisJson = Path.Combine(repoRoot, "barna-stats-webapp", "public", "data", "analysis.json");
        ResultsSourcesRegistryFile = Path.Combine(BarnaStatsOutputDir, "results_sources.json");
        TempDir = Path.Combine(BarnaStatsOutputDir, "tmp");
    }

    public string RepoRoot { get; }
    public string BarnaStatsProjectDir { get; }
    public string BarnaStatsProjectFile { get; }
    public string GenerateAnalysisProjectFile { get; }
    public string BarnaStatsDll { get; }
    public string GenerateAnalysisDll { get; }
    public string BarnaStatsOutputDir { get; }
    public string BarnaStatsPhasesDir { get; }
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

    private static string ResolveBuiltDllPath(string repoRoot, string projectName)
    {
        var projectDir = Path.Combine(repoRoot, projectName);
        var binDir = Path.Combine(projectDir, "bin");
        if (!Directory.Exists(binDir))
            return Path.Combine(projectDir, "bin", "Debug", "net10.0", $"{projectName}.dll");

        foreach (var configuration in new[] { "Release", "Debug" })
        {
            var configurationDir = Path.Combine(binDir, configuration);
            if (!Directory.Exists(configurationDir))
                continue;

            var resolvedDll = Directory
                .EnumerateFiles(configurationDir, $"{projectName}.dll", SearchOption.AllDirectories)
                .OrderByDescending(path => path.Contains($"{Path.DirectorySeparatorChar}publish{Path.DirectorySeparatorChar}", StringComparison.OrdinalIgnoreCase))
                .ThenByDescending(File.GetLastWriteTimeUtc)
                .FirstOrDefault();

            if (!string.IsNullOrWhiteSpace(resolvedDll))
                return resolvedDll;
        }

        return Path.Combine(projectDir, "bin", "Debug", "net10.0", $"{projectName}.dll");
    }
}
