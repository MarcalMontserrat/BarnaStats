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
            return "Partido sin equipos válidos.";

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

        prompt.AppendLine();
        prompt.AppendLine("PISTAS PARA INFERENCIAS");
        foreach (var line in BuildInferenceHints(match, localTeam, visitTeam, moves))
        {
            prompt.AppendLine($"- {line}");
        }

        prompt.AppendLine();
        prompt.AppendLine("LIMITES DE INFERENCIA");
        prompt.AppendLine("- No hay datos directos de rebotes, asistencias, perdidas ni defensa.");
        prompt.AppendLine("- Si una lectura no se sostiene con los datos, es mejor decir que no se puede confirmar.");

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

    private static IEnumerable<string> BuildInferenceHints(
        StatsRoot match,
        TeamInfo localTeam,
        TeamInfo visitTeam,
        IReadOnlyList<MoveEvent> moves)
    {
        var localScore = localTeam.Data?.Score ?? 0;
        var visitScore = visitTeam.Data?.Score ?? 0;
        var diff = localScore - visitScore;
        var winnerTeam = diff > 0 ? localTeam : diff < 0 ? visitTeam : null;
        var loserTeam = diff > 0 ? visitTeam : diff < 0 ? localTeam : null;

        var scoreFlow = AnalyzeScoreFlow(match, isHomePerspective: true);
        if (scoreFlow is not null)
        {
            if (scoreFlow.LeadChanges == 0)
            {
                yield return $"Guion estable: no hubo cambios de liderato y la maxima ventaja local fue +{scoreFlow.MaxLead}, la visitante +{scoreFlow.MaxDeficit}.";
            }
            else
            {
                yield return $"Partido con alternancias: hubo {scoreFlow.LeadChanges} cambios de liderato y {scoreFlow.Ties} empates.";
            }
        }

        if (winnerTeam is not null && loserTeam is not null)
        {
            var winnerIsHome = ReferenceEquals(winnerTeam, localTeam);
            var winnerFlow = AnalyzeScoreFlow(match, winnerIsHome);

            if (winnerFlow is not null)
            {
                yield return $"{winnerTeam.Name} gano por {Math.Abs(diff)} puntos, con una mejor racha de {winnerFlow.BestRun}-0 y cierre {winnerFlow.ClosingRun}-{winnerFlow.RivalClosingRun}.";
            }

            var winnerBestPeriod = BuildBestPeriodHint(match, winnerTeam, winnerIsHome);
            if (!string.IsNullOrWhiteSpace(winnerBestPeriod))
                yield return winnerBestPeriod;
        }

        yield return BuildScoringDistributionHint(localTeam, "local");
        yield return BuildScoringDistributionHint(visitTeam, "visitante");
        yield return BuildShootingProfileHint(localTeam, visitTeam);

        var firstScoringMove = moves.FirstOrDefault(IsScoringMove);
        var lastScoringMove = moves.LastOrDefault(IsScoringMove);
        if (firstScoringMove is not null || lastScoringMove is not null)
        {
            var firstTeam = ResolveMoveTeamName(localTeam, visitTeam, firstScoringMove?.IdTeam);
            var lastTeam = ResolveMoveTeamName(localTeam, visitTeam, lastScoringMove?.IdTeam);
            yield return $"Primera canasta registrada: {firstScoringMove?.ActorName ?? "desconocida"} ({firstTeam}). Ultima canasta registrada: {lastScoringMove?.ActorName ?? "desconocida"} ({lastTeam}).";
        }
    }

    private static ScoreFlowSummary? AnalyzeScoreFlow(StatsRoot match, bool isHomePerspective)
    {
        if (match.Score.Count == 0)
            return null;

        var leadChanges = 0;
        var ties = 0;
        var maxLead = 0;
        var maxDeficit = 0;
        var bestRun = 0;
        var rivalBestRun = 0;
        var currentRun = 0;
        var rivalCurrentRun = 0;
        var previousDiff = 0;
        var previousLocal = 0;
        var previousVisit = 0;

        foreach (var point in match.Score
                     .OrderBy(point => point.MinuteAbsolute)
                     .ThenBy(point => point.MinuteQuarter)
                     .ThenBy(point => point.Period))
        {
            var deltaLocal = point.Local - previousLocal;
            var deltaVisit = point.Visit - previousVisit;
            var teamDelta = isHomePerspective ? deltaLocal : deltaVisit;
            var rivalDelta = isHomePerspective ? deltaVisit : deltaLocal;
            var teamDiff = isHomePerspective
                ? point.Local - point.Visit
                : point.Visit - point.Local;

            maxLead = Math.Max(maxLead, teamDiff);
            maxDeficit = Math.Max(maxDeficit, -teamDiff);

            var previousSign = Math.Sign(previousDiff);
            var currentSign = Math.Sign(teamDiff);

            if (currentSign == 0 && previousSign != 0)
            {
                ties += 1;
            }
            else if (previousSign != 0 && currentSign != 0 && previousSign != currentSign)
            {
                leadChanges += 1;
            }

            if (teamDelta > 0)
            {
                currentRun += teamDelta;
                rivalCurrentRun = 0;
                bestRun = Math.Max(bestRun, currentRun);
            }

            if (rivalDelta > 0)
            {
                rivalCurrentRun += rivalDelta;
                currentRun = 0;
                rivalBestRun = Math.Max(rivalBestRun, rivalCurrentRun);
            }

            previousDiff = teamDiff;
            previousLocal = point.Local;
            previousVisit = point.Visit;
        }

        return new ScoreFlowSummary(leadChanges, ties, maxLead, maxDeficit, bestRun, rivalBestRun, currentRun, rivalCurrentRun);
    }

    private static string BuildBestPeriodHint(StatsRoot match, TeamInfo team, bool isHomePerspective)
    {
        if (match.Score.Count == 0)
            return "";

        var periodDiffs = new List<(int Period, int TeamPoints, int RivalPoints, int Diff)>();
        var previousLocal = 0;
        var previousVisit = 0;

        foreach (var group in match.Score
                     .GroupBy(point => point.Period)
                     .OrderBy(group => group.Key))
        {
            var lastPoint = group
                .OrderBy(point => point.MinuteAbsolute)
                .ThenBy(point => point.MinuteQuarter)
                .Last();

            var localPoints = lastPoint.Local - previousLocal;
            var visitPoints = lastPoint.Visit - previousVisit;
            var teamPoints = isHomePerspective ? localPoints : visitPoints;
            var rivalPoints = isHomePerspective ? visitPoints : localPoints;

            periodDiffs.Add((group.Key, teamPoints, rivalPoints, teamPoints - rivalPoints));
            previousLocal = lastPoint.Local;
            previousVisit = lastPoint.Visit;
        }

        var bestPeriod = periodDiffs
            .OrderByDescending(period => period.Diff)
            .ThenBy(period => period.Period)
            .FirstOrDefault();

        if (bestPeriod == default)
            return "";

        return $"Mejor parcial de {team.Name}: periodo {bestPeriod.Period}, {bestPeriod.TeamPoints}-{bestPeriod.RivalPoints} (diferencial {bestPeriod.Diff:+#;-#;0}).";
    }

    private static string BuildScoringDistributionHint(TeamInfo team, string label)
    {
        var players = (team.Players ?? [])
            .Select(player => new
            {
                Name = player.Name ?? "",
                Points = player.Data?.Score ?? 0
            })
            .Where(player => player.Points > 0)
            .OrderByDescending(player => player.Points)
            .ToList();

        if (players.Count == 0)
            return $"Reparto anotador {label}: ningun punto registrado para {team.Name}.";

        var totalPoints = players.Sum(player => player.Points);
        var topScorer = players[0];
        var topThreePoints = players.Take(3).Sum(player => player.Points);
        var topScorerShare = totalPoints > 0
            ? (double)topScorer.Points / totalPoints * 100
            : 0;
        var topThreeShare = totalPoints > 0
            ? (double)topThreePoints / totalPoints * 100
            : 0;

        return $"Reparto anotador {label}: {players.Count} jugadoras sumaron puntos; {topScorer.Name} lidero con {topScorer.Points} ({topScorerShare:0.#}% del total) y el top 3 concentro {topThreeShare:0.#}%.";
    }

    private static string BuildShootingProfileHint(TeamInfo localTeam, TeamInfo visitTeam)
    {
        var local = AggregateShooting(localTeam);
        var visit = AggregateShooting(visitTeam);

        return $"Perfil de tiro: local T2 {local.TwoMade}/{local.TwoAttempted}, T3 {local.ThreeMade}/{local.ThreeAttempted}, TL {local.FtMade}/{local.FtAttempted}; visitante T2 {visit.TwoMade}/{visit.TwoAttempted}, T3 {visit.ThreeMade}/{visit.ThreeAttempted}, TL {visit.FtMade}/{visit.FtAttempted}.";
    }

    private static ShootingTotals AggregateShooting(TeamInfo team)
    {
        var totals = new ShootingTotals();

        foreach (var player in team.Players ?? [])
        {
            var data = player.Data;
            if (data is null)
                continue;

            totals.TwoMade += data.ShotsOfTwoSuccessful;
            totals.TwoAttempted += data.ShotsOfTwoAttempted;
            totals.ThreeMade += data.ShotsOfThreeSuccessful;
            totals.ThreeAttempted += data.ShotsOfThreeAttempted;
            totals.FtMade += data.ShotsOfOneSuccessful;
            totals.FtAttempted += data.ShotsOfOneAttempted;
        }

        return totals;
    }

    private static string ResolveMoveTeamName(TeamInfo localTeam, TeamInfo visitTeam, int? teamId)
    {
        if (!teamId.HasValue)
            return "desconocido";

        if (teamId.Value == localTeam.TeamIdIntern)
            return localTeam.Name ?? "Local";

        if (teamId.Value == visitTeam.TeamIdIntern)
            return visitTeam.Name ?? "Visitante";

        return "desconocido";
    }

    private static bool IsScoringMove(MoveEvent move)
    {
        return move.IdTeam > 0
               && !string.IsNullOrWhiteSpace(move.ActorName)
               && !string.IsNullOrWhiteSpace(move.Move)
               && move.Move.StartsWith("Cistella de ", StringComparison.OrdinalIgnoreCase);
    }

    private sealed record ScoreFlowSummary(
        int LeadChanges,
        int Ties,
        int MaxLead,
        int MaxDeficit,
        int BestRun,
        int RivalBestRun,
        int ClosingRun,
        int RivalClosingRun);

    private sealed class ShootingTotals
    {
        public int TwoMade { get; set; }
        public int TwoAttempted { get; set; }
        public int ThreeMade { get; set; }
        public int ThreeAttempted { get; set; }
        public int FtMade { get; set; }
        public int FtAttempted { get; set; }
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
