using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using GenerateAnalisys.Models;

namespace GenerateAnalisys.Services;

public sealed class OpenAiMatchReportService : IMatchReportService
{
    private readonly string _cacheDir;
    private readonly HttpClient _httpClient;
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = true
    };
    private readonly AiRequestRetrySettings _retrySettings;
    private readonly Func<TimeSpan, Task> _delayAsync;
    private readonly MatchReportPromptTemplateLoader.MatchReportPromptTemplate _promptTemplate;

    private readonly string? _apiKey;
    private readonly string _model;
    private readonly Uri _baseUri;
    private readonly bool _enabled;
    private bool _missingApiKeyLogged;
    private bool _disabledLogged;

    public OpenAiMatchReportService(
        string cacheDir,
        HttpMessageHandler? httpMessageHandler = null,
        Func<TimeSpan, Task>? delayAsync = null)
    {
        _cacheDir = cacheDir;
        Directory.CreateDirectory(_cacheDir);

        _enabled = ParseBooleanFlag(
            Environment.GetEnvironmentVariable("BARNASTATS_ENABLE_AI_MATCH_REPORTS"));
        _apiKey = Environment.GetEnvironmentVariable("OPENAI_API_KEY");
        _model = Environment.GetEnvironmentVariable("BARNASTATS_OPENAI_MODEL")
                 ?? "gpt-4.1-mini";
        _baseUri = new Uri(
            Environment.GetEnvironmentVariable("OPENAI_BASE_URL")
            ?? "https://api.openai.com/v1/");
        _retrySettings = AiRequestRetrySettings.FromEnvironment();
        _delayAsync = delayAsync ?? Task.Delay;
        _promptTemplate = MatchReportPromptTemplateLoader.Load();
        _httpClient = httpMessageHandler is null
            ? new HttpClient()
            : new HttpClient(httpMessageHandler, disposeHandler: false);
        _httpClient.BaseAddress = _baseUri;
        _httpClient.Timeout = TimeSpan.FromSeconds(90);
    }

    public async Task<MatchReportResult?> GetOrGenerateAsync(
        int matchWebId,
        StatsRoot match,
        string statsRaw,
        string? movesRaw,
        int? focusTeamIdExtern = null)
    {
        var contentHash = ComputeContentHash(statsRaw, movesRaw, _promptTemplate.Version, focusTeamIdExtern);
        var cachePath = BuildCachePath(matchWebId, focusTeamIdExtern);
        var cached = await TryReadCacheAsync(cachePath);
        var hasMatchingCachedContent = cached is not null && cached.ContentHash == contentHash;

        if (cached is not null &&
            cached.ContentHash == contentHash &&
            string.Equals(cached.Model, _model, StringComparison.OrdinalIgnoreCase))
        {
            return ToResult(cached);
        }

        if (!_enabled)
        {
            if (!_disabledLogged)
            {
                Console.WriteLine("Feature flag `BARNASTATS_ENABLE_AI_MATCH_REPORTS` desactivada. No se generaran nuevos resúmenes AI.");
                _disabledLogged = true;
            }

            return hasMatchingCachedContent && cached is not null ? ToResult(cached) : null;
        }

        if (string.IsNullOrWhiteSpace(_apiKey))
        {
            if (!_missingApiKeyLogged)
            {
                Console.WriteLine("Sin OPENAI_API_KEY. Se omiten los resúmenes AI y solo se reutilizará la caché existente.");
                _missingApiKeyLogged = true;
            }

            return hasMatchingCachedContent && cached is not null ? ToResult(cached) : null;
        }

        var summary = await GenerateSummaryAsync(match, statsRaw, movesRaw, focusTeamIdExtern);
        if (string.IsNullOrWhiteSpace(summary))
            return null;

        var result = new MatchReportResult
        {
            Summary = summary.Trim(),
            ContentHash = contentHash,
            Model = _model,
            GeneratedAtUtc = DateTime.UtcNow
        };

        var cacheEntry = new MatchReportCacheEntry
        {
            MatchWebId = matchWebId,
            FocusTeamIdExtern = focusTeamIdExtern,
            ContentHash = result.ContentHash,
            Model = result.Model,
            GeneratedAtUtc = result.GeneratedAtUtc,
            Summary = result.Summary
        };

        await WriteCacheAsync(cachePath, cacheEntry);
        return result;
    }

    public async Task<MatchReportResult?> GetCachedAsync(
        int matchWebId,
        string statsRaw,
        string? movesRaw,
        int? focusTeamIdExtern = null)
    {
        var contentHash = ComputeContentHash(statsRaw, movesRaw, _promptTemplate.Version, focusTeamIdExtern);
        var cached = await TryReadCacheAsync(BuildCachePath(matchWebId, focusTeamIdExtern));

        return cached is not null && cached.ContentHash == contentHash
            ? ToResult(cached)
            : null;
    }

    private async Task<string?> GenerateSummaryAsync(StatsRoot match, string statsRaw, string? movesRaw, int? focusTeamIdExtern)
    {
        try
        {
            var prompt = MatchReportPromptBuilder.Build(match, statsRaw, movesRaw, focusTeamIdExtern);
            var requestBody = new
            {
                model = _model,
                instructions = _promptTemplate.SystemInstruction,
                input = prompt,
                max_output_tokens = 700
            };

            var payload = JsonSerializer.Serialize(requestBody);
            var responseText = await AiRequestRetryHelper.SendWithRetriesAsync(
                _httpClient,
                () =>
                {
                    var request = new HttpRequestMessage(HttpMethod.Post, "responses");
                    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
                    request.Content = new StringContent(payload, Encoding.UTF8, "application/json");
                    return request;
                },
                "OpenAI",
                _retrySettings,
                _delayAsync);
            return ExtractOutputText(responseText);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"No se pudo generar el resumen AI del partido: {ex.Message}");
            return null;
        }
    }

    private static string? ExtractOutputText(string responseText)
    {
        using var document = JsonDocument.Parse(responseText);
        var root = document.RootElement;
        var textBuilder = new StringBuilder();

        if (root.TryGetProperty("output_text", out var outputTextElement) &&
            outputTextElement.ValueKind == JsonValueKind.String)
        {
            return outputTextElement.GetString();
        }

        if (!root.TryGetProperty("output", out var outputArray) ||
            outputArray.ValueKind != JsonValueKind.Array)
        {
            return null;
        }

        foreach (var outputItem in outputArray.EnumerateArray())
        {
            if (!outputItem.TryGetProperty("content", out var contentArray) ||
                contentArray.ValueKind != JsonValueKind.Array)
            {
                continue;
            }

            foreach (var contentItem in contentArray.EnumerateArray())
            {
                if (contentItem.TryGetProperty("text", out var textElement) &&
                    textElement.ValueKind == JsonValueKind.String)
                {
                    textBuilder.Append(textElement.GetString());
                }
            }
        }

        return textBuilder.Length > 0
            ? textBuilder.ToString()
            : null;
    }

    private async Task<MatchReportCacheEntry?> TryReadCacheAsync(string cachePath)
    {
        if (!File.Exists(cachePath))
            return null;

        try
        {
            var cacheJson = await File.ReadAllTextAsync(cachePath);
            return JsonSerializer.Deserialize<MatchReportCacheEntry>(cacheJson, _jsonOptions);
        }
        catch
        {
            return null;
        }
    }

    private async Task WriteCacheAsync(string cachePath, MatchReportCacheEntry cacheEntry)
    {
        var json = JsonSerializer.Serialize(cacheEntry, _jsonOptions);
        await File.WriteAllTextAsync(cachePath, json);
    }

    private string BuildCachePath(int matchWebId, int? focusTeamIdExtern = null)
    {
        return Path.Combine(_cacheDir, MatchReportCacheFileName.Build(matchWebId, focusTeamIdExtern));
    }

    private static MatchReportResult ToResult(MatchReportCacheEntry cached)
    {
        return new MatchReportResult
        {
            Summary = cached.Summary,
            ContentHash = cached.ContentHash,
            Model = cached.Model,
            GeneratedAtUtc = cached.GeneratedAtUtc
        };
    }

    private static string ComputeContentHash(string statsRaw, string? movesRaw, string promptVersion, int? focusTeamIdExtern)
    {
        var normalized = $"{promptVersion}\n---focus-team---\n{focusTeamIdExtern?.ToString() ?? ""}\n---stats---\n{statsRaw.Trim()}\n---moves---\n{movesRaw?.Trim() ?? ""}";
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(normalized));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static bool ParseBooleanFlag(string? rawValue)
    {
        if (string.IsNullOrWhiteSpace(rawValue))
            return false;

        return rawValue.Equals("1", StringComparison.OrdinalIgnoreCase) ||
               rawValue.Equals("true", StringComparison.OrdinalIgnoreCase) ||
               rawValue.Equals("yes", StringComparison.OrdinalIgnoreCase) ||
               rawValue.Equals("on", StringComparison.OrdinalIgnoreCase);
    }
}
