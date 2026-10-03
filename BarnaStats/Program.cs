using System.Diagnostics;
using System.Text.Json;
using BarnaStats.Models;
using BarnaStats.Services;
using BarnaStats.Utilities;

var paths = BarnaStatsPaths.CreateDefault();
paths.EnsureDirectories();
var defaultStorage = paths.CreateStorage();
defaultStorage.EnsureDirectories();

var jsonOptions = new JsonSerializerOptions
{
    PropertyNameCaseInsensitive = true,
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    WriteIndented = true
};
var phaseCacheInspector = new PhaseCacheInspector(jsonOptions);
const int DefaultMaxParallelMatchDownloads = 6;
const int DownloadErrorCooldownMs = 750;

if (args.Length > 0)
{
    var command = args[0].Trim().ToLowerInvariant();

    switch (command)
    {
        case "sync-mappings":
            Environment.ExitCode = await RunSyncMappingsAsync(args.Skip(1).ToArray()) ? 0 : 1;
            return;
        case "sync-all":
            Environment.ExitCode = await RunSyncAllAsync(args.Skip(1).ToArray()) ? 0 : 1;
            return;
        case "help":
        case "--help":
        case "-h":
            PrintHelp();
            return;
    }
}

if (await PastSeasonImportGuard.GetBlockReasonAsync(defaultStorage, DateTime.Now) is { } defaultBlockReason)
{
    Console.WriteLine(defaultBlockReason);
    Environment.ExitCode = 1;
    return;
}

var initialDownloadResult = await RunDownloadAsync(defaultStorage, forceRefresh: false);
if (!initialDownloadResult.Succeeded)
    Environment.ExitCode = 1;

return;

async Task<bool> RunSyncMappingsAsync(string[] syncArgs)
{
    if (!TryParseSyncArgs(syncArgs, out var sourceUrl, out var scope, out var includeAll, out var nonInteractive, out var forceRefresh, out _, out var skipMappings, out var explicitMatchIds))
        return false;

    if (skipMappings)
    {
        Console.WriteLine("`--skip-mappings` solo tiene sentido con `sync-all`.");
        return false;
    }

    var storage = paths.CreateStorage(scope);
    storage.EnsureDirectories();

    if (await PastSeasonImportGuard.GetBlockReasonAsync(storage, DateTime.Now) is { } blockReason)
    {
        Console.WriteLine(blockReason);
        return false;
    }

    var syncResult = await ExecuteSyncMappingsAsync(storage, sourceUrl, includeAll, nonInteractive, explicitMatchIds);
    return syncResult.Succeeded;
}

