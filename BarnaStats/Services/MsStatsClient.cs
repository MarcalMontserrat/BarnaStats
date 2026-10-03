using System.Net.Http.Headers;
using System.Text.RegularExpressions;

namespace BarnaStats.Services;

public sealed class MsStatsClient
{
    private const string BaseUrl = "https://msstats.optimalwayconsulting.com/v1/fcbq";
    private static readonly Regex StatsGuidRegex = new(
        "^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private readonly HttpClient _http;
    private readonly string? _bearerToken;

    public MsStatsClient(HttpClient http, string? bearerToken = null)
    {
        _http = http;
        _bearerToken = bearerToken;
    }

    // Desde la temporada 2026-2027 los partidos se identifican por GUID y usan `matches/{guid}/...` con token;
    // los de temporadas anteriores (24 hex) siguen con los endpoints antiguos.
    public static bool IsStatsGuid(string? uuidMatch)
    {
        return !string.IsNullOrWhiteSpace(uuidMatch) && StatsGuidRegex.IsMatch(uuidMatch);
    }

    public Task<string> GetMatchStatsRawAsync(string uuidMatch, bool currentSeason = true)
    {
        return IsStatsGuid(uuidMatch)
            ? GetAuthorizedAsync($"{BaseUrl}/matches/{uuidMatch}/stats?currentSeason={FormatBool(currentSeason)}", uuidMatch)
            : GetLegacyAsync($"{BaseUrl}/getJsonWithMatchStats/{uuidMatch}?currentSeason={FormatBool(currentSeason)}", uuidMatch);
    }

    public Task<string> GetMatchMovesRawAsync(string uuidMatch, bool currentSeason = true)
    {
        return IsStatsGuid(uuidMatch)
            ? GetAuthorizedAsync($"{BaseUrl}/matches/{uuidMatch}/pbp?currentSeason={FormatBool(currentSeason)}", uuidMatch)
            : GetLegacyAsync($"{BaseUrl}/getJsonWithMatchMoves/{uuidMatch}?currentSeason={FormatBool(currentSeason)}", uuidMatch);
    }

    private Task<string> GetLegacyAsync(string url, string uuidMatch)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Referrer = new Uri($"https://www.basquetcatala.cat/estadistiques/{uuidMatch}");
        request.Headers.TryAddWithoutValidation("Origin", "https://www.basquetcatala.cat");
        return SendAsync(request);
    }

    private Task<string> GetAuthorizedAsync(string url, string uuidMatch)
    {
        if (string.IsNullOrWhiteSpace(_bearerToken))
            throw new InvalidOperationException("Falta el token de msstats. Lanza la sync con navegador (sin --skip-mappings) para renovarlo.");

        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Referrer = new Uri("https://www.basquetcatala.cat/");
        request.Headers.TryAddWithoutValidation("Origin", "https://www.basquetcatala.cat");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _bearerToken);
        return SendAsync(request);
    }

    private async Task<string> SendAsync(HttpRequestMessage request)
    {
        using (request)
        {
            using var response = await _http.SendAsync(request);
            var content = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
                throw new HttpRequestException(
                    $"HTTP {(int)response.StatusCode} ({response.StatusCode}) — {content}",
                    inner: null,
                    statusCode: response.StatusCode);

            return content;
        }
    }

    private static string FormatBool(bool value) => value.ToString().ToLowerInvariant();
}
