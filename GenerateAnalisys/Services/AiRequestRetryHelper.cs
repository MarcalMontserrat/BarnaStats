using System.Net;

namespace GenerateAnalisys.Services;

internal sealed class AiProviderRequestException : HttpRequestException
{
    public AiProviderRequestException(
        string providerName,
        HttpStatusCode statusCode,
        string? reasonPhrase,
        string responseText,
        bool isRetryableStatusCode)
        : base(
            $"{providerName} respondió {(int)statusCode} {reasonPhrase}. {AiRequestRetryHelper.SummarizeBody(responseText)}",
            inner: null,
            statusCode: statusCode)
    {
        ProviderName = providerName;
        IsRetryableStatusCode = isRetryableStatusCode;
    }

    public string ProviderName { get; }
    public bool IsRetryableStatusCode { get; }
}

internal sealed class AiRequestRetrySettings
{
    public int MaxRetries { get; init; } = 4;
    public TimeSpan BaseDelay { get; init; } = TimeSpan.FromSeconds(2);
    public TimeSpan MaxDelay { get; init; } = TimeSpan.FromSeconds(30);

    public static AiRequestRetrySettings FromEnvironment()
    {
        return new AiRequestRetrySettings
        {
            MaxRetries = ParseInt("BARNASTATS_AI_MAX_RETRIES", 4, minValue: 0),
            BaseDelay = TimeSpan.FromMilliseconds(ParseInt("BARNASTATS_AI_RETRY_BASE_DELAY_MS", 2000, minValue: 1)),
            MaxDelay = TimeSpan.FromMilliseconds(ParseInt("BARNASTATS_AI_RETRY_MAX_DELAY_MS", 30000, minValue: 1))
        };
    }

    private static int ParseInt(string variableName, int defaultValue, int minValue)
    {
        var rawValue = Environment.GetEnvironmentVariable(variableName);
        if (!int.TryParse(rawValue, out var value))
            return defaultValue;

        return Math.Max(value, minValue);
    }
}

internal static class AiRequestRetryHelper
{
    public static async Task<string> SendWithRetriesAsync(
        HttpClient httpClient,
        Func<HttpRequestMessage> createRequest,
        string providerName,
        AiRequestRetrySettings settings,
        Func<TimeSpan, Task> delayAsync,
        Func<Task>? beforeSendAsync = null)
    {
        for (var attempt = 0; ; attempt += 1)
        {
            if (beforeSendAsync is not null)
            {
                await beforeSendAsync();
            }

            using var request = createRequest();
            using var response = await httpClient.SendAsync(request);
            var responseText = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
                return responseText;

            var retryDelay = GetRetryDelay(response, attempt, settings);
            if (retryDelay is null || attempt >= settings.MaxRetries)
            {
                throw new AiProviderRequestException(
                    providerName,
                    response.StatusCode,
                    response.ReasonPhrase,
                    responseText,
                    IsRetryableStatusCode(response.StatusCode));
            }

            Console.WriteLine(
                $"{providerName} respondió {(int)response.StatusCode} {response.ReasonPhrase}. Reintentando en {retryDelay.Value.TotalSeconds:0.#} s ({attempt + 1}/{settings.MaxRetries}).");
            await delayAsync(retryDelay.Value);
        }
    }

    private static TimeSpan? GetRetryDelay(
        HttpResponseMessage response,
        int attempt,
        AiRequestRetrySettings settings)
    {
        if (!IsRetryableStatusCode(response.StatusCode))
            return null;

        var retryAfter = response.Headers.RetryAfter;
        if (retryAfter?.Delta is { } delta && delta > TimeSpan.Zero)
            return delta;

        if (retryAfter?.Date is { } date)
        {
            var fromHeader = date - DateTimeOffset.UtcNow;
            if (fromHeader > TimeSpan.Zero)
                return fromHeader;
        }

        var multiplier = Math.Pow(2, attempt);
        var computedDelay = TimeSpan.FromMilliseconds(settings.BaseDelay.TotalMilliseconds * multiplier);
        return computedDelay <= settings.MaxDelay
            ? computedDelay
            : settings.MaxDelay;
    }

    private static bool IsRetryableStatusCode(HttpStatusCode statusCode)
    {
        return statusCode == HttpStatusCode.RequestTimeout ||
               statusCode == HttpStatusCode.TooManyRequests ||
               statusCode == HttpStatusCode.BadGateway ||
               statusCode == HttpStatusCode.ServiceUnavailable ||
               statusCode == HttpStatusCode.GatewayTimeout ||
               statusCode == HttpStatusCode.InternalServerError;
    }

    internal static string SummarizeBody(string responseText)
    {
        if (string.IsNullOrWhiteSpace(responseText))
            return "Sin cuerpo de respuesta.";

        var normalized = responseText
            .Replace('\r', ' ')
            .Replace('\n', ' ')
            .Trim();

        const int maxLength = 280;
        return normalized.Length <= maxLength
            ? normalized
            : $"{normalized[..maxLength]}...";
    }
}
