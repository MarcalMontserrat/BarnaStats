using BarnaStats.Api.Infrastructure;
using BarnaStats.Api.Models;
using BarnaStats.Api.Services;

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
builder.Services.AddSingleton<SyncOrchestrator>();

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

app.MapGet("/api/sync-jobs/current", (SyncOrchestrator orchestrator) =>
{
    var currentJob = orchestrator.GetCurrentJob();
    return currentJob is null
        ? Results.NoContent()
        : Results.Ok(currentJob);
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

    var started = orchestrator.TryStart(request.SourceUrl, out var jobSnapshot, out var error);

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

app.Run();