async Task<bool> RunSyncAllAsync(string[] syncArgs)
{
    if (!TryParseSyncArgs(syncArgs, out var sourceUrl, out var scope, out var includeAll, out var nonInteractive, out var forceRefresh, out var analysisDirtyMarkerFile, out var skipMappings, out var explicitMatchIds))
        return false;

    var storage = paths.CreateStorage(scope);
    storage.EnsureDirectories();

    if (await PastSeasonImportGuard.GetBlockReasonAsync(storage, DateTime.Now) is { } blockReason)
    {
        Console.WriteLine(blockReason);
        return false;
    }

    if (!forceRefresh && !includeAll && explicitMatchIds.Count == 0)
    {
        var cacheInspection = await phaseCacheInspector.InspectAsync(storage);
        if (cacheInspection.CanReuseWithoutRefresh)
        {
            Console.WriteLine("Paso 1/3 · La fase ya está completa en caché. Se omite la sincronización.");
            Console.WriteLine(cacheInspection.Reason);
            Console.WriteLine($"Mappings totales: {cacheInspection.TotalMappings}");
            Console.WriteLine($"Partidos descargables reutilizados: {cacheInspection.CachedMappings}");
            if (cacheInspection.FutureMappings > 0)
                Console.WriteLine($"Partidos futuros omitidos: {cacheInspection.FutureMappings}");
            return true;
        }
    }

    MappingSynchronizationResult syncResult;
    if (skipMappings)
    {
        Console.WriteLine("Paso 1/3 · Se reutiliza el mapping actual. Se omite sync-mappings.");
        syncResult = new MappingSynchronizationResult(
            true,
            false,
            explicitMatchIds.OrderBy(id => id).ToList());
    }
    else
    {
        Console.WriteLine("Paso 1/3 · Sincronizando mappings");
        syncResult = await ExecuteSyncMappingsAsync(storage, sourceUrl, includeAll, nonInteractive, explicitMatchIds);
        if (!syncResult.Succeeded)
            return false;
    }

    (bool Succeeded, bool FilesChanged) downloadResult;
    if (!forceRefresh && syncResult.DownloadCandidateMatchWebIds.Count == 0)
    {
        Console.WriteLine();
        Console.WriteLine("Paso 2/3 · Sin partidos nuevos ni UUIDs modificados. Se omite la comprobación de stats y moves.");
        downloadResult = (true, false);
    }
    else
    {
        Console.WriteLine();
        Console.WriteLine("Paso 2/3 · Descargando stats y moves");
        downloadResult = await RunDownloadAsync(
            storage,
            forceRefresh,
            forceRefresh ? null : syncResult.DownloadCandidateMatchWebIds);
        if (!downloadResult.Succeeded)
            return false;
    }

    var analysisNeedsRefresh = syncResult.PhaseMetadataChanged || downloadResult.FilesChanged;

    if (!analysisNeedsRefresh)
    {
        Console.WriteLine();
        Console.WriteLine("Paso 3/3 · Sin cambios en los datos. Se reutiliza el analysis.json actual.");
        return true;
    }

    if (!string.IsNullOrWhiteSpace(analysisDirtyMarkerFile))
    {
        await WriteAnalysisDirtyMarkerAsync(analysisDirtyMarkerFile);
        Console.WriteLine();
        Console.WriteLine("Paso 3/3 · Cambios detectados. La regeneración de analysis.json queda diferida.");
        return true;
    }

    Console.WriteLine();
    Console.WriteLine("Paso 3/3 · Generando analysis.json");
    return await RunGenerateAnalysisAsync();
}

async Task<MappingSynchronizationResult> ExecuteSyncMappingsAsync(
    TeamStoragePaths storage,
    string? sourceUrl,
    bool includeAll,
    bool nonInteractive,
    IReadOnlyCollection<int> explicitMatchIds)
{
    var coordinator = new MappingSynchronizationCoordinator(
        paths,
        new MatchMappingSyncService(paths.BrowserProfileDir, paths.MsStatsTokenFile),
        jsonOptions);
    var result = await coordinator.ExecuteAsync(
        storage,
        sourceUrl,
        includeAll,
        interactive: !nonInteractive,
        explicitMatchIds,
        Console.WriteLine);

    return result;
}

