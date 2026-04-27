using System.Text.Json;

namespace GenerateAnalisys.Services;

internal static class MatchReportPromptTemplateLoader
{
    private const string PromptFileName = "match-report.json";

    public static MatchReportPromptTemplate Load()
    {
        var promptPath = ResolvePromptPath();
        var json = File.ReadAllText(promptPath);
        var template = JsonSerializer.Deserialize<MatchReportPromptTemplate>(json, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        if (template is null)
            throw new InvalidOperationException($"No se pudo deserializar el prompt de análisis en `{promptPath}`.");

        if (string.IsNullOrWhiteSpace(template.Version))
            throw new InvalidOperationException($"El prompt de análisis `{promptPath}` no tiene `version`.");

        var normalizedTemplate = template.Normalize();
        if (string.IsNullOrWhiteSpace(normalizedTemplate.SystemInstruction))
            throw new InvalidOperationException($"El prompt de análisis `{promptPath}` no tiene `systemInstruction`.");

        return normalizedTemplate;
    }

    private static string ResolvePromptPath()
    {
        foreach (var root in EnumerateSearchRoots())
        {
            var repoPromptPath = Path.Combine(root, "GenerateAnalisys", "Prompts", PromptFileName);
            if (File.Exists(repoPromptPath))
                return repoPromptPath;

            var localPromptPath = Path.Combine(root, "Prompts", PromptFileName);
            if (File.Exists(localPromptPath))
                return localPromptPath;
        }

        throw new InvalidOperationException($"No se pudo localizar `{PromptFileName}` desde el directorio actual ni desde la base de la aplicación.");
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

    internal sealed class MatchReportPromptTemplate
    {
        public string Version { get; init; } = "";
        public string SystemInstruction { get; init; } = "";
        public List<string> SystemInstructionLines { get; init; } = [];

        public MatchReportPromptTemplate Normalize()
        {
            var systemInstruction = !string.IsNullOrWhiteSpace(SystemInstruction)
                ? SystemInstruction
                : string.Join("\n", SystemInstructionLines
                    .Where(line => line is not null)
                    .Select(line => line.TrimEnd()));

            return new MatchReportPromptTemplate
            {
                Version = Version,
                SystemInstruction = systemInstruction,
                SystemInstructionLines = SystemInstructionLines
            };
        }
    }
}
