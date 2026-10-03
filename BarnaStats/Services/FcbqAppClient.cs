using System.Net;
using System.Text;
using System.Text.Json;
using BarnaStats.Utilities;

namespace BarnaStats.Services;

// Acceso con la cuenta de la app de Bàsquet Català. Desde 2026-2027 algunas categorías (p. ej. Pre-mini) solo
// publican el detalle de jugadoras a usuarios identificados. La configuración sale de AppAccountSettings
// (variables de entorno o out/local-settings.json): nunca va al repo, y el token se guarda en out/tmp.
public sealed class FcbqAppClient
{
    private const string LoginUrl = "https://dsmulti-fcbq-public.optimalwayconsulting.com/public/users/login";
    private const string EsbBaseUrl = "https://esb.optimalwayconsulting.com/fcbq/1";
    private const string MsStatsBaseUrl = "https://msstats.optimalwayconsulting.com/v1/fcbq";
    private const string AppUserAgent = "BsquetCatal/25.10.34 CFNetwork/3860.700.2 Darwin/25.6.0";
    private const string AppVersion = "59";

    private readonly HttpClient _http;
    private readonly string _tokenFile;
    private readonly string _username;
    private readonly string _password;
    private readonly string? _esbKey;
    private string? _token;

    private FcbqAppClient(HttpClient http, string tokenFile, string username, string password, string? esbKey)
    {
        _http = http;
        _tokenFile = tokenFile;
        _username = username;
        _password = password;
        _esbKey = esbKey;
    }

    public static FcbqAppClient? TryCreate(HttpClient http, string tokenFile, AppAccountSettings settings)
    {
        if (!settings.IsConfigured)
            return null;

        return new FcbqAppClient(http, tokenFile, settings.User!, settings.Password ?? "", settings.EsbKey);
    }

    // matchWebId -> id de 24 hex del endpoint antiguo (`universallyid`), según el ESB de la fase.
    public async Task<IReadOnlyDictionary<int, string>> GetLegacyStatsIdsAsync(int phaseId)
    {
        if (string.IsNullOrWhiteSpace(_esbKey))
            throw new InvalidOperationException($"Falta la clave ESB ({AppAccountSettings.EsbKeyEnvVar} o {AppAccountSettings.FileName}) para relacionar los partidos con sus estadísticas de la app.");

        using var request = CreateAppRequest(HttpMethod.Get, $"{EsbBaseUrl}/{_esbKey}/FCBQWeb/resultats/{phaseId}", withToken: false);
        var content = await SendAsync(request);

        var result = new Dictionary<int, string>();
        using var document = JsonDocument.Parse(content);
        if (!document.RootElement.TryGetProperty("messageData", out var data) ||
            !data.TryGetProperty("rounds", out var rounds) ||
            rounds.ValueKind != JsonValueKind.Object)
        {
            return result;
        }

        foreach (var round in rounds.EnumerateObject())
        {
            if (!round.Value.TryGetProperty("matches", out var matches) || matches.ValueKind != JsonValueKind.Object)
                continue;

            foreach (var match in matches.EnumerateObject())
            {
                if (!int.TryParse(match.Name, out var matchWebId) ||
                    !match.Value.TryGetProperty("universallyid", out var universallyId) ||
                    universallyId.ValueKind != JsonValueKind.String ||
                    string.IsNullOrWhiteSpace(universallyId.GetString()))
                {
                    continue;
                }

                result[matchWebId] = universallyId.GetString()!;
            }
        }

        return result;
    }

    public Task<string> GetMatchStatsRawAsync(string legacyStatsId)
    {
        return GetAuthorizedAsync($"{MsStatsBaseUrl}/getJsonWithMatchStats/{legacyStatsId}?currentSeason=true");
    }

    public Task<string> GetMatchMovesRawAsync(string legacyStatsId)
    {
        return GetAuthorizedAsync($"{MsStatsBaseUrl}/getJsonWithMatchMoves/{legacyStatsId}?currentSeason=true");
    }

    private async Task<string> GetAuthorizedAsync(string url)
    {
        await EnsureTokenAsync(forceLogin: false);

        using (var request = CreateAppRequest(HttpMethod.Get, url, withToken: true))
        {
            using var response = await _http.SendAsync(request);
            if (response.StatusCode is not (HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden))
                return await ReadSuccessAsync(response);
        }

        // Token caducado o revocado: un login nuevo y un reintento.
        await EnsureTokenAsync(forceLogin: true);
        using var retry = CreateAppRequest(HttpMethod.Get, url, withToken: true);
        return await SendAsync(retry);
    }

    private async Task EnsureTokenAsync(bool forceLogin)
    {
        if (!forceLogin)
        {
            _token ??= MsStatsTokenStore.LoadValid(_tokenFile);
            if (_token is not null)
                return;
        }

        if (string.IsNullOrWhiteSpace(_password))
            throw new InvalidOperationException("La sesión de la app ha caducado y no hay contraseña configurada (llavero, local-settings.json o variable de entorno).");

        using var request = CreateAppRequest(HttpMethod.Post, LoginUrl, withToken: false);
        request.Content = new StringContent(
            JsonSerializer.Serialize(new { username = _username, password = _password }),
            Encoding.UTF8,
            "application/json");

        using var response = await _http.SendAsync(request);
        if (!response.IsSuccessStatusCode)
            throw new HttpRequestException($"Login en la app de Bàsquet Català fallido: HTTP {(int)response.StatusCode}.", null, response.StatusCode);

        // La app recibe el token en la cabecera `Authorization` de una respuesta 204 sin cuerpo.
        var authorization = response.Headers.TryGetValues("Authorization", out var values)
            ? values.FirstOrDefault()
            : null;
        if (string.IsNullOrWhiteSpace(authorization))
            throw new InvalidOperationException("El login de la app no devolvió token.");

        _token = MsStatsTokenStore.NormalizeToken(authorization);
        MsStatsTokenStore.Save(_tokenFile, _token);
        Console.WriteLine($"Sesión de la app renovada (caduca {MsStatsTokenStore.TryGetExpiration(_token)?.ToLocalTime():dd/MM/yyyy}).");
    }

    private HttpRequestMessage CreateAppRequest(HttpMethod method, string url, bool withToken)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.TryAddWithoutValidation("federation", "fcbq");
        request.Headers.TryAddWithoutValidation("x-app-origin", "basket");
        request.Headers.TryAddWithoutValidation("x-origin", "app");
        request.Headers.TryAddWithoutValidation("x-app-version", AppVersion);
        request.Headers.TryAddWithoutValidation("Accept-Language", "ca");
        request.Headers.UserAgent.Clear();
        request.Headers.TryAddWithoutValidation("User-Agent", AppUserAgent);
        if (withToken && !string.IsNullOrWhiteSpace(_token))
            request.Headers.TryAddWithoutValidation("Authorization", $"Bearer {_token}");

        return request;
    }

    private async Task<string> SendAsync(HttpRequestMessage request)
    {
        using var response = await _http.SendAsync(request);
        return await ReadSuccessAsync(response);
    }

    private static async Task<string> ReadSuccessAsync(HttpResponseMessage response)
    {
        var content = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
            throw new HttpRequestException($"HTTP {(int)response.StatusCode} ({response.StatusCode}) — {content}", null, response.StatusCode);

        return content;
    }
}