async Task<(bool Succeeded, bool FilesChanged)> RunDownloadAsync(
    TeamStoragePaths storage,
    bool forceRefresh,
    IReadOnlyCollection<int>? candidateMatchWebIds = null)
{
    if (!File.Exists(storage.MappingFile))
    {
        Console.WriteLine($"No existe el fichero {storage.MappingFile}");
        return (false, false);
    }

    var mappings = await LoadMappingsAsync(storage.MappingFile, jsonOptions);
    var candidateMatchIds = candidateMatchWebIds?
        .Where(matchWebId => matchWebId > 0)
        .Distinct()
        .ToHashSet();

    var validMappings = mappings
        .Where(x => !string.IsNullOrWhiteSpace(x.UuidMatch))
        .Where(x => candidateMatchIds is null || candidateMatchIds.Contains(x.MatchWebId))
        .ToList();
    var futureMappings = validMappings
        .Where(x => IsFutureMatch(x.MatchDate))
        .ToList();
    var downloadableMappings = validMappings
        .Except(futureMappings)
        .ToList();
    var cachedMappings = forceRefresh
        ? []
        : downloadableMappings
            .Where(mapping =>
            {
                var statsPath = storage.GetStatsPath(mapping.MatchWebId, mapping.UuidMatch!);
                var movesPath = storage.GetMovesPath(mapping.MatchWebId, mapping.UuidMatch!);
                return File.Exists(statsPath) && File.Exists(movesPath);
            })
            .ToList();
    var pendingMappings = forceRefresh
        ? downloadableMappings
        : downloadableMappings.Except(cachedMappings).ToList();
    var downloadedCount = 0;
    var skippedCount = cachedMappings.Count;
    var filesChanged = false;

    Console.WriteLine($"Mappings totales: {mappings.Count}");
    Console.WriteLine($"Mappings válidos : {validMappings.Count}");
    if (futureMappings.Count > 0)
        Console.WriteLine($"Partidos futuros omitidos: {futureMappings.Count}");
    if (candidateMatchIds is not null)
        Console.WriteLine($"Partidos candidatos: {candidateMatchIds.Count}");
    Console.WriteLine(forceRefresh
        ? "Modo forzado: se consultará de nuevo cada partido descargable."
        : "Modo caché: se reutilizan stats y moves si ya existen.");

    if (pendingMappings.Count == 0)
    {
        Console.WriteLine("No hay partidos pendientes de descarga.");
        Console.WriteLine();
        Console.WriteLine("Terminado.");
        Console.WriteLine($"Descargas realizadas: {downloadedCount}");
        Console.WriteLine($"Partidos reutilizados: {skippedCount}");
        Console.WriteLine($"Stats guardados en: {Path.GetFullPath(storage.StatsDir)}");
        Console.WriteLine($"Moves guardados en: {Path.GetFullPath(storage.MovesDir)}");
        return (true, false);
    }

    var msStatsToken = MsStatsTokenStore.LoadValid(paths.MsStatsTokenFile);
    using var http = MsStatsHttpClientFactory.Create();
    var client = new MsStatsClient(http, msStatsToken);
    var appAccountSettings = AppAccountSettings.Resolve(paths.OutputDir);
    if (appAccountSettings.Error is not null)
        Console.WriteLine($"Cuenta de la app: {appAccountSettings.Error}");
    var appClient = FcbqAppClient.TryCreate(http, paths.FcbqAppTokenFile, appAccountSettings);
    var legacyStatsIds = await LoadLegacyStatsIdsAsync(appClient, storage, pendingMappings);
    var statsSources = new System.Collections.Concurrent.ConcurrentDictionary<int, string?>();

    if (msStatsToken is null && appClient is null && pendingMappings.Any(mapping => MsStatsClient.IsStatsGuid(mapping.UuidMatch)))
    {
        var withoutToken = pendingMappings.Count(mapping => MsStatsClient.IsStatsGuid(mapping.UuidMatch));
        Console.WriteLine($"Sin token válido de msstats: se omiten {withoutToken} partido(s) de la temporada actual.");
        Console.WriteLine("El token se renueva en el paso de mappings con navegador (no con --skip-mappings).");
        pendingMappings = pendingMappings
            .Where(mapping => !MsStatsClient.IsStatsGuid(mapping.UuidMatch))
            .ToList();

        if (pendingMappings.Count == 0)
            return (true, false);
    }

    var requestedConcurrency = GetConfiguredMaxParallelMatchDownloads();
    var concurrency = Math.Min(requestedConcurrency, pendingMappings.Count);
    var consoleLock = new object();

    Console.WriteLine($"Partidos a descargar: {pendingMappings.Count}");
    Console.WriteLine($"Concurrencia máxima : {concurrency}");

    using var semaphore = new SemaphoreSlim(concurrency);
    var results = await Task.WhenAll(pendingMappings.Select(async mapping =>
    {
        await semaphore.WaitAsync();

        try
        {
            lock (consoleLock)
            {
                Console.WriteLine($"Procesando matchWebId={mapping.MatchWebId}, uuid={mapping.UuidMatch}");
            }

            var statsPath = storage.GetStatsPath(mapping.MatchWebId, mapping.UuidMatch!);
            var movesPath = storage.GetMovesPath(mapping.MatchWebId, mapping.UuidMatch!);

            try
            {
                string? statsRaw = null;
                string? movesRaw = null;
                string? statsSource = null;

                if (!MsStatsClient.IsStatsGuid(mapping.UuidMatch) || msStatsToken is not null)
                {
                    var statsTask = client.GetMatchStatsRawAsync(mapping.UuidMatch!);
                    var movesTask = client.GetMatchMovesRawAsync(mapping.UuidMatch!);
                    await Task.WhenAll(statsTask, movesTask);
                    statsRaw = await statsTask;
                    movesRaw = await movesTask;
                }

                // Desde 2026-2027 hay categorías (p. ej. Pre-mini) que en la web solo muestran el marcador.
                // Con la cuenta de la app se piden las stats completas al endpoint antiguo.
                if ((statsRaw is null || !HasMatchPlayers(statsRaw)) &&
                    appClient is not null &&
                    legacyStatsIds.TryGetValue(mapping.MatchWebId, out var legacyStatsId))
                {
                    var appStatsRaw = await appClient.GetMatchStatsRawAsync(legacyStatsId);
                    if (HasMatchPlayers(appStatsRaw))
                    {
                        statsRaw = appStatsRaw;
                        movesRaw = await appClient.GetMatchMovesRawAsync(legacyStatsId);
                        statsSource = "app";
                    }
                }

                // La fuente puede responder 200 con `{}` (p. ej. partidos de una temporada ya archivada).
                // Eso no es un partido: se trata como fallo para no sobrescribir datos buenos con vacíos.
                if (statsRaw is null || !HasMatchTeams(statsRaw))
                    throw new InvalidDataException("La fuente devolvió estadísticas vacías (sin equipos). No se sobrescribe nada.");

                // Desde 2026-2027 la fuente publica primero el partido sin jugadoras (solo marcador y parciales).
                // No se guarda: así la fase sigue incompleta y la próxima sync lo vuelve a pedir.
                if (!HasMatchPlayers(statsRaw))
                    throw new InvalidDataException("Estadísticas aún sin jugadoras (solo marcador). Se reintentará en la próxima sync.");

                statsSources[mapping.MatchWebId] = statsSource;

                var prettyStats = JsonFormatting.PrettyPrint(statsRaw);
                var prettyMoves = JsonFormatting.PrettyPrint(movesRaw);

                var statsChanged = await WriteFileIfChangedAsync(statsPath, prettyStats);
                // Un partido puede no tener jugada a jugada, pero unas jugadas ya guardadas no se sustituyen por vacías.
                var keepExistingMoves = IsEmptyMovesPayload(movesRaw) &&
                                        File.Exists(movesPath) &&
                                        !IsEmptyMovesPayload(await File.ReadAllTextAsync(movesPath));
                var movesChanged = !keepExistingMoves && await WriteFileIfChangedAsync(movesPath, prettyMoves);
                var staleFilesDeleted = DeleteStaleMatchFiles(storage, mapping.MatchWebId, mapping.UuidMatch!);
                var anyChanged = statsChanged || movesChanged || staleFilesDeleted;

                lock (consoleLock)
                {
                    Console.WriteLine(anyChanged
                        ? "  OK -> stats y moves actualizados"
                        : "  OK -> sin cambios en stats ni moves");
                }

                return (Downloaded: true, FilesChanged: anyChanged);
            }
            catch (Exception ex)
            {
                lock (consoleLock)
                {
                    Console.WriteLine($"  ERROR -> {ex.Message}");
                }

                await Task.Delay(DownloadErrorCooldownMs);
                return (Downloaded: false, FilesChanged: false);
            }
        }
        finally
        {
            semaphore.Release();
        }
    }));

    downloadedCount = results.Count(result => result.Downloaded);
    filesChanged = results.Any(result => result.FilesChanged);

    if (await SaveStatsSourcesAsync(storage, mappings, statsSources))
        filesChanged = true;

    Console.WriteLine();
    Console.WriteLine("Terminado.");
    Console.WriteLine($"Descargas realizadas: {downloadedCount}");
    Console.WriteLine($"Partidos reutilizados: {skippedCount}");
    Console.WriteLine($"Stats guardados en: {Path.GetFullPath(storage.StatsDir)}");
    Console.WriteLine($"Moves guardados en: {Path.GetFullPath(storage.MovesDir)}");
    return (true, filesChanged);
}

