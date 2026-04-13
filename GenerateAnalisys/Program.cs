using GenerateAnalisys.Services;
using GenerateAnalisys.Utilities;

var paths = AnalysisPaths.ResolveDefault();

if (paths is null)
{
    Console.WriteLine("No se encontró BarnaStats/out.");
    return;
}

var service = new MatchAnalysisService();
var result = await service.ProcessAsync(paths.RawDataRootDir);

await AnalysisJsonWriter.WriteAsync(paths.AnalysisJson, result);
await AnalysisJsonWriter.WriteAsync(paths.WebAnalysisJson, result);

Console.WriteLine();
Console.WriteLine("Hecho.");
Console.WriteLine($"JSON análisis:     {Path.GetFullPath(paths.AnalysisJson)}");
Console.WriteLine($"JSON para web:     {Path.GetFullPath(paths.WebAnalysisJson)}");
Console.WriteLine($"Equipos analizados:{result.Teams.Count}");
Console.WriteLine($"Partidos analizados:{result.TotalMatches}");
