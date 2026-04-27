using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using GenerateAnalisys.Models;
using GenerateAnalisys.Services;

namespace GenerateAnalisys.Tests;

public sealed class MatchReportServiceRetryTests
{
    [Fact]
    public async Task Gemini_retries_too_many_requests_using_retry_after()
    {
        using var environment = new EnvironmentVariableScope(
            ("BARNASTATS_ENABLE_AI_MATCH_REPORTS", "true"),
            ("BARNASTATS_AI_MAX_RETRIES", "2"),
            ("GEMINI_API_KEY", "test-gemini-key"));
        using var sandbox = new TemporaryDirectory();

        var delays = new List<TimeSpan>();
        var handler = new SequenceHttpMessageHandler(
            _ =>
            {
                var response = new HttpResponseMessage(HttpStatusCode.TooManyRequests)
                {
                    Content = new StringContent("""{"error":{"message":"quota exceeded"}}""")
                };
                response.Headers.RetryAfter = new RetryConditionHeaderValue(TimeSpan.FromSeconds(7));
                return response;
            },
            request =>
            {
                Assert.Equal(HttpMethod.Post, request.Method);
                Assert.Contains(
                    "models/gemini-2.0-flash:generateContent?key=test-gemini-key",
                    request.RequestUri?.ToString());

                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent("""{"candidates":[{"content":{"parts":[{"text":"Titular\n\n"},{"text":"Resumen del partido"}]}}]}""")
                };
            });

        var service = new GeminiMatchReportService(
            Path.Combine(sandbox.Path, "match-reports"),
            handler,
            delay =>
            {
                delays.Add(delay);
                return Task.CompletedTask;
            });

        var result = await service.GetOrGenerateAsync(34951, BuildMatch(), """{"match":"fixture"}""", null);

