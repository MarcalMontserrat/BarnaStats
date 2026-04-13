namespace BarnaStats.Utilities;

public sealed class BarnaStatsPaths
{
    private BarnaStatsPaths(string projectDir)
    {
        ProjectDir = projectDir;
        RepoRoot = ResolveRepoRoot(projectDir);
        MappingFile = Path.Combine(projectDir, "match_mapping.json");
        OutputDir = Path.Combine(projectDir, "out");
        TeamsDir = Path.Combine(OutputDir, "teams");
        StatsDir = Path.Combine(OutputDir, "stats");
        MovesDir = Path.Combine(OutputDir, "moves");
        BrowserProfileDir = Path.Combine(OutputDir, "browser-profile");
        GenerateAnalysisProjectFile = Path.Combine(RepoRoot, "GenerateAnalisys", "GenerateAnalisys.csproj");
    }

    public string ProjectDir { get; }
    public string RepoRoot { get; }
    public string MappingFile { get; }
    public string OutputDir { get; }
    public string TeamsDir { get; }
    public string StatsDir { get; }
    public string MovesDir { get; }
    public string BrowserProfileDir { get; }
    public string GenerateAnalysisProjectFile { get; }

    public static BarnaStatsPaths CreateDefault()
    {
        var projectDir = ResolveProjectDirectory();
        return new BarnaStatsPaths(projectDir);
    }

    public void EnsureDirectories()
    {
        Directory.CreateDirectory(OutputDir);
        Directory.CreateDirectory(TeamsDir);
        Directory.CreateDirectory(StatsDir);
        Directory.CreateDirectory(MovesDir);
        Directory.CreateDirectory(BrowserProfileDir);
    }

    public TeamStoragePaths CreateStorage(int? teamCalendarId = null)
    {
        if (teamCalendarId is > 0)
        {
            var teamRootDir = Path.Combine(TeamsDir, teamCalendarId.Value.ToString());
            return new TeamStoragePaths(
                teamCalendarId,
                teamRootDir,
                Path.Combine(teamRootDir, "match_mapping.json"),
                Path.Combine(teamRootDir, "stats"),
                Path.Combine(teamRootDir, "moves"));
        }

        return new TeamStoragePaths(
            null,
            ProjectDir,
            MappingFile,
            StatsDir,
            MovesDir);
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

    private static string ResolveRepoRoot(string projectDir)
    {
        foreach (var candidate in EnumerateRepoRootCandidates(projectDir))
        {
            var generateAnalysisProject = Path.Combine(candidate, "GenerateAnalisys", "GenerateAnalisys.csproj");
            if (File.Exists(generateAnalysisProject))
                return candidate;
        }

        return Directory.GetParent(projectDir)?.FullName ?? projectDir;
    }

    private static IEnumerable<string> EnumerateRepoRootCandidates(string projectDir)
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var candidate in new[]
                 {
                     projectDir,
                     Directory.GetParent(projectDir)?.FullName
                 })
        {
            if (string.IsNullOrWhiteSpace(candidate))
                continue;

            var fullPath = Path.GetFullPath(candidate);
            if (seen.Add(fullPath))
                yield return fullPath;
        }
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
