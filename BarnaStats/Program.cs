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

if (args.Length > 0)
{
    var command = args[0].Trim().ToLowerInvariant();

    switch (command)
    {
        case "sync-mappings":
            await RunSyncMappingsAsync(args.Skip(1).ToArray());
            return;
        case "sync-all":
            await RunSyncAllAsync(args.Skip(1).ToArray());
            return;
        case "help":
        case "--help":
        case "-h":
            PrintHelp();
            return;
    }
}

await RunDownloadAsync(defaultStorage);

return;

async Task RunSyncMappingsAsync(string[] syncArgs)
{
    if (!TryParseSyncArgs(syncArgs, out var sourceUrl, out var scope, out var includeAll, out var nonInteractive, out var explicitMatchIds))
        return;

    var storage = paths.CreateStorage(scope);
    storage.EnsureDirectories();

    await ExecuteSyncMappingsAsync(storage, sourceUrl, includeAll, nonInteractive, explicitMatchIds);
}

async Task RunSyncAllAsync(string[] syncArgs)
{
    if (!TryParseSyncArgs(syncArgs, out var sourceUrl, out var scope, out var includeAll, out var nonInteractive, out var explicitMatchIds))
        return;

    var storage = paths.CreateStorage(scope);
    storage.EnsureDirectories();

    Console.WriteLine("Paso 1/3 · Sincronizando mappings");
    var syncSucceeded = await ExecuteSyncMappingsAsync(storage, sourceUrl, includeAll, nonInteractive, explicitMatchIds);
    if (!syncSucceeded)
        return;

    Console.WriteLine();
    Console.WriteLine("Paso 2/3 · Descargando stats y moves");
    var downloadSucceeded = await RunDownloadAsync(storage);
    if (!downloadSucceeded)
        return;

    Console.WriteLine();
    Console.WriteLine("Paso 3/3 · Generando analysis.json");
    await RunGenerateAnalysisAsync();
}

async Task<bool> ExecuteSyncMappingsAsync(
    TeamStoragePaths storage,
    string? sourceUrl,
    bool includeAll,
    bool nonInteractive,
    IReadOnlyCollection<int> explicitMatchIds)
{
    if (!File.Exists(storage.MappingFile) &&
        string.IsNullOrWhiteSpace(sourceUrl) &&
        explicitMatchIds.Count == 0)
    {
        Console.WriteLine($"No existe el mapping en: {storage.MappingFile}");
        Console.WriteLine("Pasa una URL de calendario o resultados, o matchWebIds explícitos para crearlo.");
        return false;
    }

    var mappings = await LoadMappingsAsync(storage.MappingFile, jsonOptions);
    var mappingsById = mappings.ToDictionary(x => x.MatchWebId);

    foreach (var matchWebId in explicitMatchIds)
    {
        if (mappingsById.ContainsKey(matchWebId))
            continue;

        var mapping = new MatchMapping { MatchWebId = matchWebId };
        mappings.Add(mapping);
        mappingsById[matchWebId] = mapping;
    }

    try
    {
        var syncService = new MatchMappingSyncService(paths.BrowserProfileDir);
        var syncResult = await syncService.SyncAsync(
            mappings,
            explicitMatchIds,
            includeAll,
            sourceUrl,
            interactive: !nonInteractive);

        var updatedIds = new HashSet<int>();

        foreach (var discovery in syncResult.DiscoveredMappings)
        {
            if (!mappingsById.TryGetValue(discovery.MatchWebId, out var mapping))
            {
                mapping = new MatchMapping { MatchWebId = discovery.MatchWebId };
                mappings.Add(mapping);
                mappingsById[discovery.MatchWebId] = mapping;
            }

            if (string.IsNullOrWhiteSpace(discovery.UuidMatch))
                continue;

            if (string.Equals(mapping.UuidMatch, discovery.UuidMatch, StringComparison.OrdinalIgnoreCase))
                continue;

            mapping.UuidMatch = discovery.UuidMatch;
            updatedIds.Add(discovery.MatchWebId);
        }

        foreach (var matchWebId in syncResult.TargetMatchWebIds)
        {
            if (!syncResult.ResolvedUuids.TryGetValue(matchWebId, out var uuidMatch) || string.IsNullOrWhiteSpace(uuidMatch))
                continue;

            var mapping = mappingsById[matchWebId];
            if (string.Equals(mapping.UuidMatch, uuidMatch, StringComparison.OrdinalIgnoreCase))
                continue;

            mapping.UuidMatch = uuidMatch;
            updatedIds.Add(matchWebId);
        }

        var orderedMappings = mappings
            .OrderBy(x => x.MatchWebId)
            .ToList();

        await SaveMappingsAsync(storage.MappingFile, orderedMappings, jsonOptions);

        Console.WriteLine();

        if (syncResult.TargetMatchWebIds.Count == 0)
        {
            if (updatedIds.Count == 0)
            {
                Console.WriteLine("No hay partidos pendientes para sincronizar.");
                Console.WriteLine("Usa `sync-mappings --all` para reintentar todos o pasa una URL/IDs distintos.");
            }
            else
            {
                Console.WriteLine($"Sincronización terminada. UUIDs actualizados automáticamente: {updatedIds.Count}");
            }
        }
        else
        {
            Console.WriteLine($"Sincronización terminada. UUIDs actualizados: {updatedIds.Count}");
        }

        Console.WriteLine($"Mapping guardado en: {Path.GetFullPath(storage.MappingFile)}");
    }
    catch (Exception ex)
    {
        Console.WriteLine("No se pudo completar la sincronización de mappings.");
        Console.WriteLine(ex.Message);
        Console.WriteLine("Si falla al abrir el navegador de Playwright, prueba a instalar Chromium o usa Chrome local.");
        return false;
    }

    return true;
}

