using BarnaStats.Api.Services;
using BarnaStats.Utilities;
using GenerateAnalisys.Models;
using GenerateAnalisys.Services;

namespace GenerateAnalisys.Tests;

public sealed class MatchAiReportServiceTests
{
    [Fact]
    public async Task GenerateAsync_falls_back_to_openai_when_gemini_returns_transient_failure()
    {
        using var environment = new EnvironmentVariableScope(("BARNASTATS_AI_PROVIDER", "gemini"));
        using var sandbox = new TemporaryDirectory();
        var paths = CreatePathsWithFixtureStats(sandbox.Path);
        var gemini = new FakeMatchReportProviderService(
            "Gemini",
            result: null,
            failure: new MatchReportFailure
            {
                Kind = MatchReportFailureKind.TransientFailure,
                Message = "Gemini respondió 503 Service Unavailable."
            });
        var openAiResult = new MatchReportResult
        {
            Summary = "Resumen de respaldo con OpenAI",
            ContentHash = "hash-openai",
            Model = "gpt-4.1-mini",
            GeneratedAtUtc = new DateTime(2026, 4, 27, 12, 0, 0, DateTimeKind.Utc)
        };
        var openAi = new FakeMatchReportProviderService("OpenAI", openAiResult, failure: null);
        var service = new MatchAiReportService(
            paths,
            _ => gemini,
            _ => openAi);

        var result = await service.GenerateAsync(34951, forceRefresh: false);

        Assert.True(result.Succeeded);
        Assert.NotNull(result.Report);
        Assert.Equal("Resumen de respaldo con OpenAI", result.Report.Summary);
        Assert.Equal("gpt-4.1-mini", result.Report.Model);
        Assert.Equal(1, gemini.CallCount);
        Assert.Equal(1, openAi.CallCount);
    }

    [Fact]
    public async Task GenerateAsync_falls_back_to_openai_when_gemini_is_not_configured()
    {
        using var environment = new EnvironmentVariableScope(("BARNASTATS_AI_PROVIDER", "gemini"));
        using var sandbox = new TemporaryDirectory();
        var paths = CreatePathsWithFixtureStats(sandbox.Path);
        var gemini = new FakeMatchReportProviderService(
            "Gemini",
            result: null,
            failure: new MatchReportFailure
            {
                Kind = MatchReportFailureKind.MissingApiKey,
                Message = "Falta GEMINI_API_KEY."
            });
        var openAiResult = new MatchReportResult
        {
            Summary = "Resumen con OpenAI",
            ContentHash = "hash-openai-2",
            Model = "gpt-4.1-mini",
            GeneratedAtUtc = new DateTime(2026, 4, 27, 13, 0, 0, DateTimeKind.Utc)
        };
        var openAi = new FakeMatchReportProviderService("OpenAI", openAiResult, failure: null);
        var service = new MatchAiReportService(
            paths,
            _ => gemini,
            _ => openAi);

        var result = await service.GenerateAsync(34951, forceRefresh: false);

        Assert.True(result.Succeeded);
        Assert.NotNull(result.Report);
        Assert.Equal("Resumen con OpenAI", result.Report.Summary);
        Assert.Equal("gpt-4.1-mini", result.Report.Model);
        Assert.Equal(1, gemini.CallCount);
        Assert.Equal(1, openAi.CallCount);
    }

    private static BarnaStatsPaths CreatePathsWithFixtureStats(string sandboxPath)
    {
        var projectDir = Path.Combine(sandboxPath, "BarnaStats");
        var paths = BarnaStatsPaths.CreateFromProjectDir(projectDir);
        paths.EnsureDirectories();

        Directory.CreateDirectory(paths.StatsDir);
        File.Copy(
            Path.Combine(FixturePaths.SinglePhaseRoot, "stats", "34951_68fcb7c91497f200013e2648_stats.json"),
            Path.Combine(paths.StatsDir, "34951_68fcb7c91497f200013e2648_stats.json"));
        File.Copy(
            Path.Combine(FixturePaths.SinglePhaseRoot, "moves", "34951_68fcb7c91497f200013e2648_moves.json"),
            Path.Combine(paths.MovesDir, "34951_68fcb7c91497f200013e2648_moves.json"));

        return paths;
    }

    private sealed class FakeMatchReportProviderService : IMatchReportProviderService
    {
        private readonly MatchReportResult? _result;

        public FakeMatchReportProviderService(
            string providerName,
            MatchReportResult? result,
            MatchReportFailure? failure)
        {
            ProviderName = providerName;
            _result = result;
            LastFailure = failure;
        }

        public string ProviderName { get; }
        public MatchReportFailure? LastFailure { get; private set; }
        public int CallCount { get; private set; }

        public Task<MatchReportResult?> GetCachedAsync(
            int matchWebId,
            string statsRaw,
            string? movesRaw,
            int? focusTeamIdExtern = null)
        {
            return Task.FromResult<MatchReportResult?>(null);
        }

        public Task<MatchReportResult?> GetOrGenerateAsync(
            int matchWebId,
            StatsRoot match,
            string statsRaw,
            string? movesRaw,
            int? focusTeamIdExtern = null)
        {
            CallCount += 1;
            return Task.FromResult(_result);
        }
    }

    private sealed class TemporaryDirectory : IDisposable
    {
        public TemporaryDirectory()
        {
            Path = System.IO.Path.Combine(System.IO.Path.GetTempPath(), $"barna-stats-tests-{Guid.NewGuid():N}");
            Directory.CreateDirectory(Path);
        }

        public string Path { get; }

        public void Dispose()
        {
            try
            {
                if (Directory.Exists(Path))
                {
                    Directory.Delete(Path, recursive: true);
                }
            }
            catch
            {
                // Ignorado en tests.
            }
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
}