int GetConfiguredMaxParallelMatchDownloads()
{
    var rawValue = Environment.GetEnvironmentVariable("BARNASTATS_MAX_PARALLEL_MATCH_DOWNLOADS");
    return int.TryParse(rawValue, out var parsedValue) && parsedValue > 0
        ? parsedValue
        : DefaultMaxParallelMatchDownloads;
}

async Task<bool> RunGenerateAnalysisAsync()
{
    if (!File.Exists(paths.GenerateAnalysisProjectFile))
    {
        Console.WriteLine($"No se encontró GenerateAnalisys en: {paths.GenerateAnalysisProjectFile}");
        return false;
    }

    var startInfo = new ProcessStartInfo
    {
        FileName = "dotnet",
        WorkingDirectory = paths.RepoRoot,
        UseShellExecute = false
    };

    startInfo.ArgumentList.Add("run");
    startInfo.ArgumentList.Add("--project");
    startInfo.ArgumentList.Add(paths.GenerateAnalysisProjectFile);

    using var process = Process.Start(startInfo);

    if (process is null)
    {
        Console.WriteLine("No se pudo arrancar el proceso de GenerateAnalisys.");
        return false;
    }

    await process.WaitForExitAsync();

    if (process.ExitCode == 0)
        return true;

    Console.WriteLine($"GenerateAnalisys terminó con código {process.ExitCode}.");
    return false;
}