async Task<bool> RunDownloadAsync(TeamStoragePaths storage)
{
    if (!File.Exists(storage.MappingFile))
    {
        Console.WriteLine($"No existe el fichero {storage.MappingFile}");
        return false;
    }

    var mappings = await LoadMappingsAsync(storage.MappingFile, jsonOptions);

    var validMappings = mappings
        .Where(x => !string.IsNullOrWhiteSpace(x.UuidMatch))
        .ToList();

    Console.WriteLine($"Mappings totales: {mappings.Count}");
    Console.WriteLine($"Mappings válidos : {validMappings.Count}");

    using var http = MsStatsHttpClientFactory.Create();
    var client = new MsStatsClient(http);

    foreach (var mapping in validMappings)
    {
        Console.WriteLine($"Procesando matchWebId={mapping.MatchWebId}, uuid={mapping.UuidMatch}");

        try
        {
            var statsRaw = await client.GetMatchStatsRawAsync(mapping.UuidMatch!);
            var movesRaw = await client.GetMatchMovesRawAsync(mapping.UuidMatch!);

            var statsPath = storage.GetStatsPath(mapping.MatchWebId, mapping.UuidMatch!);
            var movesPath = storage.GetMovesPath(mapping.MatchWebId, mapping.UuidMatch!);

            await File.WriteAllTextAsync(statsPath, JsonFormatting.PrettyPrint(statsRaw));
            await File.WriteAllTextAsync(movesPath, JsonFormatting.PrettyPrint(movesRaw));
            Console.WriteLine("  OK -> guardados stats y moves");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"  ERROR -> {ex.Message}");
        }

        await Task.Delay(300);
    }

    Console.WriteLine();
    Console.WriteLine("Terminado.");
    Console.WriteLine($"Stats guardados en: {Path.GetFullPath(storage.StatsDir)}");
    Console.WriteLine($"Moves guardados en: {Path.GetFullPath(storage.MovesDir)}");
    return true;
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

async Task SaveMappingsAsync(string mappingFile, List<MatchMapping> mappings, JsonSerializerOptions options)
{
    var json = JsonSerializer.Serialize(mappings, options);
    await File.WriteAllTextAsync(mappingFile, json);
}

