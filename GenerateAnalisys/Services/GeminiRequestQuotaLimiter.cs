using System.Globalization;
using System.Text.Json;

namespace GenerateAnalisys.Services;

internal sealed class GeminiDailyLimitExceededException : InvalidOperationException
{
    public GeminiDailyLimitExceededException(string message) : base(message)
    {
    }
}

internal sealed class GeminiRequestQuotaLimiter
{
    private const int RequestsPerMinute = 15;
    private const int RequestsPerDay = 1000;
    private static readonly TimeSpan MinuteWindow = TimeSpan.FromMinutes(1);

    private readonly string _statePath;
    private readonly Func<TimeSpan, Task> _delayAsync;
    private readonly Func<DateTimeOffset> _nowProvider;
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        WriteIndented = true
    };
    private readonly SemaphoreSlim _mutex = new(1, 1);

    public GeminiRequestQuotaLimiter(
        string cacheDir,
        Func<TimeSpan, Task> delayAsync,
        Func<DateTimeOffset>? nowProvider = null)
    {
        _statePath = Path.Combine(cacheDir, "gemini-request-quota.json");
        _delayAsync = delayAsync;
        _nowProvider = nowProvider ?? (() => DateTimeOffset.Now);
    }

    public async Task WaitForAvailabilityAsync()
    {
        while (true)
        {
            TimeSpan? waitTime = null;
            string? dailyLimitMessage = null;

            await _mutex.WaitAsync();
            try
            {
                var now = _nowProvider();
                var state = await ReadStateAsync();
                NormalizeState(state, now);

                if (state.RequestsToday >= RequestsPerDay)
                {
                    var nextReset = GetDayKey(now.AddDays(1));
                    dailyLimitMessage = $"Límite diario local de Gemini alcanzado: {RequestsPerDay} solicitudes el {state.DayKey}. Reintenta a partir del {nextReset}.";
                }
                else if (state.RequestTimestamps.Count >= RequestsPerMinute)
                {
                    var oldestTimestamp = state.RequestTimestamps[0];
                    var candidateWait = oldestTimestamp + MinuteWindow - now;
                    waitTime = candidateWait > TimeSpan.Zero
                        ? candidateWait
                        : TimeSpan.Zero;
                }
                else
                {
                    state.RequestsToday += 1;
                    state.RequestTimestamps.Add(now);
                    await WriteStateAsync(state);
                    return;
                }
            }
            finally
            {
                _mutex.Release();
            }

            if (dailyLimitMessage is not null)
                throw new GeminiDailyLimitExceededException(dailyLimitMessage);

            if (waitTime is null)
                return;

            Console.WriteLine(
                $"Gemini alcanzó el límite local de {RequestsPerMinute} solicitudes por minuto. Esperando {waitTime.Value.TotalSeconds:0.#} s.");
            await _delayAsync(waitTime.Value);
        }
    }

    private async Task<GeminiRequestQuotaState> ReadStateAsync()
    {
        if (!File.Exists(_statePath))
            return new GeminiRequestQuotaState();

        try
        {
            var json = await File.ReadAllTextAsync(_statePath);
            return JsonSerializer.Deserialize<GeminiRequestQuotaState>(json, _jsonOptions)
                   ?? new GeminiRequestQuotaState();
        }
        catch
        {
            return new GeminiRequestQuotaState();
        }
    }

    private async Task WriteStateAsync(GeminiRequestQuotaState state)
    {
        var json = JsonSerializer.Serialize(state, _jsonOptions);
        await File.WriteAllTextAsync(_statePath, json);
    }

    private static void NormalizeState(GeminiRequestQuotaState state, DateTimeOffset now)
    {
        var dayKey = GetDayKey(now);
        if (!string.Equals(state.DayKey, dayKey, StringComparison.Ordinal))
        {
            state.DayKey = dayKey;
            state.RequestsToday = 0;
        }

        state.RequestTimestamps = state.RequestTimestamps
            .Where(timestamp => timestamp <= now && now - timestamp < MinuteWindow)
            .OrderBy(timestamp => timestamp)
            .ToList();
    }

    private static string GetDayKey(DateTimeOffset timestamp)
    {
        return timestamp.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
    }

    private sealed class GeminiRequestQuotaState
    {
        public string DayKey { get; set; } = "";
        public int RequestsToday { get; set; }
        public List<DateTimeOffset> RequestTimestamps { get; set; } = [];
    }
}
