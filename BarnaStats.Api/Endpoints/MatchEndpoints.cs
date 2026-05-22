using BarnaStats.Api.Models;
using BarnaStats.Api.Services;

namespace BarnaStats.Api.Endpoints;

internal static class MatchEndpoints
{
    internal static IEndpointRouteBuilder MapMatchEndpoints(this IEndpointRouteBuilder app)
    {
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

        return app;
    }
}