async Task<List<MatchMapping>> LoadMappingsAsync(string mappingFile, JsonSerializerOptions options)
{
    if (!File.Exists(mappingFile))
        return [];

    var mappingJson = await File.ReadAllTextAsync(mappingFile);
    return JsonSerializer.Deserialize<List<MatchMapping>>(mappingJson, options) ?? [];
}

static bool HasMatchTeams(string statsRaw)
{
    try
    {
        using var document = JsonDocument.Parse(statsRaw);
        var root = document.RootElement;
        if (root.ValueKind != JsonValueKind.Object)
            return false;

        if (root.TryGetProperty("teams", out var teams))
            return teams.ValueKind == JsonValueKind.Array && teams.GetArrayLength() >= 2;

        // Formato 2026-2027: `boxscore[0]` (periodo 0 = partido entero) con `local` y `visitor`.
        return TryGetFullMatchBoxscore(root, out var boxscore) &&
               boxscore.TryGetProperty("local", out var local) && local.ValueKind == JsonValueKind.Object &&
               boxscore.TryGetProperty("visitor", out var visitor) && visitor.ValueKind == JsonValueKind.Object;
    }
    catch (JsonException)
    {
        return false;
    }
}

static bool HasMatchPlayers(string statsRaw)
{
    try
    {
        using var document = JsonDocument.Parse(statsRaw);
        var root = document.RootElement;
        if (root.TryGetProperty("teams", out var teams))
            return teams.ValueKind == JsonValueKind.Array &&
                   teams.GetArrayLength() >= 2 &&
                   teams.EnumerateArray().All(team =>
                       team.TryGetProperty("players", out var teamPlayers) &&
                       teamPlayers.ValueKind == JsonValueKind.Array &&
                       teamPlayers.GetArrayLength() > 0);

        return TryGetFullMatchBoxscore(root, out var boxscore) &&
               HasPlayers(boxscore, "local") &&
               HasPlayers(boxscore, "visitor");
    }
    catch (JsonException)
    {
        return false;
    }

    static bool HasPlayers(JsonElement boxscore, string side)
    {
        return boxscore.TryGetProperty(side, out var team) &&
               team.TryGetProperty("players", out var players) &&
               players.ValueKind == JsonValueKind.Array &&
               players.GetArrayLength() > 0;
    }
}

async Task<IReadOnlyDictionary<int, string>> LoadLegacyStatsIdsAsync(
    FcbqAppClient? appClient,
    TeamStoragePaths storage,
    IReadOnlyList<MatchMapping> pendingMappings)
{
    if (appClient is null ||
        storage.Scope.Kind != StorageScopeKind.Phase ||
        storage.Scope.Id is not > 0 ||
        !pendingMappings.Any(mapping => MsStatsClient.IsStatsGuid(mapping.UuidMatch)))
    {
        return new Dictionary<int, string>();
    }

    try
    {
        var legacyStatsIds = await appClient.GetLegacyStatsIdsAsync(storage.Scope.Id.Value);
        Console.WriteLine($"Cuenta de la app activa: {legacyStatsIds.Count} partidos con stats de la app en la fase.");
        return legacyStatsIds;
    }
    catch (Exception ex)
    {
        Console.WriteLine($"No se pudieron leer los ids de la app: {ex.Message}");
        return new Dictionary<int, string>();
    }
}

async Task<bool> SaveStatsSourcesAsync(
    TeamStoragePaths storage,
    IReadOnlyList<MatchMapping> mappings,
    IReadOnlyDictionary<int, string?> statsSources)
{
    var changed = false;
    foreach (var mapping in mappings)
    {
        if (!statsSources.TryGetValue(mapping.MatchWebId, out var source) ||
            string.Equals(mapping.StatsSource, source, StringComparison.Ordinal))
        {
            continue;
        }

        mapping.StatsSource = source;
        changed = true;
    }

    if (changed)
        await File.WriteAllTextAsync(storage.MappingFile, JsonSerializer.Serialize(mappings, jsonOptions));

    return changed;
}

