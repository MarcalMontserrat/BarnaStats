using System.Text.Json;
using BarnaStats.Models;
using BarnaStats.Utilities;

namespace BarnaStats.Services;

public sealed class MatchSummaryBuilder
{
    public SummaryRow Build(MatchMapping mapping, string statsRaw, string movesRaw)
    {
        using var statsDoc = JsonDocument.Parse(statsRaw);
        using var movesDoc = JsonDocument.Parse(movesRaw);

        var summary = new SummaryRow
        {
            MatchWebId = mapping.MatchWebId,
            UuidMatch = mapping.UuidMatch!,
            Status = "OK"
        };

        var root = statsDoc.RootElement;

        summary.HomeTeam = JsonElementSearch.FindString(root, "nameLocalTeam")
                        ?? JsonElementSearch.FindString(root, "localTeamName")
                        ?? JsonElementSearch.FindString(root, "teamLocalName")
                        ?? "";

        summary.AwayTeam = JsonElementSearch.FindString(root, "nameVisitorTeam")
                        ?? JsonElementSearch.FindString(root, "visitorTeamName")
                        ?? JsonElementSearch.FindString(root, "teamVisitorName")
                        ?? "";

        summary.HomeScore = JsonElementSearch.FindInt(root, "scoreLocalTeam")
                         ?? JsonElementSearch.FindInt(root, "localScore")
                         ?? JsonElementSearch.FindInt(root, "scoreLocal")
                         ?? InferScoreFromMoves(movesDoc.RootElement, local: true)
                         ?? 0;

        summary.AwayScore = JsonElementSearch.FindInt(root, "scoreVisitorTeam")
                         ?? JsonElementSearch.FindInt(root, "visitorScore")
                         ?? JsonElementSearch.FindInt(root, "scoreVisitor")
                         ?? InferScoreFromMoves(movesDoc.RootElement, local: false)
                         ?? 0;

        summary.HasStats = true;
        summary.HasMoves = true;

        return summary;
    }

    private static int? InferScoreFromMoves(JsonElement root, bool local)
    {
        if (root.ValueKind != JsonValueKind.Array || root.GetArrayLength() == 0)
            return null;

        var lastScore = root.EnumerateArray()
            .Reverse()
            .Select(x => x.TryGetProperty("score", out var score) ? score.GetString() : null)
            .FirstOrDefault(x => !string.IsNullOrWhiteSpace(x));

        if (string.IsNullOrWhiteSpace(lastScore))
            return null;

        var parts = lastScore.Split('-', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != 2)
            return null;

        if (!int.TryParse(parts[0], out var home)) home = 0;
        if (!int.TryParse(parts[1], out var away)) away = 0;

        return local ? home : away;
    }
}
