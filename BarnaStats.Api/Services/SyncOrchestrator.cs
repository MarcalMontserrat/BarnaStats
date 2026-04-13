using System.Diagnostics;
using System.Text;
using System.Text.RegularExpressions;
using BarnaStats.Api.Infrastructure;
using BarnaStats.Api.Models;

namespace BarnaStats.Api.Services;

public sealed class SyncOrchestrator
{
    private static readonly Regex TeamCalendarIdRegex = new(
        "/partits/calendari_[^/]+(?:/pdf)?/(?:\\d+/)?(\\d+)(?:/|$)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private readonly Lock _lock = new();
    private readonly RepoPaths _repoPaths;

    private SyncJob? _currentJob;

    public SyncOrchestrator(RepoPaths repoPaths)
    {
        _repoPaths = repoPaths;
    }

    public SyncJobSnapshot? GetCurrentJob()
    {
        lock (_lock)
        {
            return _currentJob?.ToSnapshot();
        }
    }

    public bool TryStart(string calendarUrl, out SyncJobSnapshot? jobSnapshot, out string? error)
    {
        calendarUrl = calendarUrl.Trim();

        if (!TryNormalizeCalendarUrl(calendarUrl, out var normalizedUrl))
        {
            jobSnapshot = null;
            error = "La URL no parece un calendario válido de basquetcatala.cat.";
            return false;
        }

        lock (_lock)
        {
            if (_currentJob is { Status: SyncJobStatus.Pending or SyncJobStatus.Running })
            {
                jobSnapshot = _currentJob.ToSnapshot();
                error = "Ya hay una sincronización en marcha.";
                return false;
            }

            var job = new SyncJob(normalizedUrl, TryGetTeamCalendarId(normalizedUrl));
            _currentJob = job;
            jobSnapshot = job.ToSnapshot();
            error = null;

            _ = Task.Run(() => RunJobAsync(job));
            return true;
        }
    }

    private async Task RunJobAsync(SyncJob job)
    {
        job.StartedAtUtc = DateTimeOffset.UtcNow;
        job.Status = SyncJobStatus.Running;
        job.AppendLog($"[{DateTimeOffset.UtcNow:HH:mm:ss}] Lanzando sync-all para {job.CalendarUrl}");

        try
        {
            var startInfo = new ProcessStartInfo
            {
                FileName = "dotnet",
                WorkingDirectory = _repoPaths.RepoRoot,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8
            };

            startInfo.ArgumentList.Add("run");
            startInfo.ArgumentList.Add("--project");
            startInfo.ArgumentList.Add(_repoPaths.BarnaStatsProjectFile);
            startInfo.ArgumentList.Add("--");
            startInfo.ArgumentList.Add("sync-all");
            startInfo.ArgumentList.Add("--non-interactive");
            startInfo.ArgumentList.Add(job.CalendarUrl);

            using var process = new Process { StartInfo = startInfo, EnableRaisingEvents = true };

            process.OutputDataReceived += (_, args) =>
            {
                if (!string.IsNullOrWhiteSpace(args.Data))
                    job.AppendLog(args.Data);
            };

            process.ErrorDataReceived += (_, args) =>
            {
                if (!string.IsNullOrWhiteSpace(args.Data))
                    job.AppendLog($"[stderr] {args.Data}");
            };

            if (!process.Start())
                throw new InvalidOperationException("No se pudo arrancar el proceso de sync-all.");

            process.BeginOutputReadLine();
            process.BeginErrorReadLine();

            await process.WaitForExitAsync();

            job.ExitCode = process.ExitCode;
            job.CompletedAtUtc = DateTimeOffset.UtcNow;
            job.AnalysisUpdatedAtUtc = ReadAnalysisUpdatedAtUtc();

            if (process.ExitCode == 0)
            {
                job.Status = SyncJobStatus.Succeeded;
                job.AppendLog($"[{DateTimeOffset.UtcNow:HH:mm:ss}] Sincronización completada.");
            }
            else
            {
                job.Status = SyncJobStatus.Failed;
                job.Error = $"sync-all terminó con código {process.ExitCode}.";
                job.AppendLog($"[{DateTimeOffset.UtcNow:HH:mm:ss}] ERROR: {job.Error}");
            }
        }
        catch (Exception ex)
        {
            job.Status = SyncJobStatus.Failed;
            job.CompletedAtUtc = DateTimeOffset.UtcNow;
            job.Error = ex.Message;
            job.AppendLog($"[{DateTimeOffset.UtcNow:HH:mm:ss}] ERROR: {ex.Message}");
        }
    }

    private DateTimeOffset? ReadAnalysisUpdatedAtUtc()
    {
        if (!File.Exists(_repoPaths.AnalysisJson))
            return null;

        return File.GetLastWriteTimeUtc(_repoPaths.AnalysisJson);
    }

    private static bool TryNormalizeCalendarUrl(string input, out string normalizedUrl)
    {
        normalizedUrl = string.Empty;

        if (!Uri.TryCreate(input, UriKind.Absolute, out var uri))
            return false;

        if (!uri.Host.EndsWith("basquetcatala.cat", StringComparison.OrdinalIgnoreCase))
            return false;

        if (!uri.AbsolutePath.Contains("/partits/calendari_", StringComparison.OrdinalIgnoreCase))
            return false;

        normalizedUrl = uri.ToString();
        return true;
    }

    private static int? TryGetTeamCalendarId(string calendarUrl)
    {
        var match = TeamCalendarIdRegex.Match(calendarUrl);
        if (!match.Success)
            return null;

        return int.TryParse(match.Groups[1].Value, out var teamCalendarId) ? teamCalendarId : null;
    }

    private sealed class SyncJob
    {
        private const int MaxLogs = 400;

        public SyncJob(string calendarUrl, int? teamCalendarId)
        {
            JobId = Guid.NewGuid().ToString("N");
            CalendarUrl = calendarUrl;
            TeamCalendarId = teamCalendarId;
            CreatedAtUtc = DateTimeOffset.UtcNow;
        }

        public string JobId { get; }
        public string CalendarUrl { get; }
        public int? TeamCalendarId { get; }
        public DateTimeOffset CreatedAtUtc { get; }
        public DateTimeOffset? StartedAtUtc { get; set; }
        public DateTimeOffset? CompletedAtUtc { get; set; }
        public int? ExitCode { get; set; }
        public SyncJobStatus Status { get; set; } = SyncJobStatus.Pending;
        public string? Error { get; set; }
        public DateTimeOffset? AnalysisUpdatedAtUtc { get; set; }

        private List<string> Logs { get; } = [];

        public void AppendLog(string line)
        {
            lock (Logs)
            {
                Logs.Add(line);

                if (Logs.Count <= MaxLogs)
                    return;

                Logs.RemoveRange(0, Logs.Count - MaxLogs);
            }
        }

        public SyncJobSnapshot ToSnapshot()
        {
            lock (Logs)
            {
                return new SyncJobSnapshot
                {
                    JobId = JobId,
                    Status = ToApiValue(Status),
                    CalendarUrl = CalendarUrl,
                    CreatedAtUtc = CreatedAtUtc,
                    StartedAtUtc = StartedAtUtc,
                    CompletedAtUtc = CompletedAtUtc,
                    ExitCode = ExitCode,
                    TeamCalendarId = TeamCalendarId,
                    Error = Error,
                    Logs = Logs.ToArray(),
                    AnalysisUpdatedAtUtc = AnalysisUpdatedAtUtc
                };
            }
        }
    }

    private enum SyncJobStatus
    {
        Pending,
        Running,
        Succeeded,
        Failed
    }

    private static string ToApiValue(SyncJobStatus status)
    {
        return status switch
        {
            SyncJobStatus.Pending => "pending",
            SyncJobStatus.Running => "running",
            SyncJobStatus.Succeeded => "succeeded",
            SyncJobStatus.Failed => "failed",
            _ => "unknown"
        };
    }
}
