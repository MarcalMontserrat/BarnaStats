using System.Text.Json;
using GenerateAnalisys.Models;

namespace GenerateAnalisys.Utilities;

public static class AnalysisJsonWriter
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true
    };

    public static async Task WriteAsync(string path, AnalysisResult analysis)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var json = JsonSerializer.Serialize(analysis, JsonOptions);
        await File.WriteAllTextAsync(path, json);
    }
}
