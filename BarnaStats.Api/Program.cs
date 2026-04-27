using BarnaStats.Api.Infrastructure;
using BarnaStats.Api.Models;
using BarnaStats.Api.Services;
using BarnaStats.Services;
using BarnaStats.Utilities;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.UseUrls("http://127.0.0.1:5071");

var repoPaths = RepoPaths.ResolveDefault();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy
            .SetIsOriginAllowed(origin =>
            {
                if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri))
                    return false;

                return uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase) ||
                       uri.Host.Equals("127.0.0.1", StringComparison.OrdinalIgnoreCase);
            })
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddSingleton(repoPaths);
builder.Services.AddSingleton(_ =>
{
    var paths = BarnaStatsPaths.CreateFromProjectDir(repoPaths.BarnaStatsProjectDir);
    paths.EnsureDirectories();
    return paths;
});
builder.Services.AddSingleton<PersistentBrowserMappingSyncRunner>(provider =>
{
    var paths = provider.GetRequiredService<BarnaStatsPaths>();
    return new PersistentBrowserMappingSyncRunner(paths.BrowserProfileDir);
});
builder.Services.AddSingleton<MappingSynchronizationCoordinator>(provider =>
{
    var paths = provider.GetRequiredService<BarnaStatsPaths>();
    var runner = provider.GetRequiredService<PersistentBrowserMappingSyncRunner>();
    return new MappingSynchronizationCoordinator(paths, runner);
});
builder.Services.AddSingleton<SyncOrchestrator>();
builder.Services.AddSingleton<ResultsSourceCatalogService>();
builder.Services.AddSingleton<MatchAiReportService>();
builder.Services.AddHttpClient<BasquetCatalaLookupService>(client =>
{
    client.BaseAddress = new Uri("https://www.basquetcatala.cat/");
    client.Timeout = TimeSpan.FromSeconds(20);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("BarnaStats/1.0");
});

var app = builder.Build();

app.UseCors();

app.Use(async (context, next) =>
{
    context.Response.Headers.CacheControl = "no-store";
    await next();
});

app.MapGet("/api/health", () => Results.Ok(new
{
    ok = true,
    repoRoot = repoPaths.RepoRoot
}));

app.MapGet("/api/matches/{matchWebId:int}/report", async (
    int matchWebId,
    int? focusTeamIdExtern,
    MatchAiReportService matchAiReportService) =>
{
    if (matchWebId <= 0)
    {
        return Results.BadRequest(new
        {
            error = "El identificador del partido no es válido."
        });
    }

    var cachedReport = await matchAiReportService.GetCachedAsync(matchWebId, focusTeamIdExtern);
    return cachedReport is null
        ? Results.NoContent()
        : Results.Ok(cachedReport);
});

app.MapPost("/api/matches/{matchWebId:int}/report", async (
    int matchWebId,
    bool forceRefresh,
    int? focusTeamIdExtern,
    MatchAiReportService matchAiReportService) =>
{
    if (matchWebId <= 0)
    {
        return Results.BadRequest(new
        {
            error = "El identificador del partido no es válido."
        });
    }

    var result = await matchAiReportService.GenerateAsync(matchWebId, forceRefresh, focusTeamIdExtern);
    if (result.Succeeded)
        return Results.Ok(result.Report);

    return result.ErrorKind switch
    {
        MatchAiReportErrorKind.MatchDataNotFound => Results.NotFound(new { error = result.ErrorMessage }),
        MatchAiReportErrorKind.InvalidMatchData => Results.Problem(
            title: "No se pudo leer el partido.",
            detail: result.ErrorMessage,
            statusCode: StatusCodes.Status422UnprocessableEntity),
        MatchAiReportErrorKind.MissingApiKey => Results.Problem(
            title: "Gemini no está configurado.",
            detail: result.ErrorMessage,
            statusCode: StatusCodes.Status503ServiceUnavailable),
        MatchAiReportErrorKind.DailyQuotaReached => Results.Problem(
            title: "Gemini alcanzó el límite diario.",
            detail: result.ErrorMessage,
            statusCode: StatusCodes.Status429TooManyRequests),
        _ => Results.Problem(
            title: "No se pudo generar el análisis con Gemini.",
            detail: result.ErrorMessage,
            statusCode: StatusCodes.Status502BadGateway)
    };
});

app.MapGet("/api/sync-jobs/current", (SyncOrchestrator orchestrator) =>
{
    var currentJob = orchestrator.GetCurrentJob();
    return currentJob is null
        ? Results.NoContent()
        : Results.Ok(currentJob);
});

app.MapGet("/api/results-sources", async (ResultsSourceCatalogService catalogService) =>
{
    var sources = await catalogService.GetAllAsync();
    return Results.Ok(sources);
});

