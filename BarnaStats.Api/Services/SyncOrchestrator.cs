using System.Diagnostics;
using System.Text;
using System.Text.Json;
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
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true
    };

    private SyncJob? _currentJob;
    private bool _maintenanceInProgress;

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
            if (_maintenanceInProgress)
            {
                jobSnapshot = null;
                error = "Hay una operación de mantenimiento en marcha. Espera a que termine.";
                return false;
            }

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
            if (_maintenanceInProgress)
            {
                return new SyncStartResult(false, null, "Hay una operación de mantenimiento en marcha. Espera a que termine.");
            }

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

            var job = SyncJob.CreateBatch("Fases guardadas", "registry", normalizedSources.Count, forceRefresh: false);
            _currentJob = job;

            var batchSources = normalizedSources
                .Select(source => new BatchSourceEntry(source.SourceUrl.Trim(), FormatSourceReference(source)))
                .ToList();

            _ = Task.Run(() => RunBatchJobAsync(
                job,
                batchSources,
                forceRefresh: false,
                startMessage: $"[{DateTimeOffset.UtcNow:HH:mm:ss}] Lanzando sync-all para {batchSources.Count} fases guardadas.",
                successMessage: $"[{DateTimeOffset.UtcNow:HH:mm:ss}] Sincronización completa de todas las fases guardadas.",
                singleFailureLabel: "fase guardada",
                pluralFailureLabel: "fases guardadas"
            ));
            return new SyncStartResult(true, job.ToSnapshot(), null);
        }
    }

    public bool TryStartBatch(
        IReadOnlyList<SyncSourceSelectionItem> sources,
        bool forceRefresh,
        string? description,
        out SyncJobSnapshot? jobSnapshot,
        out string? error)
    {
        var batchSources = TryBuildBatchSourceEntries(sources, out error);
        if (batchSources.Count == 0)
        {
            jobSnapshot = null;
            error ??= "No hay fases válidas para sincronizar.";
            return false;
        }

        lock (_lock)
        {
            if (_maintenanceInProgress)
            {
                jobSnapshot = null;
                error = "Hay una operación de mantenimiento en marcha. Espera a que termine.";
                return false;
            }

            if (_currentJob is { Status: SyncJobStatus.Pending or SyncJobStatus.Running })
            {
                jobSnapshot = _currentJob.ToSnapshot();
                error = "Ya hay una sincronización en marcha.";
                return false;
            }

            var jobLabel = string.IsNullOrWhiteSpace(description)
                ? $"Selección de {batchSources.Count} fases"
                : description.Trim();
            var job = SyncJob.CreateBatch(jobLabel, "selection", batchSources.Count, forceRefresh);
            _currentJob = job;
            jobSnapshot = job.ToSnapshot();
            error = null;

            _ = Task.Run(() => RunBatchJobAsync(
                job,
                batchSources,
                forceRefresh,
                startMessage: $"[{DateTimeOffset.UtcNow:HH:mm:ss}] Lanzando sync-all para {batchSources.Count} fases seleccionadas.",
                successMessage: $"[{DateTimeOffset.UtcNow:HH:mm:ss}] Sincronización completa de todas las fases seleccionadas.",
                singleFailureLabel: "fase seleccionada",
                pluralFailureLabel: "fases seleccionadas"
            ));
            return true;
        }
    }

    public async Task<DeleteSavedSourceResult> TryDeleteSavedSourceAsync(int phaseId)
    {
        lock (_lock)
        {
            if (_maintenanceInProgress)
            {
                return new DeleteSavedSourceResult
                {
                    PhaseId = phaseId,
                    Error = "Ya hay una operación de mantenimiento en marcha. Espera a que termine."
                };
            }

            if (_currentJob is { Status: SyncJobStatus.Pending or SyncJobStatus.Running })
            {
                return new DeleteSavedSourceResult
                {
                    PhaseId = phaseId,
                    Error = "No se puede borrar una fase mientras hay una sincronización en marcha."
                };
            }

            _maintenanceInProgress = true;
        }

        try
        {
            return await DeleteSavedSourceCoreAsync(phaseId);
        }
        finally
        {
            lock (_lock)
            {
                _maintenanceInProgress = false;
            }
        }
    }

    private async Task RunJobAsync(SyncJob job)
    {
        job.StartedAtUtc = DateTimeOffset.UtcNow;
        job.Status = SyncJobStatus.Running;
        job.AppendLog($"[{DateTimeOffset.UtcNow:HH:mm:ss}] Lanzando sync-all para {job.SourceUrl}{(job.ForceRefresh ? " (modo forzado)" : "")}");

        try
        {
            var exitCode = await RunSyncAllProcessAsync(job.SourceUrl, job.ForceRefresh, analysisDirtyMarker: null, appendLog: job.AppendLog);
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

    private async Task RunBatchJobAsync(
        SyncJob job,
        IReadOnlyList<BatchSourceEntry> sources,
        bool forceRefresh,
        string startMessage,
        string successMessage,
        string singleFailureLabel,
        string pluralFailureLabel)
    {
        job.StartedAtUtc = DateTimeOffset.UtcNow;
        job.Status = SyncJobStatus.Running;
        job.AppendLog(startMessage);

        var failures = new List<string>();
        var analysisDirtyMarker = Path.Combine(_repoPaths.TempDir, $"analysis-dirty-{job.JobId}.marker");

        try
        {
            Directory.CreateDirectory(_repoPaths.TempDir);
            if (File.Exists(analysisDirtyMarker))
                File.Delete(analysisDirtyMarker);

            for (var index = 0; index < sources.Count; index++)
            {
                var source = sources[index];
                var prefix = $"[{index + 1}/{sources.Count}]";
                var reference = source.Reference;

                job.AppendLog($"{prefix} {reference}");

                var exitCode = await RunSyncAllProcessAsync(
                    source.SourceUrl,
                    forceRefresh,
                    analysisDirtyMarker,
                    appendLog: line => job.AppendLog($"{prefix} {line}")
                );

                if (exitCode != 0)
                    failures.Add($"{reference} (código {exitCode})");
            }

            if (File.Exists(analysisDirtyMarker))
            {
                job.AppendLog($"[{DateTimeOffset.UtcNow:HH:mm:ss}] Cambios detectados. Regenerando analysis.json una sola vez al final.");
                var analysisExitCode = await RunGenerateAnalysisProcessAsync(job.AppendLog);

                if (analysisExitCode != 0)
                    failures.Add($"GenerateAnalisys (código {analysisExitCode})");
            }
            else
            {
                job.AppendLog($"[{DateTimeOffset.UtcNow:HH:mm:ss}] Sin cambios acumulados. Se reutiliza el analysis.json actual.");
            }

            job.CompletedAtUtc = DateTimeOffset.UtcNow;
            job.AnalysisUpdatedAtUtc = ReadAnalysisUpdatedAtUtc();
            job.ExitCode = failures.Count == 0 ? 0 : 1;

            if (failures.Count == 0)
            {
                job.Status = SyncJobStatus.Succeeded;
                job.AppendLog(successMessage);
                return;
            }

            job.Status = SyncJobStatus.Failed;
            job.Error = failures.Count == 1
                ? $"Falló 1 {singleFailureLabel}: {failures[0]}."
                : $"Fallaron {failures.Count} {pluralFailureLabel}. Revisa el log para el detalle.";
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
        finally
        {
            if (File.Exists(analysisDirtyMarker))
                File.Delete(analysisDirtyMarker);
        }
    }

    private async Task<int> RunSyncAllProcessAsync(
        string sourceUrl,
        bool forceRefresh,
        string? analysisDirtyMarker,
        Action<string> appendLog)
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
        if (!string.IsNullOrWhiteSpace(analysisDirtyMarker))
        {
            startInfo.ArgumentList.Add("--analysis-dirty-marker");
            startInfo.ArgumentList.Add(analysisDirtyMarker);
        }
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

    private async Task<int> RunGenerateAnalysisProcessAsync(Action<string> appendLog)
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
        startInfo.ArgumentList.Add(_repoPaths.GenerateAnalysisProjectFile);

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
            throw new InvalidOperationException("No se pudo arrancar el proceso de GenerateAnalisys.");

        process.BeginOutputReadLine();
        process.BeginErrorReadLine();

        await process.WaitForExitAsync();
        return process.ExitCode;
    }

    private async Task<DeleteSavedSourceResult> DeleteSavedSourceCoreAsync(int phaseId)
    {
        var entries = await LoadResultsSourceEntriesAsync();
        var removedEntries = entries
            .Where(entry => entry.PhaseId == phaseId || TryGetPhaseIdFromSourceUrl(entry.SourceUrl) == phaseId)
            .ToList();
        var phaseDir = Path.Combine(_repoPaths.BarnaStatsPhasesDir, phaseId.ToString());
        var phaseDirectoryExists = Directory.Exists(phaseDir);

        if (removedEntries.Count == 0 && !phaseDirectoryExists)
        {
            return new DeleteSavedSourceResult
            {
                PhaseId = phaseId,
                Error = "La fase guardada ya no existe."
            };
        }

        if (removedEntries.Count > 0)
        {
            var remainingEntries = entries
                .Except(removedEntries)
                .OrderBy(entry => entry.CategoryName, StringComparer.OrdinalIgnoreCase)
                .ThenBy(entry => entry.LevelName, StringComparer.OrdinalIgnoreCase)
                .ThenBy(entry => entry.GroupCode, StringComparer.OrdinalIgnoreCase)
                .ThenBy(entry => entry.PhaseName, StringComparer.OrdinalIgnoreCase)
                .ThenBy(entry => entry.PhaseId ?? int.MaxValue)
                .ToList();

            await SaveResultsSourceEntriesAsync(remainingEntries);
        }

        var deletedPhaseDirectory = false;
        if (phaseDirectoryExists)
        {
            Directory.Delete(phaseDir, recursive: true);
            deletedPhaseDirectory = true;
        }

        var sourceReference = removedEntries.FirstOrDefault() is { } removedSource
            ? FormatSourceReference(removedSource)
            : $"Fase {phaseId}";
        var generateAnalysisLogs = new List<string>();
        var analysisExitCode = await RunGenerateAnalysisProcessAsync(line =>
        {
            lock (generateAnalysisLogs)
            {
                generateAnalysisLogs.Add(line);
            }
        });
        var analysisUpdatedAtUtc = ReadAnalysisUpdatedAtUtc();

        if (analysisExitCode != 0)
        {
            return new DeleteSavedSourceResult
            {
                Deleted = true,
                PhaseId = phaseId,
                Reference = sourceReference,
                RemovedRegistryEntries = removedEntries.Count,
                DeletedPhaseDirectory = deletedPhaseDirectory,
                AnalysisRegenerated = false,
                AnalysisUpdatedAtUtc = analysisUpdatedAtUtc,
                Warning = BuildGenerateAnalysisWarning(analysisExitCode, generateAnalysisLogs)
            };
        }

        return new DeleteSavedSourceResult
        {
            Deleted = true,
            PhaseId = phaseId,
            Reference = sourceReference,
            RemovedRegistryEntries = removedEntries.Count,
            DeletedPhaseDirectory = deletedPhaseDirectory,
            AnalysisRegenerated = true,
            AnalysisUpdatedAtUtc = analysisUpdatedAtUtc
        };
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

    private async Task<List<ResultsSourceSnapshot>> LoadResultsSourceEntriesAsync()
    {
        if (!File.Exists(_repoPaths.ResultsSourcesRegistryFile))
            return [];

        var json = await File.ReadAllTextAsync(_repoPaths.ResultsSourcesRegistryFile);
        return JsonSerializer.Deserialize<List<ResultsSourceSnapshot>>(json, _jsonOptions) ?? [];
    }

    private async Task SaveResultsSourceEntriesAsync(IReadOnlyList<ResultsSourceSnapshot> entries)
    {
        var json = JsonSerializer.Serialize(entries, _jsonOptions);
        await File.WriteAllTextAsync(_repoPaths.ResultsSourcesRegistryFile, json);
    }

    private static SyncSourceInfo ParseSourceInfo(string sourceUrl)
    {
        var phaseMatch = PhaseIdRegex.Match(sourceUrl);
        if (phaseMatch.Success && int.TryParse(phaseMatch.Groups[1].Value, out var phaseId))
            return new SyncSourceInfo("phase", phaseId);

        return new SyncSourceInfo(null, null);
    }

    private static int? TryGetPhaseIdFromSourceUrl(string? sourceUrl)
    {
        if (string.IsNullOrWhiteSpace(sourceUrl))
            return null;

        var phaseMatch = PhaseIdRegex.Match(sourceUrl);
        if (!phaseMatch.Success || !int.TryParse(phaseMatch.Groups[1].Value, out var phaseId))
            return null;

        return phaseId;
    }

    private static List<BatchSourceEntry> TryBuildBatchSourceEntries(
        IReadOnlyList<SyncSourceSelectionItem> sources,
        out string? error)
    {
        error = null;
        var results = new List<BatchSourceEntry>();
        var seenUrls = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var source in sources)
        {
            var rawUrl = source.SourceUrl?.Trim() ?? "";
            if (string.IsNullOrWhiteSpace(rawUrl))
                continue;

            if (!TryNormalizeSourceUrl(rawUrl, out var normalizedUrl))
            {
                error = "Una de las URLs de resultados no parece válida.";
                return [];
            }

            if (!seenUrls.Add(normalizedUrl))
                continue;

            var reference = string.IsNullOrWhiteSpace(source.Label)
                ? (TryGetPhaseIdFromSourceUrl(normalizedUrl) is { } phaseId ? $"Fase {phaseId}" : normalizedUrl)
                : source.Label.Trim();

            results.Add(new BatchSourceEntry(normalizedUrl, reference));
        }

        return results;
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

    private static string BuildGenerateAnalysisWarning(int exitCode, IReadOnlyList<string> logs)
    {
        var lastLog = logs.LastOrDefault(line => !string.IsNullOrWhiteSpace(line));

        return string.IsNullOrWhiteSpace(lastLog)
            ? $"La fase se borró, pero GenerateAnalisys terminó con código {exitCode}."
            : $"La fase se borró, pero GenerateAnalisys terminó con código {exitCode}: {lastLog}";
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

        public static SyncJob CreateBatch(string sourceUrl, string sourceKind, int sourceCount, bool forceRefresh)
        {
            return new SyncJob(sourceUrl, sourceKind, sourceCount, forceRefresh);
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
    private sealed record BatchSourceEntry(string SourceUrl, string Reference);
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
