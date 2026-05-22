using BarnaStats.Api.Models;
using BarnaStats.Api.Services;

namespace BarnaStats.Api.Endpoints;

internal static class SyncEndpoints
{
    internal static IEndpointRouteBuilder MapSyncEndpoints(this IEndpointRouteBuilder app)
    {
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

        return app;
    }
}
