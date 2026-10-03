using System.Text;
using System.Text.Json;

namespace BarnaStats.Services;

// Token de la web pública de basquetcatala para msstats (desde 2026-2027 los endpoints de partido lo exigen).
// Dura ~2 h: lo captura la sesión de navegador de la sync y la descarga HTTP lo reutiliza desde fichero.
public static class MsStatsTokenStore
{
    private static readonly TimeSpan MinimumRemainingLifetime = TimeSpan.FromMinutes(10);

    public static string? LoadValid(string tokenFile)
    {
        try
        {
            if (!File.Exists(tokenFile))
                return null;

            var token = File.ReadAllText(tokenFile).Trim();
            if (string.IsNullOrWhiteSpace(token))
                return null;

            var expiresAtUtc = TryGetExpiration(token);
            return expiresAtUtc.HasValue && expiresAtUtc.Value - DateTimeOffset.UtcNow > MinimumRemainingLifetime
                ? token
                : null;
        }
        catch (IOException)
        {
            return null;
        }
    }

    public static void Save(string tokenFile, string token)
    {
        var directory = Path.GetDirectoryName(Path.GetFullPath(tokenFile));
        if (!string.IsNullOrWhiteSpace(directory))
            Directory.CreateDirectory(directory);

        File.WriteAllText(tokenFile, NormalizeToken(token));
    }

    public static string NormalizeToken(string rawToken)
    {
        var token = rawToken.Trim();
        return token.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
            ? token["Bearer ".Length..].Trim()
            : token;
    }

    public static DateTimeOffset? TryGetExpiration(string token)
    {
        var segments = NormalizeToken(token).Split('.');
        if (segments.Length < 2)
            return null;

        try
        {
            var payload = segments[1].Replace('-', '+').Replace('_', '/');
            payload = payload.PadRight(payload.Length + (4 - payload.Length % 4) % 4, '=');

            using var document = JsonDocument.Parse(Encoding.UTF8.GetString(Convert.FromBase64String(payload)));
            return document.RootElement.TryGetProperty("exp", out var exp) && exp.TryGetInt64(out var expSeconds)
                ? DateTimeOffset.FromUnixTimeSeconds(expSeconds)
                : null;
        }
        catch (FormatException)
        {
            return null;
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
