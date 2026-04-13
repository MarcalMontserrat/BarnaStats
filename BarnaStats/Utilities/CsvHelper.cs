namespace BarnaStats.Utilities;

public static class CsvHelper
{
    public static string Escape(string? value)
    {
        value ??= "";
        value = value.Replace("\"", "\"\"");
        return $"\"{value}\"";
    }
}
