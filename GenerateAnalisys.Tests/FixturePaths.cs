namespace GenerateAnalisys.Tests;

internal static class FixturePaths
{
    public static string TestProjectRoot => FindAncestorContaining("GenerateAnalisys.Tests.csproj");
    public static string RepoRoot => FindAncestorContaining("BarnaStats.sln");
    public static string FixturesRoot => Path.Combine(TestProjectRoot, "Fixtures");
    public static string SinglePhaseRoot => Path.Combine(FixturesRoot, "single-phase");
    public static string MsStats2026PhaseRoot => Path.Combine(FixturesRoot, "msstats-2026-phase");

    private static string FindAncestorContaining(string markerFile)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);

        while (current is not null)
        {
            if (File.Exists(Path.Combine(current.FullName, markerFile)))
            {
                return current.FullName;
            }

            current = current.Parent;
        }

        throw new DirectoryNotFoundException($"No se ha encontrado `{markerFile}` a partir de `{AppContext.BaseDirectory}`.");
    }
}
