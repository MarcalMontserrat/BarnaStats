using System.Text;
using System.Text.Json;
using GenerateAnalisys.Models;

namespace GenerateAnalisys.Services;

internal static class MatchReportPromptBuilder
{
    public static string Build(StatsRoot match, string? movesRaw)
    {
        var localTeam = match.Teams.FirstOrDefault(team => team.TeamIdIntern == match.LocalId)
                        ?? match.Teams.FirstOrDefault();
        var visitTeam = match.Teams.FirstOrDefault(team => team.TeamIdIntern == match.VisitId)
                        ?? match.Teams.Skip(1).FirstOrDefault();

        if (localTeam is null || visitTeam is null)
            return "Partido sin equipos validos.";

        var moves = TryDeserializeMoves(movesRaw);
        var prompt = new StringBuilder();

        prompt.AppendLine("RESUMEN TECNICO DEL PARTIDO");
        prompt.AppendLine($"Partido: {localTeam.Name} vs {visitTeam.Name}");
        prompt.AppendLine($"Fecha: {match.Time ?? "desconocida"}");
        prompt.AppendLine($"Marcador final: {localTeam.Data?.Score ?? 0}-{visitTeam.Data?.Score ?? 0}");
        prompt.AppendLine($"Puntos calculados por jugadoras: {SumPlayerPoints(localTeam)}-{SumPlayerPoints(visitTeam)}");
        prompt.AppendLine();

        prompt.AppendLine("PARCIALES POR PERIODO");
        foreach (var periodLine in BuildPeriodSummaries(match))
        {
            prompt.AppendLine($"- {periodLine}");
        }

        var leadSummary = BuildLeadSummary(match);
        if (!string.IsNullOrWhiteSpace(leadSummary))
        {
            prompt.AppendLine();
            prompt.AppendLine("DINAMICA DEL MARCADOR");
            prompt.AppendLine(leadSummary);
        }

        prompt.AppendLine();
        prompt.AppendLine("JUGADORAS DESTACADAS");
        foreach (var line in BuildTopPlayers(localTeam, "Local"))
            prompt.AppendLine($"- {line}");
        foreach (var line in BuildTopPlayers(visitTeam, "Visitante"))
            prompt.AppendLine($"- {line}");

        prompt.AppendLine();
        prompt.AppendLine("PLANTILLAS Y BOXSCORE");
        AppendTeamBoxScore(prompt, "Local", localTeam);
        AppendTeamBoxScore(prompt, "Visitante", visitTeam);

        if (moves.Count > 0)
        {
            prompt.AppendLine();
            prompt.AppendLine("EVENTOS RELEVANTES DEL PLAY-BY-PLAY");
            foreach (var line in BuildRelevantMoveLines(moves, localTeam, visitTeam))
                prompt.AppendLine($"- {line}");
        }

        return prompt.ToString();
    }

    private static void AppendTeamBoxScore(StringBuilder prompt, string side, TeamInfo team)
    {
        prompt.AppendLine($"{side}: {team.Name}");

        foreach (var player in (team.Players ?? [])
                     .OrderByDescending(player => player.Data?.Score ?? 0)
                     .ThenByDescending(player => player.Data?.Valoration ?? 0)
                     .ThenBy(player => player.Name, StringComparer.OrdinalIgnoreCase))
        {
            var data = player.Data ?? new StatBlock();
            prompt.AppendLine(
                $"  - {player.Name} #{player.Dorsal}: {data.Score} pts, {data.Valoration} val, {player.TimePlayed} min, T1 {data.ShotsOfOneSuccessful}/{data.ShotsOfOneAttempted}, T2 {data.ShotsOfTwoSuccessful}/{data.ShotsOfTwoAttempted}, T3 {data.ShotsOfThreeSuccessful}/{data.ShotsOfThreeAttempted}, faltas {data.Faults}");
        }
    }