app.MapGet("/api/basquetcatala/categories", async (
    string gender,
    int territory,
    BasquetCatalaLookupService lookupService,
    CancellationToken cancellationToken) =>
{
    try
    {
        var options = await lookupService.GetCategoriesAsync(gender, territory, cancellationToken);
        return Results.Ok(options);
    }
    catch (HttpRequestException ex)
    {
        return Results.Problem(
            title: "No se pudieron cargar las categorías.",
            detail: ex.Message,
            statusCode: StatusCodes.Status502BadGateway
        );
    }
});

app.MapGet("/api/basquetcatala/phases", async (
    int categoryId,
    string gender,
    int territory,
    BasquetCatalaLookupService lookupService,
    CancellationToken cancellationToken) =>
{
    if (categoryId <= 0)
    {
        return Results.BadRequest(new
        {
            error = "Tienes que indicar una categoría válida."
        });
    }

    try
    {
        var options = await lookupService.GetPhasesAsync(categoryId, gender, territory, cancellationToken);
        return Results.Ok(options);
    }
    catch (HttpRequestException ex)
    {
        return Results.Problem(
            title: "No se pudieron cargar las fases.",
            detail: ex.Message,
            statusCode: StatusCodes.Status502BadGateway
        );
    }
});

app.MapPost("/api/basquetcatala/discover-batch", async (
    DiscoverBulkSourcesRequest request,
    BasquetCatalaLookupService lookupService,
    CancellationToken cancellationToken) =>
{
    if (request.Genders is null || request.Genders.Count == 0)
    {
        return Results.BadRequest(new
        {
            error = "Tienes que indicar al menos un género."
        });
    }

    if (request.Territories is null || request.Territories.Count == 0)
    {
        return Results.BadRequest(new
        {
            error = "Tienes que indicar al menos un territorio."
        });
    }

    try
    {
        var response = await lookupService.DiscoverBulkSourcesAsync(
            request.Genders,
            request.Territories,
            cancellationToken
        );
        return Results.Ok(response);
    }
    catch (HttpRequestException ex)
    {
        return Results.Problem(
            title: "No se pudo descubrir el alcance masivo.",
            detail: ex.Message,
            statusCode: StatusCodes.Status502BadGateway
        );
    }
});

app.MapDelete("/api/results-sources/{phaseId:int}", async (int phaseId, SyncOrchestrator orchestrator) =>
{
    if (phaseId <= 0)
    {
        return Results.BadRequest(new
        {
            error = "El identificador de fase no es válido."
        });
    }

    var result = await orchestrator.TryDeleteSavedSourceAsync(phaseId);

    if (!string.IsNullOrWhiteSpace(result.Error))
    {
        return result.Error.Contains("sincronización en marcha", StringComparison.OrdinalIgnoreCase) ||
               result.Error.Contains("mantenimiento en marcha", StringComparison.OrdinalIgnoreCase)
            ? Results.Conflict(new { error = result.Error })
            : Results.NotFound(new { error = result.Error });
    }

    return Results.Ok(result);
});

app.MapPost("/api/results-sources/sync-all", async (SyncOrchestrator orchestrator) =>
{
    var startResult = await orchestrator.TryStartSavedSourcesAsync();

    if (!startResult.Started)
    {
        return Results.Conflict(new
        {
            error = startResult.Error,
            currentJob = startResult.JobSnapshot
        });
    }

    return Results.Accepted("/api/sync-jobs/current", startResult.JobSnapshot);
});

app.MapPost("/api/sync-jobs", (StartSyncRequest request, SyncOrchestrator orchestrator) =>
{
    if (string.IsNullOrWhiteSpace(request.SourceUrl))
    {
        return Results.BadRequest(new
        {
            error = "Tienes que indicar la URL de resultados."
        });
    }

    var started = orchestrator.TryStart(request.SourceUrl, request.ForceRefresh, out var jobSnapshot, out var error);

    if (!started)
    {
        return Results.Conflict(new
        {
            error,
            currentJob = jobSnapshot
        });
    }

    return Results.Accepted($"/api/sync-jobs/current", jobSnapshot);
});

app.MapPost("/api/sync-jobs/batch", (StartSyncBatchRequest request, SyncOrchestrator orchestrator) =>
{
    if (request.Sources is null || request.Sources.Count == 0)
    {
        return Results.BadRequest(new
        {
            error = "Tienes que indicar al menos una fase para sincronizar."
        });
    }

    var started = orchestrator.TryStartBatch(request.Sources, request.ForceRefresh, request.Description, out var jobSnapshot, out var error);

    if (!started)
    {
        return Results.Conflict(new
        {
            error,
            currentJob = jobSnapshot
        });
    }

    return Results.Accepted("/api/sync-jobs/current", jobSnapshot);
});

app.Run();
