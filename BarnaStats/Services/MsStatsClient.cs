namespace BarnaStats.Services;

public sealed class MsStatsClient
{
    private readonly HttpClient _http;

    public MsStatsClient(HttpClient http)
    {
        _http = http;
    }

    public async Task<string> GetMatchStatsRawAsync(string uuidMatch, bool currentSeason = true)
    {
        var url =
            $"https://msstats.optimalwayconsulting.com/v1/fcbq/getJsonWithMatchStats/{uuidMatch}?currentSeason={currentSeason.ToString().ToLowerInvariant()}";

        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Referrer = new Uri($"https://www.basquetcatala.cat/estadistiques/{uuidMatch}");
        request.Headers.TryAddWithoutValidation("Origin", "https://www.basquetcatala.cat");

        using var response = await _http.SendAsync(request);
        var content = await response.Content.ReadAsStringAsync();

        response.EnsureSuccessStatusCode();
        return content;
    }

    public async Task<string> GetMatchMovesRawAsync(string uuidMatch, bool currentSeason = true)
    {
        var url =
            $"https://msstats.optimalwayconsulting.com/v1/fcbq/getJsonWithMatchMoves/{uuidMatch}?currentSeason={currentSeason.ToString().ToLowerInvariant()}";

        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Referrer = new Uri($"https://www.basquetcatala.cat/estadistiques/{uuidMatch}");
        request.Headers.TryAddWithoutValidation("Origin", "https://www.basquetcatala.cat");

        using var response = await _http.SendAsync(request);
        var content = await response.Content.ReadAsStringAsync();

        response.EnsureSuccessStatusCode();
        return content;
    }
}
