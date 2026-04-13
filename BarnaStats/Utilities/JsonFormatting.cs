using System.Text.Json;

namespace BarnaStats.Utilities;

public static class JsonFormatting
{
    public static string PrettyPrint(string raw)
    {
        using var doc = JsonDocument.Parse(raw);
        return JsonSerializer.Serialize(doc.RootElement, new JsonSerializerOptions
        {
            WriteIndented = true
        });
    }
}
