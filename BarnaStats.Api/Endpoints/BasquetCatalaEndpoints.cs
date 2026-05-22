using BarnaStats.Api.Models;
using BarnaStats.Api.Services;

namespace BarnaStats.Api.Endpoints;

internal static class BasquetCatalaEndpoints
{
    internal static IEndpointRouteBuilder MapBasquetCatalaEndpoints(this IEndpointRouteBuilder app)
    {
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

        return app;
    }
}
