using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using GenerateAnalisys.Models;

namespace GenerateAnalisys.Services;

public sealed class GeminiMatchReportService : IMatchReportService
{
    private const string PromptVersion = "match-report-v3";

    private readonly string _cacheDir;
    private readonly HttpClient _httpClient;
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = true
    };
    private readonly GeminiRequestQuotaLimiter _quotaLimiter;
    private readonly AiRequestRetrySettings _retrySettings;
    private readonly Func<TimeSpan, Task> _delayAsync;
    private readonly Func<DateTimeOffset> _nowProvider;
    private readonly int _maxOutputTokens;
    private readonly int? _thinkingBudget;

    private readonly string? _apiKey;
    private readonly string _model;
    private readonly Uri _baseUri;
    private readonly bool _enabled;
    private bool _missingApiKeyLogged;
    private bool _disabledLogged;
    private bool _dailyQuotaReached;
    public MatchReportFailure? LastFailure { get; private set; }

    public GeminiMatchReportService(
        string cacheDir,
        HttpMessageHandler? httpMessageHandler = null,
        Func<TimeSpan, Task>? delayAsync = null,
        Func<DateTimeOffset>? nowProvider = null,
        bool? enabledOverride = null)
    {
        _cacheDir = cacheDir;
        Directory.CreateDirectory(_cacheDir);

        _enabled = enabledOverride ?? ParseBooleanFlag(
            Environment.GetEnvironmentVariable("BARNASTATS_ENABLE_AI_MATCH_REPORTS"));
        _apiKey = Environment.GetEnvironmentVariable("GEMINI_API_KEY");
        _model = Environment.GetEnvironmentVariable("BARNASTATS_GEMINI_MODEL")
                 ?? "gemini-2.0-flash";
        _baseUri = new Uri(
            Environment.GetEnvironmentVariable("GEMINI_BASE_URL")
            ?? "https://generativelanguage.googleapis.com/v1beta/");
        _retrySettings = AiRequestRetrySettings.FromEnvironment();
        _delayAsync = delayAsync ?? Task.Delay;
        _nowProvider = nowProvider ?? (() => DateTimeOffset.Now);
        _maxOutputTokens = ParseInt("BARNASTATS_GEMINI_MAX_OUTPUT_TOKENS", 700, minValue: 1);
        _thinkingBudget = SupportsThinkingBudget(_model)
            ? ParseInt("BARNASTATS_GEMINI_THINKING_BUDGET", 0, minValue: -1)
            : null;
        _quotaLimiter = new GeminiRequestQuotaLimiter(_cacheDir, _delayAsync, _nowProvider);
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
        string? movesRaw)
    {
        LastFailure = null;
        var contentHash = ComputeContentHash(statsRaw, movesRaw);
        var cachePath = Path.Combine(_cacheDir, $"{matchWebId}.json");
        var cached = await TryReadCacheAsync(cachePath);

        if (cached is not null &&
            cached.ContentHash == contentHash &&
            string.Equals(cached.Model, _model, StringComparison.OrdinalIgnoreCase))
        {
            return new MatchReportResult
            {
                Summary = cached.Summary,
                ContentHash = cached.ContentHash,
                Model = cached.Model,
                GeneratedAtUtc = cached.GeneratedAtUtc
            };
        }

        if (!_enabled)
        {
            if (!_disabledLogged)
            {
                Console.WriteLine("Feature flag `BARNASTATS_ENABLE_AI_MATCH_REPORTS` desactivada. No se generarán nuevos resúmenes AI.");
                _disabledLogged = true;
            }

            LastFailure = new MatchReportFailure
            {
                Kind = MatchReportFailureKind.Disabled,
                Message = "La generación AI está desactivada por configuración."
            };
            return null;
        }

        if (string.IsNullOrWhiteSpace(_apiKey))
        {
            if (!_missingApiKeyLogged)
            {
                Console.WriteLine("Sin GEMINI_API_KEY. Se omiten los resúmenes AI y solo se reutilizará la caché existente.");
                _missingApiKeyLogged = true;
            }

            LastFailure = new MatchReportFailure
            {
                Kind = MatchReportFailureKind.MissingApiKey,
                Message = "Falta GEMINI_API_KEY."
            };
            return null;
        }

        var summary = await GenerateSummaryAsync(match, movesRaw);
        if (string.IsNullOrWhiteSpace(summary))
            return null;

        var result = new MatchReportResult
        {
            Summary = summary.Trim(),
            ContentHash = contentHash,
            Model = _model,
            GeneratedAtUtc = DateTime.UtcNow
        };
        LastFailure = null;

        var cacheEntry = new MatchReportCacheEntry
        {
            MatchWebId = matchWebId,
            ContentHash = result.ContentHash,
            Model = result.Model,
            GeneratedAtUtc = result.GeneratedAtUtc,
            Summary = result.Summary
        };

        await WriteCacheAsync(cachePath, cacheEntry);
        return result;
    }

    private async Task<string?> GenerateSummaryAsync(StatsRoot match, string? movesRaw)
    {
        if (_dailyQuotaReached)
        {
            LastFailure ??= new MatchReportFailure
            {
                Kind = MatchReportFailureKind.DailyQuotaReached,
                Message = "Gemini ya alcanzó el límite diario local en este proceso."
            };
            return null;
        }

        try
        {
            var prompt = MatchReportPromptBuilder.Build(match, movesRaw);
            var endpoint = $"models/{_model}:generateContent?key={_apiKey}";
            var generationConfig = new Dictionary<string, object?>
            {
                ["maxOutputTokens"] = _maxOutputTokens,
                ["responseMimeType"] = "text/plain"
            };

            if (_thinkingBudget.HasValue)
            {
                generationConfig["thinkingConfig"] = new Dictionary<string, object?>
                {
                    ["thinkingBudget"] = _thinkingBudget.Value
                };
            }

            var requestBody = new Dictionary<string, object?>
            {
                ["system_instruction"] = new
                {
                    parts = new[]
                    {
                        new
                        {
                            text = """
                                   Eres una analista de baloncesto base. 
                                   Escribe en español, con tono claro y natural, sin exagerar ni inventar nada.
                                   Quiero un resumen corto para incrustar en una app:
                                   - 1 titular corto
                                   - 2 parrafos breves
                                   - 3 bullets finales con claves del partido
                                   No te limites a narrar el marcador: incluye inferencias del partido basadas en señales concretas de los datos.
                                   Prioriza inferencias sobre: parciales, rachas, cambios de liderato, reparto anotador, perfil de tiro y cierre del partido.
                                   Si una inferencia depende de un dato concreto, mencionalo de forma natural.
                                   Si la evidencia es debil, usa lenguaje prudente: "apunta a", "sugiere", "parece".
                                   No inventes rebotes, asistencias, perdidas, defensa o ritmo si esos datos no aparecen.
                                   Devuelve solo texto plano, sin markdown, sin encabezados JSON y sin comillas.
                                   Basa el análisis solo en los datos recibidos.
                                   """
                        }
                    }
                },
                ["contents"] = new[]
                {
                    new
                    {
                        parts = new[]
                        {
                            new { text = prompt }
                        }
                    }
                },
                ["generationConfig"] = generationConfig
            };

            var payload = JsonSerializer.Serialize(requestBody);
            var responseText = await AiRequestRetryHelper.SendWithRetriesAsync(
                _httpClient,
                () =>
                {
                    var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
                    request.Content = new StringContent(payload, Encoding.UTF8, "application/json");
                    return request;
                },
                "Gemini",
                _retrySettings,
                _delayAsync,
                () => _quotaLimiter.WaitForAvailabilityAsync());
            if (string.IsNullOrWhiteSpace(responseText))
            {
                LastFailure = new MatchReportFailure
                {
                    Kind = MatchReportFailureKind.EmptyResponse,
                    Message = "Gemini devolvió una respuesta vacía."
                };
                return null;
            }

            var extractedText = ExtractOutputText(responseText);
            if (string.IsNullOrWhiteSpace(extractedText))
            {
                LastFailure = new MatchReportFailure
                {
                    Kind = MatchReportFailureKind.EmptyResponse,
                    Message = "Gemini respondió, pero sin texto utilizable."
                };
                return null;
            }

            LastFailure = null;
            return extractedText;
        }
        catch (GeminiDailyLimitExceededException ex)
        {
            _dailyQuotaReached = true;
            LastFailure = new MatchReportFailure
            {
                Kind = MatchReportFailureKind.DailyQuotaReached,
                Message = ex.Message
            };
            Console.WriteLine(ex.Message);
            return null;
        }
        catch (Exception ex)
        {
            LastFailure = new MatchReportFailure
            {
                Kind = MatchReportFailureKind.RequestFailed,
                Message = ex.Message
            };
            Console.WriteLine($"No se pudo generar el resumen AI del partido (Gemini): {ex.Message}");
            return null;
        }
    }

    private static string? ExtractOutputText(string responseText)
    {
        using var document = JsonDocument.Parse(responseText);
        var root = document.RootElement;
        var textBuilder = new StringBuilder();

        if (!root.TryGetProperty("candidates", out var candidates) ||
            candidates.ValueKind != JsonValueKind.Array)
        {
            return null;
        }

        foreach (var candidate in candidates.EnumerateArray())
        {
            if (!candidate.TryGetProperty("content", out var content))
                continue;

            if (!content.TryGetProperty("parts", out var parts) ||
                parts.ValueKind != JsonValueKind.Array)
            {
                continue;
            }

            foreach (var part in parts.EnumerateArray())
            {
                if (part.TryGetProperty("text", out var textElement) &&
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

    private static string ComputeContentHash(string statsRaw, string? movesRaw)
    {
        var normalized = $"{PromptVersion}\n---stats---\n{statsRaw.Trim()}\n---moves---\n{movesRaw?.Trim() ?? ""}";
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

    private static int ParseInt(string variableName, int defaultValue, int minValue)
    {
        var rawValue = Environment.GetEnvironmentVariable(variableName);
        if (!int.TryParse(rawValue, out var value))
            return defaultValue;

        return Math.Max(value, minValue);
    }

    private static bool SupportsThinkingBudget(string model)
    {
        return model.Contains("2.5", StringComparison.OrdinalIgnoreCase);
    }
}
