using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using GenerateAnalisys.Models;

namespace GenerateAnalisys.Services;

public sealed class GeminiMatchReportService : IMatchReportService
{
    private const string PromptVersion = "match-report-v1";

    private readonly string _cacheDir;
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = true
    };

    private readonly string? _apiKey;
    private readonly string _model;
    private readonly Uri _baseUri;
    private readonly bool _enabled;
    private bool _missingApiKeyLogged;
    private bool _disabledLogged;

    public GeminiMatchReportService(string cacheDir)
    {
        _cacheDir = cacheDir;
        Directory.CreateDirectory(_cacheDir);

        _enabled = ParseBooleanFlag(
            Environment.GetEnvironmentVariable("BARNASTATS_ENABLE_AI_MATCH_REPORTS"));
        _apiKey = Environment.GetEnvironmentVariable("GEMINI_API_KEY");
        _model = Environment.GetEnvironmentVariable("BARNASTATS_GEMINI_MODEL")
                 ?? "gemini-2.0-flash";
        _baseUri = new Uri(
            Environment.GetEnvironmentVariable("GEMINI_BASE_URL")
            ?? "https://generativelanguage.googleapis.com/v1beta/");
    }

    public async Task<MatchReportResult?> GetOrGenerateAsync(
        int matchWebId,
        StatsRoot match,
        string statsRaw,
        string? movesRaw)
    {
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

            return null;
        }

        if (string.IsNullOrWhiteSpace(_apiKey))
        {
            if (!_missingApiKeyLogged)
            {
                Console.WriteLine("Sin GEMINI_API_KEY. Se omiten los resúmenes AI y solo se reutilizará la caché existente.");
                _missingApiKeyLogged = true;
            }

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
        try
        {
            var prompt = MatchReportPromptBuilder.Build(match, movesRaw);

            using var http = new HttpClient
            {
                BaseAddress = _baseUri,
                Timeout = TimeSpan.FromSeconds(90)
            };

            var endpoint = $"models/{_model}:generateContent?key={_apiKey}";

            var requestBody = new
            {
                system_instruction = new
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
                                   Devuelve solo texto plano, sin markdown, sin encabezados JSON y sin comillas.
                                   Basa el análisis solo en los datos recibidos.
                                   """
                        }
                    }
                },
                contents = new[]
                {
                    new
                    {
                        parts = new[]
                        {
                            new { text = prompt }
                        }
                    }
                },
                generationConfig = new
                {
                    maxOutputTokens = 700
                }
            };

            using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
            request.Content = new StringContent(
                JsonSerializer.Serialize(requestBody),
                Encoding.UTF8,
                "application/json");

            using var response = await http.SendAsync(request);
            var responseText = await response.Content.ReadAsStringAsync();
            response.EnsureSuccessStatusCode();

            return ExtractOutputText(responseText);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"No se pudo generar el resumen AI del partido (Gemini): {ex.Message}");
            return null;
        }
    }

    private static string? ExtractOutputText(string responseText)
    {
        using var document = JsonDocument.Parse(responseText);
        var root = document.RootElement;

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
                    return textElement.GetString();
                }
            }
        }

        return null;
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
}