        Assert.NotNull(result);
        Assert.Equal("Titular\n\nResumen del partido", result.Summary);
        Assert.Equal(2, handler.CallCount);
        Assert.Equal(TimeSpan.FromSeconds(7), Assert.Single(delays));
    }

    [Fact]
    public async Task Gemini_2_5_disables_thinking_and_requests_plain_text_output()
    {
        using var environment = new EnvironmentVariableScope(
            ("BARNASTATS_ENABLE_AI_MATCH_REPORTS", "true"),
            ("BARNASTATS_GEMINI_MODEL", "gemini-2.5-flash"),
            ("GEMINI_API_KEY", "test-gemini-key"));
        using var sandbox = new TemporaryDirectory();

        var handler = new SequenceHttpMessageHandler(
            request =>
            {
                var body = request.Content?.ReadAsStringAsync().GetAwaiter().GetResult();
                Assert.False(string.IsNullOrWhiteSpace(body));

                using var document = JsonDocument.Parse(body!);
                var generationConfig = document.RootElement.GetProperty("generationConfig");
                Assert.Equal(700, generationConfig.GetProperty("maxOutputTokens").GetInt32());
                Assert.Equal("text/plain", generationConfig.GetProperty("responseMimeType").GetString());
                Assert.Equal(0, generationConfig
                    .GetProperty("thinkingConfig")
                    .GetProperty("thinkingBudget")
                    .GetInt32());

                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent("""{"candidates":[{"content":{"parts":[{"text":"Resumen Gemini completo"}]}}]}""")
                };
            });

        var service = new GeminiMatchReportService(
            Path.Combine(sandbox.Path, "match-reports"),
            handler);

        var result = await service.GetOrGenerateAsync(34951, BuildMatch(), """{"match":"fixture"}""", null);

        Assert.NotNull(result);
        Assert.Equal("Resumen Gemini completo", result.Summary);
        Assert.Equal(1, handler.CallCount);
    }

    [Fact]
    public async Task Gemini_includes_focus_team_context_and_uses_dedicated_cache_file()
    {
        using var environment = new EnvironmentVariableScope(
            ("BARNASTATS_ENABLE_AI_MATCH_REPORTS", "true"),
            ("GEMINI_API_KEY", "test-gemini-key"));
        using var sandbox = new TemporaryDirectory();

        var cacheDir = Path.Combine(sandbox.Path, "match-reports");
        var handler = new SequenceHttpMessageHandler(
            request =>
            {
                var body = request.Content?.ReadAsStringAsync().GetAwaiter().GetResult();
                Assert.False(string.IsNullOrWhiteSpace(body));

                using var document = JsonDocument.Parse(body!);
                var prompt = document.RootElement
                    .GetProperty("contents")[0]
                    .GetProperty("parts")[0]
                    .GetProperty("text")
                    .GetString();

                Assert.Contains("PERSPECTIVA SOLICITADA", prompt);
                Assert.Contains("Enfoca el análisis en Barna Local.", prompt);

                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent("""{"candidates":[{"content":{"parts":[{"text":"Resumen enfocado"}]}}]}""")
                };
            });

        var service = new GeminiMatchReportService(cacheDir, handler);

        var result = await service.GetOrGenerateAsync(
            34951,
            BuildMatch(),
            """{"match":"fixture"}""",
            null,
            focusTeamIdExtern: 1001);

        Assert.NotNull(result);
        Assert.Equal("Resumen enfocado", result.Summary);
        Assert.Equal(1, handler.CallCount);
        Assert.True(File.Exists(Path.Combine(cacheDir, "34951__team-1001.json")));
    }

    [Fact]
    public async Task OpenAi_retries_transient_server_errors_with_exponential_backoff()
    {
        using var environment = new EnvironmentVariableScope(
            ("BARNASTATS_ENABLE_AI_MATCH_REPORTS", "true"),
            ("BARNASTATS_AI_MAX_RETRIES", "2"),
            ("BARNASTATS_AI_RETRY_BASE_DELAY_MS", "1500"),
            ("BARNASTATS_AI_RETRY_MAX_DELAY_MS", "5000"),
            ("OPENAI_API_KEY", "test-openai-key"));
        using var sandbox = new TemporaryDirectory();

        var delays = new List<TimeSpan>();
        var handler = new SequenceHttpMessageHandler(
            _ => new HttpResponseMessage(HttpStatusCode.ServiceUnavailable)
            {
                Content = new StringContent("""{"error":{"message":"temporary overload"}}""")
            },
            request =>
            {
                Assert.Equal(HttpMethod.Post, request.Method);
                Assert.Equal("Bearer", request.Headers.Authorization?.Scheme);
                Assert.Equal("test-openai-key", request.Headers.Authorization?.Parameter);
                Assert.EndsWith("/responses", request.RequestUri?.AbsolutePath);

                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent("""{"output":[{"content":[{"text":"Resumen "},{"text":"OpenAI"}]}]}""")
                };
            });

        var service = new OpenAiMatchReportService(
            Path.Combine(sandbox.Path, "match-reports"),
            handler,
            delay =>
            {
                delays.Add(delay);
                return Task.CompletedTask;
            });

        var result = await service.GetOrGenerateAsync(34951, BuildMatch(), """{"match":"fixture"}""", null);

        Assert.NotNull(result);
        Assert.Equal("Resumen OpenAI", result.Summary);
        Assert.Equal(2, handler.CallCount);
        Assert.Equal(TimeSpan.FromMilliseconds(1500), Assert.Single(delays));
    }

    [Fact]
    public async Task Gemini_waits_when_local_per_minute_limit_is_reached()
    {
        using var environment = new EnvironmentVariableScope(
            ("BARNASTATS_ENABLE_AI_MATCH_REPORTS", "true"),
            ("GEMINI_API_KEY", "test-gemini-key"));
        using var sandbox = new TemporaryDirectory();

        var clock = new MutableClock(new DateTimeOffset(2026, 4, 26, 12, 0, 0, TimeSpan.FromHours(2)));
        await WriteGeminiQuotaStateAsync(
            Path.Combine(sandbox.Path, "match-reports"),
            clock.Now.ToString("yyyy-MM-dd"),
            300,
            Enumerable.Range(0, 15)
                .Select(index => clock.Now.AddSeconds(-(55 - index)))
                .ToArray());

        var handler = new SequenceHttpMessageHandler(
            _ => new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("""{"candidates":[{"content":{"parts":[{"text":"Resumen tras espera"}]}}]}""")
            });

        var service = new GeminiMatchReportService(
            Path.Combine(sandbox.Path, "match-reports"),
            handler,
            clock.DelayAsync,
            clock.GetNow);

        var result = await service.GetOrGenerateAsync(34951, BuildMatch(), """{"match":"fixture"}""", null);

        Assert.NotNull(result);
        Assert.Equal("Resumen tras espera", result.Summary);
        Assert.Equal(1, handler.CallCount);
        Assert.Equal(TimeSpan.FromSeconds(5), Assert.Single(clock.Delays));
    }

    [Fact]
    public async Task Gemini_stops_when_local_daily_limit_is_reached()
    {
        using var environment = new EnvironmentVariableScope(
            ("BARNASTATS_ENABLE_AI_MATCH_REPORTS", "true"),
            ("GEMINI_API_KEY", "test-gemini-key"));
        using var sandbox = new TemporaryDirectory();

        var clock = new MutableClock(new DateTimeOffset(2026, 4, 26, 12, 0, 0, TimeSpan.FromHours(2)));
        await WriteGeminiQuotaStateAsync(
            Path.Combine(sandbox.Path, "match-reports"),
            clock.Now.ToString("yyyy-MM-dd"),
            1000,
            []);

        var handler = new SequenceHttpMessageHandler(
            _ => new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("""{"candidates":[{"content":{"parts":[{"text":"No debería llegar"}]}}]}""")
            });

        var service = new GeminiMatchReportService(
            Path.Combine(sandbox.Path, "match-reports"),
            handler,
            clock.DelayAsync,
            clock.GetNow);

        var result = await service.GetOrGenerateAsync(34951, BuildMatch(), """{"match":"fixture"}""", null);

        Assert.Null(result);
        Assert.Equal(0, handler.CallCount);
        Assert.Empty(clock.Delays);
    }

    private static StatsRoot BuildMatch()
    {
        return new StatsRoot
        {
            IdMatchIntern = 34951,
            IdMatchExtern = 134951,
            LocalId = 1,
            VisitId = 2,
            Time = "2026-04-26T12:00:00+02:00",
            Score =
            [
                new ScoreTimelinePoint
                {
                    Local = 10,
                    Visit = 8,
                    MinuteAbsolute = 10,
                    MinuteQuarter = 10,
                    Period = 1
                }
            ],
            Teams =
            [
                new TeamInfo
                {
                    TeamIdIntern = 1,
                    TeamIdExtern = 1001,
                    Name = "Barna Local",
                    Data = new StatBlock
                    {
                        Score = 10
                    },
                    Players =
                    [
                        new PlayerInfo
                        {
                            ActorId = 11,
                            Name = "Jugadora Local",
                            Dorsal = "7",
                            TimePlayed = 20,
                            Data = new StatBlock
                            {
                                Score = 10,
                                Valoration = 12,
                                ShotsOfTwoSuccessful = 5,
                                ShotsOfTwoAttempted = 8
                            }
                        }
                    ]
                },
                new TeamInfo
                {
                    TeamIdIntern = 2,
                    TeamIdExtern = 1002,
                    Name = "Barna Visitante",
                    Data = new StatBlock
                    {
                        Score = 8
                    },
                    Players =
                    [
                        new PlayerInfo
                        {
                            ActorId = 21,
                            Name = "Jugadora Visitante",
                            Dorsal = "9",
                            TimePlayed = 20,
                            Data = new StatBlock
                            {
                                Score = 8,
                                Valoration = 9,
                                ShotsOfTwoSuccessful = 4,
                                ShotsOfTwoAttempted = 9
                            }
                        }
                    ]
                }
            ]
        };
    }

    private sealed class SequenceHttpMessageHandler : HttpMessageHandler
    {
        private readonly Queue<Func<HttpRequestMessage, HttpResponseMessage>> _responses;

        public SequenceHttpMessageHandler(params Func<HttpRequestMessage, HttpResponseMessage>[] responses)
        {
            _responses = new Queue<Func<HttpRequestMessage, HttpResponseMessage>>(responses);
        }

        public int CallCount { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            CallCount += 1;

            if (_responses.Count == 0)
                throw new InvalidOperationException("No hay más respuestas configuradas para el handler de prueba.");

            return Task.FromResult(_responses.Dequeue()(request));
        }
    }

    private sealed class EnvironmentVariableScope : IDisposable
    {
        private readonly Dictionary<string, string?> _previousValues = new(StringComparer.Ordinal);

        public EnvironmentVariableScope(params (string Name, string? Value)[] entries)
        {
            foreach (var (name, value) in entries)
            {
                _previousValues[name] = Environment.GetEnvironmentVariable(name);
                Environment.SetEnvironmentVariable(name, value);
            }
        }

        public void Dispose()
        {
            foreach (var entry in _previousValues)
            {
                Environment.SetEnvironmentVariable(entry.Key, entry.Value);
            }
        }
    }

    private static async Task WriteGeminiQuotaStateAsync(
        string cacheDir,
        string dayKey,
        int requestsToday,
        IReadOnlyCollection<DateTimeOffset> requestTimestamps)
    {
        Directory.CreateDirectory(cacheDir);
        var statePath = Path.Combine(cacheDir, "gemini-request-quota.json");
        var json = JsonSerializer.Serialize(
            new
            {
                DayKey = dayKey,
                RequestsToday = requestsToday,
                RequestTimestamps = requestTimestamps
            });
        await File.WriteAllTextAsync(statePath, json);
    }

    private sealed class MutableClock
    {
        public MutableClock(DateTimeOffset now)
        {
            Now = now;
        }

        public DateTimeOffset Now { get; private set; }
        public List<TimeSpan> Delays { get; } = [];

        public DateTimeOffset GetNow()
        {
            return Now;
        }

        public Task DelayAsync(TimeSpan delay)
        {
            Delays.Add(delay);
            Now += delay;
            return Task.CompletedTask;
        }
    }

    private sealed class TemporaryDirectory : IDisposable
    {
        public TemporaryDirectory()
        {
            Path = System.IO.Path.Combine(System.IO.Path.GetTempPath(), $"barna-tests-{Guid.NewGuid():N}");
            Directory.CreateDirectory(Path);
        }

        public string Path { get; }

        public void Dispose()
        {
            if (Directory.Exists(Path))
            {
                Directory.Delete(Path, true);
            }
        }
    }
}
