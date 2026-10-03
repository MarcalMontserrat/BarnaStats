using BarnaStats.Api.Services;

namespace BarnaStats.Api.Endpoints;

internal static class AppAccountEndpoints
{
    internal static IEndpointRouteBuilder MapAppAccountEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/app-account/status", (AppAccountStatusService statusService) => Results.Ok(statusService.GetStatus()));

        return app;
    }
}
