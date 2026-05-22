using BarnaStats.Api.Infrastructure;

namespace BarnaStats.Api.Endpoints;

internal static class HealthEndpoints
{
    internal static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/health", (RepoPaths repoPaths) => Results.Ok(new
        {
            ok = true,
            repoRoot = repoPaths.RepoRoot
        }));

        return app;
    }
}
