using System.Diagnostics;
using System.Text;
using System.Text.RegularExpressions;
using BarnaStats.Api.Infrastructure;
using BarnaStats.Api.Models;

namespace BarnaStats.Api.Services;

public sealed class SyncOrchestrator
{
    private static readonly Regex PhaseIdRegex = new(
        "/competicions/resultats/(\\d+)(?:/|$)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private readonly Lock _lock = new();
    private readonly RepoPaths _repoPaths;
    private readonly ResultsSourceCatalogService _resultsSourceCatalogService;

    private SyncJob? _currentJob;

    public SyncOrchestrator(RepoPaths repoPaths, ResultsSourceCatalogService resultsSourceCatalogService)
    {
        _repoPaths = repoPaths;
        _resultsSourceCatalogService = resultsSourceCatalogService;
    }

    public SyncJobSnapshot? GetCurrentJob()
    {
        lock (_lock)
        {
            return _currentJob?.ToSnapshot();
        }
    }

    public bool TryStart(string sourceUrl, bool forceRefresh, out SyncJobSnapshot? jobSnapshot, out string? error)
    {
        sourceUrl = sourceUrl.Trim();

        if (!TryNormalizeSourceUrl(sourceUrl, out var normalizedUrl))
        {
            jobSnapshot = null;
            error = "La URL no parece una página de resultados válida de basquetcatala.cat.";
            return false;
        }

        var sourceInfo = ParseSourceInfo(normalizedUrl);

        lock (_lock)
        {
            if (_currentJob is { Status: SyncJobStatus.Pending or SyncJobStatus.Running })
            {
                jobSnapshot = _currentJob.ToSnapshot();
                error = "Ya hay una sincronización en marcha.";
                return false;
            }

            var job = new SyncJob(normalizedUrl, sourceInfo, forceRefresh);
            _currentJob = job;
            jobSnapshot = job.ToSnapshot();
            error = null;

            _ = Task.Run(() => RunJobAsync(job));
            return true;
        }
    }

    public async Task<SyncStartResult> TryStartSavedSourcesAsync()
    {
        var savedSources = await _resultsSourceCatalogService.GetAllAsync();
        if (savedSources.Count == 0)
            return new SyncStartResult(false, null, "Todavía no hay fases guardadas para sincronizar.");

        lock (_lock)
        {
            if (_currentJob is { Status: SyncJobStatus.Pending or SyncJobStatus.Running })
            {
                return new SyncStartResult(false, _currentJob.ToSnapshot(), "Ya hay una sincronización en marcha.");
            }

            var normalizedSources = savedSources
                .Where(source => !string.IsNullOrWhiteSpace(source.SourceUrl))
                .GroupBy(source => source.SourceUrl.Trim(), StringComparer.OrdinalIgnoreCase)
                .Select(group => group.First())
                .ToList();

            if (normalizedSources.Count == 0)
                return new SyncStartResult(false, null, "Las fases guardadas no tienen URLs válidas.");

            var job = SyncJob.CreateBatch(normalizedSources.Count);
            _currentJob = job;

            _ = Task.Run(() => RunSavedSourcesJobAsync(job, normalizedSources));
            return new SyncStartResult(true, job.ToSnapshot(), null);
        }
    }

    private async Task RunJobAsync(SyncJob job)
    {
        job.StartedAtUtc = DateTimeOffset.UtcNow;
        job.Status = SyncJobStatus.Running;
        job.AppendLog($"[{DateTimeOffset.UtcNow:HH:mm:ss}] Lanzando sync-all para {job.SourceUrl}{(job.ForceRefresh ? " (modo forzado)" : "")}");

        try
        {
            var exitCode = await RunSyncAllProcessAsync(job.SourceUrl, job.ForceRefresh, job.AppendLog);
            job.ExitCode = exitCode;
            job.CompletedAtUtc = DateTimeOffset.UtcNow;
            job.AnalysisUpdatedAtUtc = ReadAnalysisUpdatedAtUtc();

            if (exitCode == 0)
            {
                job.Status = SyncJobStatus.Succeeded;
                job.AppendLog($"[{DateTimeOffset.UtcNow:HH:mm:ss}] Sincronización completada.");
            }
            else
            {
                job.Status = SyncJobStatus.Failed;
                job.Error = $"sync-all terminó con código {exitCode}.";
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

    private async Task RunSavedSourcesJobAsync(SyncJob job, IReadOnlyList<ResultsSourceSnapshot> savedSources)
    {
        job.StartedAtUtc = DateTimeOffset.UtcNow;
        job.Status = SyncJobStatus.Running;
        job.AppendLog($"[{DateTimeOffset.UtcNow:HH:mm:ss}] Lanzando sync-all para {savedSources.Count} fases guardadas.");

        var failures = new List<string>();

        try
        {
            for (var index = 0; index < savedSources.Count; index++)
            {
                var source = savedSources[index];
                var prefix = $"[{index + 1}/{savedSources.Count}]";
                var reference = FormatSourceReference(source);

                job.AppendLog($"{prefix} {reference}");

                var exitCode = await RunSyncAllProcessAsync(
                    source.SourceUrl.Trim(),
                    forceRefresh: false,
                    appendLog: line => job.AppendLog($"{prefix} {line}")
                );

                if (exitCode != 0)
                    failures.Add($"{reference} (código {exitCode})");
            }

            job.CompletedAtUtc = DateTimeOffset.UtcNow;
            job.AnalysisUpdatedAtUtc = ReadAnalysisUpdatedAtUtc();
            job.ExitCode = failures.Count == 0 ? 0 : 1;

            if (failures.Count == 0)
            {
                job.Status = SyncJobStatus.Succeeded;
                job.AppendLog($"[{DateTimeOffset.UtcNow:HH:mm:ss}] Sincronización completa de todas las fases guardadas.");
                return;
            }

            job.Status = SyncJobStatus.Failed;
            job.Error = failures.Count == 1
                ? $"Falló 1 fase guardada: {failures[0]}."
                : $"Fallaron {failures.Count} fases guardadas. Revisa el log para el detalle.";
            job.AppendLog($"[{DateTimeOffset.UtcNow:HH:mm:ss}] ERROR: {job.Error}");
        }
        catch (Exception ex)
        {
            job.Status = SyncJobStatus.Failed;
            job.CompletedAtUtc = DateTimeOffset.UtcNow;
            job.ExitCode = 1;
            job.Error = ex.Message;
            job.AppendLog($"[{DateTimeOffset.UtcNow:HH:mm:ss}] ERROR: {ex.Message}");
        }
    }

    private async Task<int> RunSyncAllProcessAsync(string sourceUrl, bool forceRefresh, Action<string> appendLog)
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
        if (forceRefresh)
            startInfo.ArgumentList.Add("--force");
        startInfo.ArgumentList.Add(sourceUrl);

        using var process = new Process { StartInfo = startInfo, EnableRaisingEvents = true };

        process.OutputDataReceived += (_, args) =>
        {
            if (!string.IsNullOrWhiteSpace(args.Data))
                appendLog(args.Data);
        };

        process.ErrorDataReceived += (_, args) =>
        {
            if (!string.IsNullOrWhiteSpace(args.Data))
                appendLog($"[stderr] {args.Data}");
        };

        if (!process.Start())
            throw new InvalidOperationException("No se pudo arrancar el proceso de sync-all.");

        process.BeginOutputReadLine();
        process.BeginErrorReadLine();

        await process.WaitForExitAsync();
        return process.ExitCode;
    }

    private DateTimeOffset? ReadAnalysisUpdatedAtUtc()
    {
        if (!File.Exists(_repoPaths.AnalysisJson))
            return null;

        return File.GetLastWriteTimeUtc(_repoPaths.AnalysisJson);
    }

    private static bool TryNormalizeSourceUrl(string input, out string normalizedUrl)
    {
        normalizedUrl = string.Empty;

        if (!Uri.TryCreate(input, UriKind.Absolute, out var uri))
            return false;

        if (!uri.Host.EndsWith("basquetcatala.cat", StringComparison.OrdinalIgnoreCase))
            return false;

        var isResultsUrl = uri.AbsolutePath.Contains("/competicions/resultats/", StringComparison.OrdinalIgnoreCase);

        if (!isResultsUrl)
            return false;

        normalizedUrl = uri.ToString();
        return true;
    }

    private static SyncSourceInfo ParseSourceInfo(string sourceUrl)
    {
        var phaseMatch = PhaseIdRegex.Match(sourceUrl);
        if (phaseMatch.Success && int.TryParse(phaseMatch.Groups[1].Value, out var phaseId))
            return new SyncSourceInfo("phase", phaseId);

        return new SyncSourceInfo(null, null);
    }

    private static string FormatSourceReference(ResultsSourceSnapshot source)
    {
        var parts = new[]
        {
            source.LevelName,
            string.IsNullOrWhiteSpace(source.GroupCode) ? null : $"Grupo {source.GroupCode}",
            source.PhaseName
        }.Where(part => !string.IsNullOrWhiteSpace(part)).ToArray();

        if (parts.Length > 0)
            return string.Join(" · ", parts!);

        return source.PhaseId is { } phaseId
            ? $"Fase {phaseId}"
            : source.SourceUrl;
    }

    private sealed class SyncJob
    {
        private const int MaxLogs = 400;

        public SyncJob(string sourceUrl, SyncSourceInfo sourceInfo, bool forceRefresh)
            : this(sourceUrl, sourceInfo.Kind, sourceInfo.SourceId, forceRefresh)
        {
        }

        private SyncJob(string sourceUrl, string? sourceKind, int? sourceId, bool forceRefresh)
        {
            JobId = Guid.NewGuid().ToString("N");
            SourceUrl = sourceUrl;
            SourceKind = sourceKind;
            SourceId = sourceId;
            ForceRefresh = forceRefresh;
            CreatedAtUtc = DateTimeOffset.UtcNow;
        }

        public string JobId { get; }
        public string SourceUrl { get; }
        public string? SourceKind { get; }
        public int? SourceId { get; }
        public bool ForceRefresh { get; }
        public DateTimeOffset CreatedAtUtc { get; }
        public DateTimeOffset? StartedAtUtc { get; set; }
        public DateTimeOffset? CompletedAtUtc { get; set; }
        public int? ExitCode { get; set; }
        public SyncJobStatus Status { get; set; } = SyncJobStatus.Pending;
        public string? Error { get; set; }
        public DateTimeOffset? AnalysisUpdatedAtUtc { get; set; }

        private List<string> Logs { get; } = [];

        public static SyncJob CreateBatch(int sourceCount)
        {
            return new SyncJob("Fases guardadas", "registry", sourceCount, false);
        }

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
                    SourceUrl = SourceUrl,
                    CreatedAtUtc = CreatedAtUtc,
                    StartedAtUtc = StartedAtUtc,
                    CompletedAtUtc = CompletedAtUtc,
                    ExitCode = ExitCode,
                    SourceKind = SourceKind,
                    SourceId = SourceId,
                    Error = Error,
                    Logs = Logs.ToArray(),
                    AnalysisUpdatedAtUtc = AnalysisUpdatedAtUtc
                };
            }
        }
    }

    public sealed record SyncStartResult(bool Started, SyncJobSnapshot? JobSnapshot, string? Error);
    private sealed record SyncSourceInfo(string? Kind, int? SourceId);

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
