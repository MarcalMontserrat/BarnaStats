using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using GenerateAnalisys.Models;

namespace GenerateAnalisys.Services;

public sealed class OpenAiMatchReportService
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

    public OpenAiMatchReportService(string cacheDir)
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
                Console.WriteLine("Feature flag `BARNASTATS_ENABLE_AI_MATCH_REPORTS` desactivada. No se generaran nuevos resúmenes AI.");
                _disabledLogged = true;
            }

            return null;
        }

        if (string.IsNullOrWhiteSpace(_apiKey))
        {
            if (!_missingApiKeyLogged)
            {
                Console.WriteLine("Sin OPENAI_API_KEY. Se omiten los resúmenes AI y solo se reutilizará la caché existente.");
                _missingApiKeyLogged = true;
            }

            return null;
        }

        var summary = await GenerateSummaryAsync(match, statsRaw, movesRaw);
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

    private async Task<string?> GenerateSummaryAsync(StatsRoot match, string statsRaw, string? movesRaw)
    {
        try
        {
            var prompt = MatchReportPromptBuilder.Build(match, movesRaw);

            using var http = new HttpClient
            {
                BaseAddress = _baseUri,
                Timeout = TimeSpan.FromSeconds(90)
            };

            using var request = new HttpRequestMessage(HttpMethod.Post, "responses");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);

            var requestBody = new
            {
                model = _model,
                instructions = """
                               Eres una analista de baloncesto base. 
                               Escribe en espanol, con tono claro y natural, sin exagerar ni inventar nada.
                               Quiero un resumen corto para incrustar en una app:
                               - 1 titular corto
                               - 2 parrafos breves
                               - 3 bullets finales con claves del partido
                               Devuelve solo texto plano, sin markdown, sin encabezados JSON y sin comillas.
                               Basa el analisis solo en los datos recibidos.
                               """,
                input = prompt,
                max_output_tokens = 700
            };

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
            Console.WriteLine($"No se pudo generar el resumen AI del partido: {ex.Message}");
            return null;
        }
    }

    private static string? ExtractOutputText(string responseText)
    {
        using var document = JsonDocument.Parse(responseText);
        var root = document.RootElement;

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

    private static class MatchReportPromptBuilder
    {
        public static string Build(StatsRoot match, string? movesRaw)
        {
            var localTeam = match.Teams.FirstOrDefault(team => team.TeamIdIntern == match.LocalId)
                            ?? match.Teams.FirstOrDefault();
            var visitTeam = match.Teams.FirstOrDefault(team => team.TeamIdIntern == match.VisitId)
                            ?? match.Teams.Skip(1).FirstOrDefault();

            if (localTeam is null || visitTeam is null)
                return "Partido sin equipos validos.";

            var moves = TryDeserializeMoves(movesRaw);
            var prompt = new StringBuilder();

            prompt.AppendLine("RESUMEN TECNICO DEL PARTIDO");
            prompt.AppendLine($"Partido: {localTeam.Name} vs {visitTeam.Name}");
            prompt.AppendLine($"Fecha: {match.Time ?? "desconocida"}");
            prompt.AppendLine($"Marcador final: {localTeam.Data?.Score ?? 0}-{visitTeam.Data?.Score ?? 0}");
            prompt.AppendLine($"Puntos calculados por jugadoras: {SumPlayerPoints(localTeam)}-{SumPlayerPoints(visitTeam)}");
            prompt.AppendLine();

            prompt.AppendLine("PARCIALES POR PERIODO");
            foreach (var periodLine in BuildPeriodSummaries(match))
            {
                prompt.AppendLine($"- {periodLine}");
            }

            var leadSummary = BuildLeadSummary(match);
            if (!string.IsNullOrWhiteSpace(leadSummary))
            {
                prompt.AppendLine();
                prompt.AppendLine("DINAMICA DEL MARCADOR");
                prompt.AppendLine(leadSummary);
            }

            prompt.AppendLine();
            prompt.AppendLine("JUGADORAS DESTACADAS");
            foreach (var line in BuildTopPlayers(localTeam, "Local"))
                prompt.AppendLine($"- {line}");
            foreach (var line in BuildTopPlayers(visitTeam, "Visitante"))
                prompt.AppendLine($"- {line}");

            prompt.AppendLine();
            prompt.AppendLine("PLANTILLAS Y BOXSCORE");
            AppendTeamBoxScore(prompt, "Local", localTeam);
            AppendTeamBoxScore(prompt, "Visitante", visitTeam);

            if (moves.Count > 0)
            {
                prompt.AppendLine();
                prompt.AppendLine("EVENTOS RELEVANTES DEL PLAY-BY-PLAY");
                foreach (var line in BuildRelevantMoveLines(moves, localTeam, visitTeam))
                    prompt.AppendLine($"- {line}");
            }

            return prompt.ToString();
        }

        private static void AppendTeamBoxScore(StringBuilder prompt, string side, TeamInfo team)
        {
            prompt.AppendLine($"{side}: {team.Name}");

            foreach (var player in (team.Players ?? [])
                         .OrderByDescending(player => player.Data?.Score ?? 0)
                         .ThenByDescending(player => player.Data?.Valoration ?? 0)
                         .ThenBy(player => player.Name, StringComparer.OrdinalIgnoreCase))
            {
                var data = player.Data ?? new StatBlock();
                prompt.AppendLine(
                    $"  - {player.Name} #{player.Dorsal}: {data.Score} pts, {data.Valoration} val, {player.TimePlayed} min, T1 {data.ShotsOfOneSuccessful}/{data.ShotsOfOneAttempted}, T2 {data.ShotsOfTwoSuccessful}/{data.ShotsOfTwoAttempted}, T3 {data.ShotsOfThreeSuccessful}/{data.ShotsOfThreeAttempted}, faltas {data.Faults}");
            }
        }

        private static IEnumerable<string> BuildPeriodSummaries(StatsRoot match)
        {
            if (match.Score.Count == 0)
                yield break;

            var localRunning = 0;
            var visitRunning = 0;

            foreach (var group in match.Score
                         .GroupBy(point => point.Period)
                         .OrderBy(group => group.Key))
            {
                var finalPoint = group
                    .OrderBy(point => point.MinuteAbsolute)
                    .ThenBy(point => point.MinuteQuarter)
                    .Last();

                var localPeriod = finalPoint.Local - localRunning;
                var visitPeriod = finalPoint.Visit - visitRunning;

                yield return $"Periodo {group.Key}: {localPeriod}-{visitPeriod} (acumulado {finalPoint.Local}-{finalPoint.Visit})";

                localRunning = finalPoint.Local;
                visitRunning = finalPoint.Visit;
            }
        }

        private static string BuildLeadSummary(StatsRoot match)
        {
            if (match.Score.Count == 0)
                return "";

            var leadChanges = 0;
            var previousLeader = 0;
            var maxLocalLead = 0;
            var maxVisitLead = 0;

            foreach (var point in match.Score.OrderBy(point => point.MinuteAbsolute).ThenBy(point => point.Period))
            {
                var diff = point.Local - point.Visit;

                if (diff > maxLocalLead)
                    maxLocalLead = diff;

                if (-diff > maxVisitLead)
                    maxVisitLead = -diff;

                var leader = diff == 0 ? 0 : diff > 0 ? 1 : -1;
                if (leader != 0 && previousLeader != 0 && leader != previousLeader)
                    leadChanges += 1;

                if (leader != 0)
                    previousLeader = leader;
            }

            return $"Cambios de liderato: {leadChanges}. Maxima ventaja local: +{maxLocalLead}. Maxima ventaja visitante: +{maxVisitLead}.";
        }

        private static IEnumerable<string> BuildTopPlayers(TeamInfo team, string side)
        {
            return (team.Players ?? [])
                .OrderByDescending(player => player.Data?.Score ?? 0)
                .ThenByDescending(player => player.Data?.Valoration ?? 0)
                .Take(3)
                .Select(player =>
                {
                    var data = player.Data ?? new StatBlock();
                    return $"{side} {team.Name}: {player.Name} con {data.Score} pts, {data.Valoration} val y {player.TimePlayed} min";
                });
        }

        private static List<string> BuildRelevantMoveLines(
            IReadOnlyList<MoveEvent> moves,
            TeamInfo localTeam,
            TeamInfo visitTeam)
        {
            return moves
                .Where(move => IsRelevantMove(move.Move))
                .OrderBy(move => move.Period)
                .ThenByDescending(move => move.Min)
                .ThenByDescending(move => move.Sec)
                .Take(80)
                .Select(move =>
                {
                    var teamName = move.IdTeam == localTeam.TeamIdIntern
                        ? localTeam.Name
                        : move.IdTeam == visitTeam.TeamIdIntern
                            ? visitTeam.Name
                            : "Equipo";

                    return $"P{move.Period} {move.Min}:{move.Sec:00} · {teamName} · {move.ActorName} · {move.Move} · {move.Score}";
                })
                .ToList();
        }

        private static bool IsRelevantMove(string? moveName)
        {
            if (string.IsNullOrWhiteSpace(moveName))
                return false;

            return moveName.StartsWith("Cistella de", StringComparison.OrdinalIgnoreCase) ||
                   moveName.StartsWith("Temps mort", StringComparison.OrdinalIgnoreCase) ||
                   moveName.StartsWith("Final de període", StringComparison.OrdinalIgnoreCase) ||
                   moveName.StartsWith("Final de per", StringComparison.OrdinalIgnoreCase);
        }

        private static int SumPlayerPoints(TeamInfo team)
        {
            return (team.Players ?? []).Sum(player => player.Data?.Score ?? 0);
        }

        private static List<MoveEvent> TryDeserializeMoves(string? movesRaw)
        {
            if (string.IsNullOrWhiteSpace(movesRaw))
                return [];

            try
            {
                return JsonSerializer.Deserialize<List<MoveEvent>>(movesRaw) ?? [];
            }
            catch
            {
                return [];
            }
        }
    }
}
