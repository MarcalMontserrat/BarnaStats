using System.Net;
using System.Text.RegularExpressions;
using BarnaStats.Api.Models;

namespace BarnaStats.Api.Services;

public sealed class BasquetCatalaLookupService
{
    private static readonly Regex OptionRegex = new(
        "<option\\s+value=\"(?<value>[^\"]+)\"[^>]*>(?<label>.*?)</option>",
        RegexOptions.IgnoreCase | RegexOptions.Compiled | RegexOptions.Singleline);

    private readonly HttpClient _httpClient;

    public BasquetCatalaLookupService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<IReadOnlyList<LookupOption>> GetCategoriesAsync(string gender, int territory, CancellationToken cancellationToken = default)
    {
        var normalizedGender = NormalizeGender(gender);
        var normalizedTerritory = NormalizeTerritory(territory);

        return await GetOptionsAsync(
            $"ajax/combo_categories2/{normalizedGender}/{normalizedTerritory}",
            cancellationToken
        );
    }

    public async Task<IReadOnlyList<LookupOption>> GetPhasesAsync(int categoryId, string gender, int territory, CancellationToken cancellationToken = default)
    {
        if (categoryId <= 0)
            return [];

        var normalizedGender = NormalizeGender(gender);
        var normalizedTerritory = NormalizeTerritory(territory);

        return await GetOptionsAsync(
            $"ajax/combo_competicions2/{categoryId}/{normalizedGender}/{normalizedTerritory}",
            cancellationToken
        );
    }

    public static string NormalizeGender(string? gender)
    {
        return string.Equals(gender, "M", StringComparison.OrdinalIgnoreCase) ? "M" : "F";
    }

    public static int NormalizeTerritory(int territory)
    {
        return territory < 0 ? 0 : territory;
    }

    private async Task<IReadOnlyList<LookupOption>> GetOptionsAsync(string relativePath, CancellationToken cancellationToken)
    {
        using var response = await _httpClient.GetAsync(relativePath, cancellationToken);
        response.EnsureSuccessStatusCode();

        var html = await response.Content.ReadAsStringAsync(cancellationToken);
        return ParseOptions(html);
    }

    internal static IReadOnlyList<LookupOption> ParseOptions(string html)
    {
        if (string.IsNullOrWhiteSpace(html))
            return [];

        var results = new List<LookupOption>();
        var seenValues = new HashSet<string>(StringComparer.Ordinal);

        foreach (Match match in OptionRegex.Matches(html))
        {
            var value = match.Groups["value"].Value.Trim();
            if (string.IsNullOrWhiteSpace(value) || value == "0" || !seenValues.Add(value))
                continue;

            var rawLabel = match.Groups["label"].Value;
            var withoutTags = Regex.Replace(rawLabel, "<.*?>", " ");
            var decodedLabel = WebUtility.HtmlDecode(withoutTags)
                .Replace('\u00A0', ' ');
            var label = Regex.Replace(decodedLabel, "\\s+", " ").Trim();

            if (string.IsNullOrWhiteSpace(label))
                continue;

            results.Add(new LookupOption
            {
                Value = value,
                Label = label
            });
        }

        return results;
    }
}
