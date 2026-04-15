using GenerateAnalisys.Services;
using GenerateAnalisys.Utilities;

var paths = AnalysisPaths.ResolveDefault();

if (paths is null)
{
    Console.WriteLine("No se encontró BarnaStats/out.");
    return;
}

var matchReportService = new OpenAiMatchReportService(paths.MatchReportsDir);
var service = new MatchAnalysisService(matchReportService);
var result = await service.ProcessAsync(paths.RawDataRootDir);

await AnalysisJsonWriter.WriteAsync(paths, result);

Console.WriteLine();
Console.WriteLine("Hecho.");
Console.WriteLine($"Índice análisis:   {Path.GetFullPath(paths.AnalysisJson)}");
Console.WriteLine($"Competición:       {Path.GetFullPath(paths.CompetitionJson)}");
Console.WriteLine($"Equipos:           {Path.GetFullPath(paths.TeamDetailsDir)}");
Console.WriteLine($"Temporadas:        {Path.GetFullPath(paths.AnalysisSeasonIndexJson)}");
Console.WriteLine($"Índice web:        {Path.GetFullPath(paths.WebAnalysisJson)}");
Console.WriteLine($"Competición web:   {Path.GetFullPath(paths.WebCompetitionJson)}");
Console.WriteLine($"Equipos web:       {Path.GetFullPath(paths.WebTeamDetailsDir)}");
Console.WriteLine($"Temporadas web:    {Path.GetFullPath(paths.WebSeasonIndexJson)}");
Console.WriteLine($"Equipos analizados:{result.Teams.Count}");
Console.WriteLine($"Partidos analizados:{result.TotalMatches}");