void PrintHelp()
{
    Console.WriteLine("Uso:");
    Console.WriteLine("  dotnet run --project BarnaStats/BarnaStats.csproj");
    Console.WriteLine("    Descarga stats y moves usando los uuid existentes en match_mapping.json.");
    Console.WriteLine();
    Console.WriteLine("  dotnet run --project BarnaStats/BarnaStats.csproj -- sync-mappings --team 81178 --all");
    Console.WriteLine("    Usa la carpeta del equipo 81178 sin necesidad de volver a pegar la URL.");
    Console.WriteLine();
    Console.WriteLine("  dotnet run --project BarnaStats/BarnaStats.csproj -- sync-mappings --phase 20855 --all");
    Console.WriteLine("    Usa la carpeta de la fase 20855 para reintentar o descargar sin volver a pegar la URL.");
    Console.WriteLine();
    Console.WriteLine("  dotnet run --project BarnaStats/BarnaStats.csproj -- sync-mappings");
    Console.WriteLine("    Abre un navegador y resuelve los uuid faltantes del mapping actual.");
    Console.WriteLine();
    Console.WriteLine("  dotnet run --project BarnaStats/BarnaStats.csproj -- sync-mappings https://www.basquetcatala.cat/partits/calendari_equip_global/24/81178");
    Console.WriteLine("    Extrae partidos del calendario del equipo y completa el mapping.");
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
    Console.WriteLine("  dotnet run --project BarnaStats/BarnaStats.csproj -- sync-all --non-interactive https://www.basquetcatala.cat/competicions/resultats/20855/0");
    Console.WriteLine("    Igual que sync-all, pero sin pedir ENTER en consola mientras resuelves captcha.");
    Console.WriteLine();
    Console.WriteLine("  Estructura por scope:");
    Console.WriteLine("    BarnaStats/out/teams/{teamCalendarId}/match_mapping.json");
    Console.WriteLine("    BarnaStats/out/teams/{teamCalendarId}/stats");
    Console.WriteLine("    BarnaStats/out/teams/{teamCalendarId}/moves");
    Console.WriteLine("    BarnaStats/out/phases/{phaseId}/match_mapping.json");
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
    out HashSet<int> explicitMatchIds)
{
    sourceUrl = null;
    scope = null;
    includeAll = false;
    nonInteractive = false;
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

        if (arg.Equals("--team", StringComparison.OrdinalIgnoreCase))
        {
            if (i + 1 >= syncArgs.Length)
            {
                Console.WriteLine("Falta el teamCalendarId después de --team.");
                PrintHelp();
                return false;
            }

            if (!int.TryParse(syncArgs[i + 1], out var teamCalendarId) || teamCalendarId <= 0)
            {
                Console.WriteLine($"teamCalendarId no válido: {syncArgs[i + 1]}");
                PrintHelp();
                return false;
            }

            if (!TryAssignScope(StorageScope.Team(teamCalendarId), ref scope, out var teamError))
            {
                Console.WriteLine(teamError);
                return false;
            }

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

        if (arg.Equals("--calendar", StringComparison.OrdinalIgnoreCase) ||
            arg.Equals("--results", StringComparison.OrdinalIgnoreCase) ||
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
        error = $"La URL no parece un calendario ni una página de resultados válida: {normalizedSourceUrl}";
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

bool TryInferScopeFromSourceUrl(string sourceUrl, out StorageScope scope)
{
    scope = StorageScope.Root();

    if (!Uri.TryCreate(sourceUrl, UriKind.Absolute, out var uri))
        return false;

    var segments = uri.AbsolutePath
        .Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    if (segments.Length >= 3 &&
        segments[0].Equals("partits", StringComparison.OrdinalIgnoreCase) &&
        segments[1].StartsWith("calendari_", StringComparison.OrdinalIgnoreCase) &&
        TryFindTrailingNumericId(segments, minValue: 1000, out var teamCalendarId))
    {
        scope = StorageScope.Team(teamCalendarId);
        return true;
    }

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

bool TryFindTrailingNumericId(IReadOnlyList<string> segments, int minValue, out int id)
{
    for (var index = segments.Count - 1; index >= 0; index -= 1)
    {
        if (!int.TryParse(segments[index], out id) || id <= minValue)
            continue;

        return true;
    }

    id = 0;
    return false;
}
