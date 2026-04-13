using System.Text.Json;

namespace BarnaStats.Utilities;

public static class JsonElementSearch
{
    public static string? FindString(JsonElement element, string propertyName)
    {
        if (TryFindProperty(element, propertyName, out var found) &&
            found.ValueKind == JsonValueKind.String)
        {
            return found.GetString();
        }

        return null;
    }

    public static int? FindInt(JsonElement element, string propertyName)
    {
        if (!TryFindProperty(element, propertyName, out var found))
            return null;

        if (found.ValueKind == JsonValueKind.Number && found.TryGetInt32(out var number))
            return number;

        if (found.ValueKind == JsonValueKind.String &&
            int.TryParse(found.GetString(), out var parsed))
        {
            return parsed;
        }

        return null;
    }

    private static bool TryFindProperty(JsonElement element, string propertyName, out JsonElement value)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                foreach (var prop in element.EnumerateObject())
                {
                    if (string.Equals(prop.Name, propertyName, StringComparison.OrdinalIgnoreCase))
                    {
                        value = prop.Value;
                        return true;
                    }

                    if (TryFindProperty(prop.Value, propertyName, out value))
                        return true;
                }
                break;

            case JsonValueKind.Array:
                foreach (var item in element.EnumerateArray())
                {
                    if (TryFindProperty(item, propertyName, out value))
                        return true;
                }
                break;
        }

        value = default;
        return false;
    }
}
