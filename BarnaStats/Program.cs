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

if (!File.Exists(paths.MappingFile))
{
    Console.WriteLine($"No existe el fichero {paths.MappingFile}");
    return;
}

var mappingJson = await File.ReadAllTextAsync(paths.MappingFile);
var mappings = JsonSerializer.Deserialize<List<MatchMapping>>(mappingJson, jsonOptions) ?? [];

var validMappings = mappings
    .Where(x => !string.IsNullOrWhiteSpace(x.UuidMatch))
    .ToList();

Console.WriteLine($"Mappings totales: {mappings.Count}");
Console.WriteLine($"Mappings válidos : {validMappings.Count}");

using var http = MsStatsHttpClientFactory.Create();
var client = new MsStatsClient(http);
var summaryBuilder = new MatchSummaryBuilder();
var summaryRows = new List<SummaryRow>();

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

        var summary = summaryBuilder.Build(mapping, statsRaw, movesRaw);
        summaryRows.Add(summary);

        Console.WriteLine(
            $"  OK -> {summary.HomeTeam} {summary.HomeScore} - {summary.AwayScore} {summary.AwayTeam}");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"  ERROR -> {ex.Message}");
        summaryRows.Add(new SummaryRow
        {
            MatchWebId = mapping.MatchWebId,
            UuidMatch = mapping.UuidMatch!,
            Status = "ERROR",
            Error = ex.Message
        });
    }

    await Task.Delay(300);
}

await SummaryCsvWriter.WriteAsync(paths.SummaryCsv, summaryRows);

Console.WriteLine();
Console.WriteLine("Terminado.");
Console.WriteLine($"Stats guardados en: {Path.GetFullPath(paths.StatsDir)}");
Console.WriteLine($"Moves guardados en: {Path.GetFullPath(paths.MovesDir)}");
Console.WriteLine($"Summary CSV:        {Path.GetFullPath(paths.SummaryCsv)}");