static bool TryGetFullMatchBoxscore(JsonElement root, out JsonElement boxscore)
{
    boxscore = default;
    if (!root.TryGetProperty("boxscore", out var periods) || periods.ValueKind != JsonValueKind.Array)
        return false;

    foreach (var period in periods.EnumerateArray())
    {
        if (period.TryGetProperty("period", out var number) && number.TryGetInt32(out var value) && value == 0)
        {
            boxscore = period;
            return true;
        }
    }

    return false;
}

static bool IsEmptyJsonPayload(string? raw)
{
    var trimmed = raw?.Trim() ?? "";
    return trimmed is "" or "{}" or "[]" or "null";
}

static bool IsEmptyMovesPayload(string? raw)
{
    if (IsEmptyJsonPayload(raw))
        return true;

    try
    {
        using var document = JsonDocument.Parse(raw!);
        return document.RootElement.ValueKind == JsonValueKind.Object &&
               document.RootElement.TryGetProperty("playByPlay", out var events) &&
               events.ValueKind == JsonValueKind.Array &&
               events.GetArrayLength() == 0;
    }
    catch (JsonException)
    {
        return false;
    }
}

async Task<bool> WriteFileIfChangedAsync(string path, string content)
{
    if (File.Exists(path))
    {
        var existingContent = await File.ReadAllTextAsync(path);
        if (string.Equals(existingContent, content, StringComparison.Ordinal))
            return false;
    }

    await File.WriteAllTextAsync(path, content);
    return true;
}

async Task WriteAnalysisDirtyMarkerAsync(string markerFile)
{
    var fullMarkerPath = Path.GetFullPath(markerFile);
    var markerDir = Path.GetDirectoryName(fullMarkerPath);

    if (!string.IsNullOrWhiteSpace(markerDir))
        Directory.CreateDirectory(markerDir);

    await File.WriteAllTextAsync(fullMarkerPath, DateTimeOffset.UtcNow.ToString("O"));
}

bool DeleteStaleMatchFiles(TeamStoragePaths storage, int matchWebId, string currentUuidMatch)
{
    var deletedAny = false;
    var currentStatsPath = Path.GetFullPath(storage.GetStatsPath(matchWebId, currentUuidMatch));
    var currentMovesPath = Path.GetFullPath(storage.GetMovesPath(matchWebId, currentUuidMatch));
    var matchPrefix = $"{matchWebId}_";

    foreach (var path in Directory.GetFiles(storage.StatsDir, $"{matchPrefix}*_stats.json", SearchOption.TopDirectoryOnly))
    {
        if (string.Equals(Path.GetFullPath(path), currentStatsPath, StringComparison.OrdinalIgnoreCase))
            continue;

        File.Delete(path);
        deletedAny = true;
    }

    foreach (var path in Directory.GetFiles(storage.MovesDir, $"{matchPrefix}*_moves.json", SearchOption.TopDirectoryOnly))
    {
        if (string.Equals(Path.GetFullPath(path), currentMovesPath, StringComparison.OrdinalIgnoreCase))
            continue;

        File.Delete(path);
        deletedAny = true;
    }

    return deletedAny;
}