    private static IEnumerable<string> BuildPeriodSummaries(StatsRoot match)
    {
        if (match.Score.Count == 0)
            yield break;

        var localRunning = 0;
        var visitRunning = 0;

        foreach (var group in match.Score
                     .GroupBy(point => point.Period)
                     .OrderBy(group => group.Key))
        {
            var finalPoint = group
                .OrderBy(point => point.MinuteAbsolute)
                .ThenBy(point => point.MinuteQuarter)
                .Last();

            var localPeriod = finalPoint.Local - localRunning;
            var visitPeriod = finalPoint.Visit - visitRunning;

            yield return $"Periodo {group.Key}: {localPeriod}-{visitPeriod} (acumulado {finalPoint.Local}-{finalPoint.Visit})";

            localRunning = finalPoint.Local;
            visitRunning = finalPoint.Visit;
        }
    }

    private static string BuildLeadSummary(StatsRoot match)
    {
        if (match.Score.Count == 0)
            return "";

        var leadChanges = 0;
        var previousLeader = 0;
        var maxLocalLead = 0;
        var maxVisitLead = 0;

        foreach (var point in match.Score.OrderBy(point => point.MinuteAbsolute).ThenBy(point => point.Period))
        {
            var diff = point.Local - point.Visit;

            if (diff > maxLocalLead)
                maxLocalLead = diff;

            if (-diff > maxVisitLead)
                maxVisitLead = -diff;

            var leader = diff == 0 ? 0 : diff > 0 ? 1 : -1;
            if (leader != 0 && previousLeader != 0 && leader != previousLeader)
                leadChanges += 1;

            if (leader != 0)
                previousLeader = leader;
        }

        return $"Cambios de liderato: {leadChanges}. Maxima ventaja local: +{maxLocalLead}. Maxima ventaja visitante: +{maxVisitLead}.";
    }

    private static IEnumerable<string> BuildTopPlayers(TeamInfo team, string side)
    {
        return (team.Players ?? [])
            .OrderByDescending(player => player.Data?.Score ?? 0)
            .ThenByDescending(player => player.Data?.Valoration ?? 0)
            .Take(3)
            .Select(player =>
            {
                var data = player.Data ?? new StatBlock();
                return $"{side} {team.Name}: {player.Name} con {data.Score} pts, {data.Valoration} val y {player.TimePlayed} min";
            });
    }

    private static List<string> BuildRelevantMoveLines(
        IReadOnlyList<MoveEvent> moves,
        TeamInfo localTeam,
        TeamInfo visitTeam)
    {
        return moves
            .Where(move => IsRelevantMove(move.Move))
            .OrderBy(move => move.Period)
            .ThenByDescending(move => move.Min)
            .ThenByDescending(move => move.Sec)
            .Take(80)
            .Select(move =>
            {
                var teamName = move.IdTeam == localTeam.TeamIdIntern
                    ? localTeam.Name
                    : move.IdTeam == visitTeam.TeamIdIntern
                        ? visitTeam.Name
                        : "Equipo";

                return $"P{move.Period} {move.Min}:{move.Sec:00} · {teamName} · {move.ActorName} · {move.Move} · {move.Score}";
            })
            .ToList();
    }

    private static bool IsRelevantMove(string? moveName)
    {
        if (string.IsNullOrWhiteSpace(moveName))
            return false;

        return moveName.StartsWith("Cistella de", StringComparison.OrdinalIgnoreCase) ||
               moveName.StartsWith("Temps mort", StringComparison.OrdinalIgnoreCase) ||
               moveName.StartsWith("Final de període", StringComparison.OrdinalIgnoreCase) ||
               moveName.StartsWith("Final de per", StringComparison.OrdinalIgnoreCase);
    }

    private static int SumPlayerPoints(TeamInfo team)
    {
        return (team.Players ?? []).Sum(player => player.Data?.Score ?? 0);
    }

    private static List<MoveEvent> TryDeserializeMoves(string? movesRaw)
    {
        if (string.IsNullOrWhiteSpace(movesRaw))
            return [];

        try
        {
            return JsonSerializer.Deserialize<List<MoveEvent>>(movesRaw) ?? [];
        }
        catch
        {
            return [];
        }
    }
}
