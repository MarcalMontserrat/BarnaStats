using System.Text.Json;
using BarnaStats.Models;
using BarnaStats.Services;
using BarnaStats.Utilities;

var paths = BarnaStatsPaths.CreateDefault();
paths.EnsureDirectories();

var jsonOptions = new JsonSerializerOptions
{
    PropertyNameCaseInsensitive = true,
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
        case "help":
        case "--help":
        case "-h":
            PrintHelp();
            return;
    }
}

await RunDownloadAsync();

return;

async Task RunSyncMappingsAsync(string[] syncArgs)
{
    if (!File.Exists(paths.MappingFile))
    {
        Console.WriteLine($"No existe el mapping en: {paths.MappingFile}");
        Console.WriteLine("Se creará automáticamente si pasas matchWebIds explícitos.");
    }

    var mappings = await LoadMappingsAsync(paths.MappingFile, jsonOptions);
    var mappingsById = mappings.ToDictionary(x => x.MatchWebId);

    var includeAll = false;
    var explicitMatchIds = new HashSet<int>();

    foreach (var arg in syncArgs)
    {
        if (arg.Equals("--all", StringComparison.OrdinalIgnoreCase))
        {
            includeAll = true;
            continue;
        }

        if (int.TryParse(arg, out var matchWebId))
        {
            explicitMatchIds.Add(matchWebId);
            continue;
        }

        Console.WriteLine($"Argumento no reconocido: {arg}");
        PrintHelp();
        return;
    }

    foreach (var matchWebId in explicitMatchIds)
    {
        if (!mappingsById.ContainsKey(matchWebId))
        {
            var mapping = new MatchMapping { MatchWebId = matchWebId };
            mappings.Add(mapping);
            mappingsById[matchWebId] = mapping;
        }
    }

    var targetMatchIds = includeAll
        ? mappings.Select(x => x.MatchWebId).OrderBy(x => x).ToList()
        : explicitMatchIds.Count > 0
            ? explicitMatchIds.OrderBy(x => x).ToList()
            : mappings
                .Where(x => string.IsNullOrWhiteSpace(x.UuidMatch))
                .Select(x => x.MatchWebId)
                .OrderBy(x => x)
                .ToList();

    if (targetMatchIds.Count == 0)
    {
        Console.WriteLine("No hay partidos pendientes para sincronizar.");
        Console.WriteLine("Usa `sync-mappings --all` para reintentar todos o pasa matchWebIds explícitos.");
        return;
    }

    Console.WriteLine($"Mappings totales: {mappings.Count}");
    Console.WriteLine($"Partidos a resolver: {targetMatchIds.Count}");

    try
    {
        var syncService = new MatchMappingSyncService(paths.BrowserProfileDir);
        var resolved = await syncService.ResolveAsync(targetMatchIds);

        var updated = 0;

        foreach (var matchWebId in targetMatchIds)
        {
            if (!resolved.TryGetValue(matchWebId, out var uuidMatch) || string.IsNullOrWhiteSpace(uuidMatch))
                continue;

            mappingsById[matchWebId].UuidMatch = uuidMatch;
            updated += 1;
        }

        var orderedMappings = mappings
            .OrderBy(x => x.MatchWebId)
            .ToList();

        await SaveMappingsAsync(paths.MappingFile, orderedMappings, jsonOptions);

        Console.WriteLine();
        Console.WriteLine($"Sincronización terminada. UUIDs actualizados: {updated}");
        Console.WriteLine($"Mapping guardado en: {Path.GetFullPath(paths.MappingFile)}");
    }
    catch (Exception ex)
    {
        Console.WriteLine("No se pudo completar la sincronización de mappings.");
        Console.WriteLine(ex.Message);
        Console.WriteLine("Si falla al abrir el navegador de Playwright, prueba a instalar Chromium o usa Chrome local.");
    }
}

async Task RunDownloadAsync()
{
    if (!File.Exists(paths.MappingFile))
    {
        Console.WriteLine($"No existe el fichero {paths.MappingFile}");
        return;
    }

    var mappings = await LoadMappingsAsync(paths.MappingFile, jsonOptions);

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

            var statsPath = paths.GetStatsPath(mapping.MatchWebId, mapping.UuidMatch!);
            var movesPath = paths.GetMovesPath(mapping.MatchWebId, mapping.UuidMatch!);

            await File.WriteAllTextAsync(statsPath, JsonFormatting.PrettyPrint(statsRaw));
            await File.WriteAllTextAsync(movesPath, JsonFormatting.PrettyPrint(movesRaw));
            Console.WriteLine($"  OK -> guardados stats y moves");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"  ERROR -> {ex.Message}");
        }

        await Task.Delay(300);
    }

    Console.WriteLine();
    Console.WriteLine("Terminado.");
    Console.WriteLine($"Stats guardados en: {Path.GetFullPath(paths.StatsDir)}");
    Console.WriteLine($"Moves guardados en: {Path.GetFullPath(paths.MovesDir)}");
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
    Console.WriteLine("  dotnet run --project BarnaStats/BarnaStats.csproj -- sync-mappings");
    Console.WriteLine("    Abre un navegador y resuelve los uuid faltantes del mapping.");
    Console.WriteLine();
    Console.WriteLine("  dotnet run --project BarnaStats/BarnaStats.csproj -- sync-mappings --all");
    Console.WriteLine("    Reintenta todos los matchWebId existentes en el mapping.");
    Console.WriteLine();
    Console.WriteLine("  dotnet run --project BarnaStats/BarnaStats.csproj -- sync-mappings 70001 70002");
    Console.WriteLine("    Añade esos matchWebId al mapping y resuelve sus uuid.");
}