void PrintHelp()
{
    Console.WriteLine("Uso:");
    Console.WriteLine("  dotnet run --project BarnaStats/BarnaStats.csproj");
    Console.WriteLine("    Descarga stats y moves usando caché y los uuid existentes en match_mapping.json.");
    Console.WriteLine();
    Console.WriteLine("  dotnet run --project BarnaStats/BarnaStats.csproj -- sync-mappings --phase 20855 --all");
    Console.WriteLine("    Usa la carpeta de la fase 20855 para reintentar o descargar sin volver a pegar la URL.");
    Console.WriteLine();
    Console.WriteLine("  dotnet run --project BarnaStats/BarnaStats.csproj -- sync-mappings");
    Console.WriteLine("    Abre un navegador y resuelve los uuid faltantes del mapping actual.");
    Console.WriteLine();
    Console.WriteLine("  dotnet run --project BarnaStats/BarnaStats.csproj -- sync-mappings https://www.basquetcatala.cat/competicions/resultats/20855/0");
    Console.WriteLine("    Extrae partidos de una fase y usa los uuid directos cuando la página los expone.");
    Console.WriteLine();
    Console.WriteLine("  dotnet run --project BarnaStats/BarnaStats.csproj -- sync-mappings --all");
    Console.WriteLine("    Reintenta todos los matchWebId existentes en el mapping actual.");
    Console.WriteLine();
    Console.WriteLine("  dotnet run --project BarnaStats/BarnaStats.csproj -- sync-mappings 70001 70002");
    Console.WriteLine("    Añade esos matchWebId al mapping y resuelve sus uuid.");
    Console.WriteLine();
    Console.WriteLine("  dotnet run --project BarnaStats/BarnaStats.csproj -- sync-all https://www.basquetcatala.cat/competicions/resultats/20855/0");
    Console.WriteLine("    Sincroniza el mapping, descarga stats/moves y genera analysis.json.");
    Console.WriteLine();
    Console.WriteLine("  dotnet run --project BarnaStats/BarnaStats.csproj -- sync-all --force https://www.basquetcatala.cat/competicions/resultats/20855/0");
    Console.WriteLine("    Fuerza la descarga de stats/moves aunque ya existan en caché.");
    Console.WriteLine();
    Console.WriteLine("  dotnet run --project BarnaStats/BarnaStats.csproj -- sync-all --non-interactive https://www.basquetcatala.cat/competicions/resultats/20855/0");
    Console.WriteLine("    Igual que sync-all, pero sin pedir ENTER en consola mientras resuelves captcha.");
    Console.WriteLine();
    Console.WriteLine("  dotnet run --project BarnaStats/BarnaStats.csproj -- sync-all --skip-mappings --phase 20855 70001 70002");
    Console.WriteLine("    Reutiliza el mapping actual y descarga solo esos matchWebId candidatos, sin abrir Playwright.");
    Console.WriteLine();
    Console.WriteLine("  Estructura por scope:");
    Console.WriteLine("    BarnaStats/out/results_sources.json");
    Console.WriteLine("    BarnaStats/out/phases/{phaseId}/match_mapping.json");
    Console.WriteLine("    BarnaStats/out/phases/{phaseId}/phase_metadata.json");
    Console.WriteLine("    BarnaStats/out/phases/{phaseId}/stats");
    Console.WriteLine("    BarnaStats/out/phases/{phaseId}/moves");
}

bool TryNormalizeSourceUrl(string input, out string normalizedUrl)
{
    normalizedUrl = string.Empty;

    if (!Uri.TryCreate(input, UriKind.Absolute, out var uri))
        return false;

    if (!uri.Scheme.Equals(Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) &&
        !uri.Scheme.Equals(Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase))
    {
        return false;
    }

    if (!uri.Host.EndsWith("basquetcatala.cat", StringComparison.OrdinalIgnoreCase))
        return false;

    normalizedUrl = uri.ToString();
    return true;
}

