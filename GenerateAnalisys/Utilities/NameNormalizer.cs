using System.Globalization;
using System.Text;
using NormalizationForm = System.Text.NormalizationForm;

namespace GenerateAnalisys.Utilities;

public static class NameNormalizer
{
    public static string Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return string.Empty;

        var trimmed = string.Join(" ", value.Trim().ToUpperInvariant()
            .Split(' ', StringSplitOptions.RemoveEmptyEntries));

        var normalized = trimmed.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(normalized.Length);

        foreach (var ch in normalized)
        {
            var category = CharUnicodeInfo.GetUnicodeCategory(ch);
            if (category != UnicodeCategory.NonSpacingMark)
                sb.Append(ch);
        }

        return sb.ToString().Normalize(NormalizationForm.FormC);
    }
}