bool TryParseSyncArgs(
    string[] syncArgs,
    out string? sourceUrl,
    out StorageScope? scope,
    out bool includeAll,
    out bool nonInteractive,
    out bool forceRefresh,
    out string? analysisDirtyMarkerFile,
    out bool skipMappings,
    out HashSet<int> explicitMatchIds)
{
    sourceUrl = null;
    scope = null;
    includeAll = false;
    nonInteractive = false;
    forceRefresh = false;
    analysisDirtyMarkerFile = null;
    skipMappings = false;
    explicitMatchIds = [];

    for (var i = 0; i < syncArgs.Length; i += 1)
    {
        var arg = syncArgs[i];

        if (arg.Equals("--all", StringComparison.OrdinalIgnoreCase))
        {
            includeAll = true;
            continue;
        }

        if (arg.Equals("--non-interactive", StringComparison.OrdinalIgnoreCase))
        {
            nonInteractive = true;
            continue;
        }

        if (arg.Equals("--force", StringComparison.OrdinalIgnoreCase))
        {
            forceRefresh = true;
            continue;
        }

        if (arg.Equals("--skip-mappings", StringComparison.OrdinalIgnoreCase))
        {
            skipMappings = true;
            continue;
        }

        if (arg.Equals("--analysis-dirty-marker", StringComparison.OrdinalIgnoreCase))
        {
            if (i + 1 >= syncArgs.Length)
            {
                Console.WriteLine("Falta la ruta del marker después de --analysis-dirty-marker.");
                PrintHelp();
                return false;
            }

            analysisDirtyMarkerFile = syncArgs[i + 1];
            i += 1;
            continue;
        }

        if (arg.Equals("--phase", StringComparison.OrdinalIgnoreCase))
        {
            if (i + 1 >= syncArgs.Length)
            {
                Console.WriteLine("Falta el phaseId después de --phase.");
                PrintHelp();
                return false;
            }

            if (!int.TryParse(syncArgs[i + 1], out var phaseId) || phaseId <= 0)
            {
                Console.WriteLine($"phaseId no válido: {syncArgs[i + 1]}");
                PrintHelp();
                return false;
            }

            if (!TryAssignScope(StorageScope.Phase(phaseId), ref scope, out var phaseError))
            {
                Console.WriteLine(phaseError);
                return false;
            }

            i += 1;
            continue;
        }

        if (arg.Equals("--results", StringComparison.OrdinalIgnoreCase) ||
            arg.Equals("--source", StringComparison.OrdinalIgnoreCase))
        {
            if (i + 1 >= syncArgs.Length)
            {
                Console.WriteLine($"Falta la URL después de {arg}.");
                PrintHelp();
                return false;
            }

            if (!TryHandleSourceUrl(syncArgs[i + 1], ref sourceUrl, ref scope, out var sourceError))
            {
                Console.WriteLine(sourceError);
                return false;
            }

            i += 1;
            continue;
        }

        if (TryNormalizeSourceUrl(arg, out _))
        {
            if (!TryHandleSourceUrl(arg, ref sourceUrl, ref scope, out var inlineError))
            {
                Console.WriteLine(inlineError);
                return false;
            }

            continue;
        }

        if (int.TryParse(arg, out var matchWebId))
        {
            explicitMatchIds.Add(matchWebId);
            continue;
        }

        Console.WriteLine($"Argumento no reconocido: {arg}");
        PrintHelp();
        return false;
    }

    return true;
}

bool TryHandleSourceUrl(
    string rawSourceUrl,
    ref string? sourceUrl,
    ref StorageScope? scope,
    out string? error)
{
    error = null;

    if (!TryNormalizeSourceUrl(rawSourceUrl, out var normalizedSourceUrl))
    {
        error = $"URL no válida: {rawSourceUrl}";
        return false;
    }

    if (!TryInferScopeFromSourceUrl(normalizedSourceUrl, out var inferredScope))
    {
        error = $"La URL no parece una página de resultados válida: {normalizedSourceUrl}";
        return false;
    }

    if (!TryAssignScope(inferredScope, ref scope, out error))
        return false;

    sourceUrl = normalizedSourceUrl;
    return true;
}

bool TryAssignScope(StorageScope candidateScope, ref StorageScope? currentScope, out string? error)
{
    error = null;

    if (currentScope is null)
    {
        currentScope = candidateScope;
        return true;
    }

    if (currentScope.Kind == candidateScope.Kind && currentScope.Id == candidateScope.Id)
        return true;

    error = $"Conflicto de scope: ya estabas trabajando con {currentScope}, pero se intentó usar {candidateScope}.";
    return false;
}

bool IsFutureMatch(DateTime? matchDate)
{
    if (!matchDate.HasValue)
        return false;

    var localMatchDate = matchDate.Value;
    if (localMatchDate.TimeOfDay == TimeSpan.Zero)
        return localMatchDate.Date > DateTime.Today;

    return localMatchDate > DateTime.Now;
}

bool TryInferScopeFromSourceUrl(string sourceUrl, out StorageScope scope)
{
    scope = StorageScope.Root();

    if (!Uri.TryCreate(sourceUrl, UriKind.Absolute, out var uri))
        return false;

    var segments = uri.AbsolutePath
        .Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    if (segments.Length >= 3 &&
        segments[0].Equals("competicions", StringComparison.OrdinalIgnoreCase) &&
        segments[1].Equals("resultats", StringComparison.OrdinalIgnoreCase) &&
        int.TryParse(segments[2], out var phaseId) &&
        phaseId > 0)
    {
        scope = StorageScope.Phase(phaseId);
        return true;
    }

    return false;
}
