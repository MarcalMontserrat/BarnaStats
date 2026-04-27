using System.Text;
using System.Text.Json;
using GenerateAnalisys.Models;

namespace GenerateAnalisys.Services;

internal static class MatchReportPromptBuilder
{
    public static string Build(StatsRoot match, string statsRaw, string? movesRaw, int? focusTeamIdExtern = null)
    {
        var localTeam = match.Teams.FirstOrDefault(team => team.TeamIdIntern == match.LocalId)
                        ?? match.Teams.FirstOrDefault();
        var visitTeam = match.Teams.FirstOrDefault(team => team.TeamIdIntern == match.VisitId)
                        ?? match.Teams.Skip(1).FirstOrDefault();

        if (localTeam is null || visitTeam is null)
            return "Partido sin equipos válidos.";

        var moves = TryDeserializeMoves(movesRaw);
        var totalMatchMinutes = ResolveTotalMatchMinutes(match);
        var localFinalDiff = (localTeam.Data?.Score ?? 0) - (visitTeam.Data?.Score ?? 0);
        var visitFinalDiff = -localFinalDiff;
        var focusTeam = focusTeamIdExtern is > 0
            ? match.Teams.FirstOrDefault(team => team.TeamIdExtern == focusTeamIdExtern.Value)
            : null;
        var focusIsHome = focusTeam is not null && focusTeam.TeamIdIntern == match.LocalId;
        var rivalFocusTeam = focusTeam is null
            ? null
            : match.Teams.FirstOrDefault(team => team.TeamIdIntern != focusTeam.TeamIdIntern);
        var prompt = new StringBuilder();

        prompt.AppendLine("RESUMEN TECNICO DEL PARTIDO");
        prompt.AppendLine($"Partido: {localTeam.Name} vs {visitTeam.Name}");
        prompt.AppendLine($"Fecha: {match.Time ?? "desconocida"}");
        prompt.AppendLine($"Marcador final: {localTeam.Data?.Score ?? 0}-{visitTeam.Data?.Score ?? 0}");
        prompt.AppendLine($"Puntos calculados por jugadoras: {SumPlayerPoints(localTeam)}-{SumPlayerPoints(visitTeam)}");

        if (focusTeam is not null)
        {
            prompt.AppendLine();
            prompt.AppendLine("PERSPECTIVA SOLICITADA");
            prompt.AppendLine($"Enfoca el análisis en {focusTeam.Name}.");
            prompt.AppendLine($"Cuenta el partido desde su punto de vista y prioriza: que jugadoras impulsaron o frenaron su rendimiento, que quintetos le funcionaron mejor, como le afectaron los parciales y que señales explican su resultado.");
            if (rivalFocusTeam is not null)
            {
                prompt.AppendLine($"Usa a {rivalFocusTeam.Name} como contexto comparativo, pero el centro del análisis debe ser {focusTeam.Name}.");
            }
        }
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
        prompt.AppendLine("JUGADORAS DESTACADAS E IMPACTO");
        foreach (var line in BuildImpactPlayers(localTeam, "Local", localFinalDiff, totalMatchMinutes))
            prompt.AppendLine($"- {line}");
        foreach (var line in BuildImpactPlayers(visitTeam, "Visitante", visitFinalDiff, totalMatchMinutes))
            prompt.AppendLine($"- {line}");

        prompt.AppendLine();
        prompt.AppendLine("ROTACIONES, QUINTETOS Y ON/OFF");
        foreach (var line in BuildRotationSummaries(match, localTeam, "Local", isHome: true, totalMatchMinutes, localFinalDiff))
            prompt.AppendLine($"- {line}");
        foreach (var line in BuildRotationSummaries(match, visitTeam, "Visitante", isHome: false, totalMatchMinutes, visitFinalDiff))
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
        prompt.AppendLine("- Usa las pistas de impacto, quintetos y on/off como evidencia, no como una lista parafraseada.");
        prompt.AppendLine("- No conviertas las pistas en un inventario mecanico: sintetiza que jugadoras y combinaciones cambiaron el partido.");
        prompt.AppendLine("- No hay datos directos de rebotes, asistencias, perdidas ni defensa en el resumen base del boxscore usado aqui.");
        prompt.AppendLine("- Si una lectura no se sostiene con los datos, es mejor decir que no se puede confirmar.");

        if (focusTeam is not null)
        {
            var focusFinalDiff = focusIsHome ? localFinalDiff : visitFinalDiff;
            prompt.AppendLine($"- El texto final debe priorizar a {focusTeam.Name} y explicar su resultado ({FormatSigned(focusFinalDiff)} en el marcador).");
        }

        prompt.AppendLine();
        prompt.AppendLine("DATOS CRUDOS ADJUNTOS");
        prompt.AppendLine("JSON completo de stats (fuente de verdad adicional):");
        prompt.AppendLine(AppendJsonBlock(statsRaw));

        if (!string.IsNullOrWhiteSpace(movesRaw))
        {
            prompt.AppendLine();
            prompt.AppendLine("JSON completo de moves / play-by-play (fuente de verdad adicional):");
            prompt.AppendLine(AppendJsonBlock(movesRaw));
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

    private static IEnumerable<string> BuildImpactPlayers(
        TeamInfo team,
        string side,
        int teamFinalDiff,
        int totalMatchMinutes)
    {
        var impactSummaries = BuildPlayerImpactSummaries(team, teamFinalDiff, totalMatchMinutes);
        if (impactSummaries.Count == 0)
            yield break;

        var selected = new List<PlayerImpactSummary>();

        AddDistinct(selected, impactSummaries
            .OrderByDescending(player => player.Points)
            .ThenByDescending(player => player.Valoration)
            .ThenByDescending(player => player.PlusMinus)
            .FirstOrDefault(player => player.Points > 0));

        AddDistinct(selected, impactSummaries
            .OrderByDescending(player => player.Valoration)
            .ThenByDescending(player => player.Points)
            .ThenByDescending(player => player.PlusMinus)
            .FirstOrDefault(player => player.Valoration > 0));

        AddDistinct(selected, impactSummaries
            .OrderByDescending(player => player.PlusMinus)
            .ThenByDescending(player => player.OnOffContrast)
            .ThenByDescending(player => player.Valoration)
            .FirstOrDefault(player => player.PlusMinus != 0));

        AddDistinct(selected, impactSummaries
            .OrderByDescending(player => player.OnOffContrast)
            .ThenByDescending(player => player.PlusMinus)
            .ThenByDescending(player => player.Valoration)
            .FirstOrDefault(IsMeaningfulOnOff));

        foreach (var summary in impactSummaries
                     .OrderByDescending(CalculateImpactPriority))
        {
            AddDistinct(selected, summary);
            if (selected.Count >= 4)
                break;
        }

        foreach (var summary in selected.Take(4))
        {
            yield return FormatImpactPlayerLine(summary, side, team.Name ?? side);
        }
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

    private static string AppendJsonBlock(string rawJson)
    {
        if (string.IsNullOrWhiteSpace(rawJson))
            return "{}";

        try
        {
            using var document = JsonDocument.Parse(rawJson);
            return JsonSerializer.Serialize(document.RootElement, new JsonSerializerOptions
            {
                WriteIndented = true
            });
        }
        catch
        {
            return rawJson.Trim();
        }
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
        var totalMatchMinutes = ResolveTotalMatchMinutes(match);
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

        foreach (var line in BuildTeamImpactInferenceHints(match, localTeam, "local", isHome: true, totalMatchMinutes, teamFinalDiff: diff))
            yield return line;
        foreach (var line in BuildTeamImpactInferenceHints(match, visitTeam, "visitante", isHome: false, totalMatchMinutes, teamFinalDiff: -diff))
            yield return line;

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

    private static IEnumerable<string> BuildRotationSummaries(
        StatsRoot match,
        TeamInfo team,
        string side,
        bool isHome,
        int totalMatchMinutes,
        int teamFinalDiff)
    {
        var startingLineup = GetStartingLineup(team);
        if (startingLineup.Count == 5)
        {
            yield return $"{side} {team.Name}: quinteto inicial {JoinPlayerNames(startingLineup.Select(player => player.Name))}.";
        }

        var lineupSummaries = BuildLineupSummaries(match, team, isHome, totalMatchMinutes);
        var bestLineup = lineupSummaries
            .OrderByDescending(lineup => lineup.Diff)
            .ThenByDescending(lineup => lineup.Minutes)
            .FirstOrDefault();

        if (bestLineup is not null)
        {
            yield return
                $"{side} {team.Name}: quinteto con mejor diferencial {JoinPlayerNames(bestLineup.PlayerNames)} ({FormatSigned(bestLineup.Diff)} en {bestLineup.Minutes} min).";
        }

        var onOffCandidate = BuildPlayerImpactSummaries(team, teamFinalDiff, totalMatchMinutes)
            .OrderByDescending(player => player.OnOffContrast)
            .ThenByDescending(player => player.PlusMinus)
            .ThenByDescending(player => player.Valoration)
            .FirstOrDefault(IsMeaningfulOnOff);

        if (onOffCandidate is not null)
        {
            yield return
                $"{side} {team.Name}: mayor contraste on/off para {onOffCandidate.Name}, con ella {FormatSigned(onOffCandidate.OnDiff)} en {onOffCandidate.OnMinutes} min y sin ella {FormatSigned(onOffCandidate.OffDiff)} en {onOffCandidate.OffMinutes} min.";
        }
    }

    private static IEnumerable<string> BuildTeamImpactInferenceHints(
        StatsRoot match,
        TeamInfo team,
        string label,
        bool isHome,
        int totalMatchMinutes,
        int teamFinalDiff)
    {
        var impactSummaries = BuildPlayerImpactSummaries(team, teamFinalDiff, totalMatchMinutes);
        if (impactSummaries.Count == 0)
            yield break;

        var topScorerRanking = impactSummaries
            .OrderByDescending(player => player.Points)
            .ThenByDescending(player => player.Valoration)
            .Select(player => player.ActorId)
            .ToList();
        var topScorerIds = topScorerRanking
            .Take(2)
            .ToHashSet();
        var leadScorerId = topScorerRanking.FirstOrDefault();

        var impactComplement = impactSummaries
            .Where(player => !topScorerIds.Contains(player.ActorId))
            .OrderByDescending(player => player.OnOffContrast)
            .ThenByDescending(player => player.PlusMinus)
            .ThenByDescending(player => player.Valoration)
            .FirstOrDefault(player => player.PlusMinus != 0 || player.Valoration > 0)
            ?? impactSummaries
                .Where(player => player.ActorId != leadScorerId)
                .OrderByDescending(player => player.OnOffContrast)
                .ThenByDescending(player => player.PlusMinus)
                .ThenByDescending(player => player.Valoration)
                .FirstOrDefault(player => player.PlusMinus != 0 || player.Valoration > 0);

        if (impactComplement is not null)
        {
            var complementDetail = impactComplement.AllPositiveStints && impactComplement.StintSwings.Count >= 2
                ? $"todos sus turnos acabaron en positivo ({FormatSwingList(impactComplement.StintSwings)})"
                : $"con ella el parcial fue {FormatSigned(impactComplement.OnDiff)} en {impactComplement.OnMinutes} min y sin ella {FormatSigned(impactComplement.OffDiff)} en {impactComplement.OffMinutes} min";

            yield return
                $"Impacto complementario {label}: {impactComplement.Name} no fue la maxima anotadora, pero dejo {impactComplement.Points} pts, {impactComplement.Valoration} val y {FormatSigned(impactComplement.PlusMinus)} en pista; {complementDetail}.";
        }

        var bestLineup = BuildLineupSummaries(match, team, isHome, totalMatchMinutes)
            .OrderByDescending(lineup => lineup.Diff)
            .ThenByDescending(lineup => lineup.Minutes)
            .FirstOrDefault();

        if (bestLineup is not null)
        {
            yield return
                $"Quinteto mas determinante {label}: {JoinPlayerNames(bestLineup.PlayerNames)} firmo {FormatSigned(bestLineup.Diff)} en {bestLineup.Minutes} min.";
        }
    }

    private static List<PlayerImpactSummary> BuildPlayerImpactSummaries(
        TeamInfo team,
        int teamFinalDiff,
        int totalMatchMinutes)
    {
        return (team.Players ?? [])
            .Select(player => BuildPlayerImpactSummary(player, teamFinalDiff, totalMatchMinutes))
            .ToList();
    }

    private static PlayerImpactSummary BuildPlayerImpactSummary(
        PlayerInfo player,
        int teamFinalDiff,
        int totalMatchMinutes)
    {
        var stints = BuildPlayerStints(player, totalMatchMinutes);
        var stintSwings = stints.Select(stint => stint.EndDiff - stint.StartDiff).ToList();
        var onMinutes = Math.Max(0, player.TimePlayed);
        var offMinutes = Math.Max(0, totalMatchMinutes - onMinutes);
        var onDiff = player.InOut;
        var offDiff = teamFinalDiff - onDiff;
        var onRate = onMinutes > 0 ? (double)onDiff / onMinutes : 0;
        var offRate = offMinutes > 0 ? (double)offDiff / offMinutes : 0;

        return new PlayerImpactSummary(
            player.ActorId,
            player.Name ?? "Jugadora",
            player.Dorsal ?? "",
            player.Data?.Score ?? 0,
            player.Data?.Valoration ?? 0,
            player.InOut,
            onMinutes,
            offMinutes,
            onDiff,
            offDiff,
            onRate - offRate,
            player.Starting,
            stintSwings,
            stintSwings.Count > 0 && stintSwings.All(swing => swing >= 0));
    }

    private static List<PlayerStint> BuildPlayerStints(PlayerInfo player, int totalMatchMinutes)
    {
        var stints = new List<PlayerStint>();
        PlayerInOutMark? currentEntry = null;

        foreach (var mark in player.InOutsList
                     .OrderBy(item => item.MinuteAbsolut)
                     .ThenBy(item => item.Type, StringComparer.OrdinalIgnoreCase))
        {
            if (string.Equals(mark.Type, "IN_TYPE", StringComparison.OrdinalIgnoreCase))
            {
                currentEntry = mark;
                continue;
            }

            if (!string.Equals(mark.Type, "OUT_TYPE", StringComparison.OrdinalIgnoreCase) || currentEntry is null)
                continue;

            stints.Add(new PlayerStint(
                currentEntry.MinuteAbsolut,
                mark.MinuteAbsolut,
                currentEntry.PointDiff,
                mark.PointDiff));
            currentEntry = null;
        }

        if (currentEntry is not null)
        {
            stints.Add(new PlayerStint(
                currentEntry.MinuteAbsolut,
                totalMatchMinutes,
                currentEntry.PointDiff,
                currentEntry.PointDiff));
        }

        return stints;
    }

    private static List<LineupSummary> BuildLineupSummaries(
        StatsRoot match,
        TeamInfo team,
        bool isHome,
        int totalMatchMinutes)
    {
        var boundaries = team.Players
            .SelectMany(player => player.InOutsList ?? [])
            .Select(mark => mark.MinuteAbsolut)
            .Append(0)
            .Append(totalMatchMinutes)
            .Distinct()
            .OrderBy(minute => minute)
            .ToList();

        var aggregate = new Dictionary<string, LineupSummaryBuilder>(StringComparer.Ordinal);

        for (var index = 0; index < boundaries.Count - 1; index += 1)
        {
            var startMinute = boundaries[index];
            var endMinute = boundaries[index + 1];
            if (endMinute <= startMinute)
                continue;

            var activePlayers = team.Players
                .Where(player => IsPlayerActiveDuringInterval(player, startMinute, endMinute, totalMatchMinutes))
                .OrderBy(player => player.Name, StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (activePlayers.Count != 5)
                continue;

            var playerNames = activePlayers
                .Select(player => player.Name ?? "Jugadora")
                .ToList();
            var key = string.Join("|", activePlayers.Select(player => player.ActorId));
            var diff = GetTeamDiffAtMinute(match, isHome, endMinute) - GetTeamDiffAtMinute(match, isHome, startMinute);

            if (!aggregate.TryGetValue(key, out var summary))
            {
                summary = new LineupSummaryBuilder(playerNames);
                aggregate[key] = summary;
            }

            summary.Minutes += endMinute - startMinute;
            summary.Diff += diff;
            summary.Stints += 1;
        }

        return aggregate.Values
            .Select(item => new LineupSummary(item.PlayerNames, item.Minutes, item.Diff, item.Stints))
            .OrderByDescending(item => item.Diff)
            .ThenByDescending(item => item.Minutes)
            .ToList();
    }

    private static bool IsPlayerActiveDuringInterval(
        PlayerInfo player,
        int startMinute,
        int endMinute,
        int totalMatchMinutes)
    {
        foreach (var stint in BuildPlayerStints(player, totalMatchMinutes))
        {
            if (stint.StartMinute <= startMinute && stint.EndMinute >= endMinute)
                return true;
        }

        return false;
    }

    private static List<PlayerInfo> GetStartingLineup(TeamInfo team)
    {
        var starters = (team.Players ?? [])
            .Where(player => player.Starting ||
                             player.InOutsList.Any(mark =>
                                 string.Equals(mark.Type, "IN_TYPE", StringComparison.OrdinalIgnoreCase) &&
                                 mark.MinuteAbsolut == 0))
            .OrderBy(player => player.Name, StringComparer.OrdinalIgnoreCase)
            .Take(5)
            .ToList();

        return starters;
    }

    private static int GetTeamDiffAtMinute(StatsRoot match, bool isHome, int minuteAbsolute)
    {
        var scorePoint = match.Score
            .Where(point => point.MinuteAbsolute <= minuteAbsolute)
            .OrderBy(point => point.MinuteAbsolute)
            .ThenBy(point => point.MinuteQuarter)
            .ThenBy(point => point.Period)
            .LastOrDefault();

        if (scorePoint is null)
            return 0;

        return isHome
            ? scorePoint.Local - scorePoint.Visit
            : scorePoint.Visit - scorePoint.Local;
    }

    private static int ResolveTotalMatchMinutes(StatsRoot match)
    {
        var maxScoreMinute = match.Score.Count > 0
            ? match.Score.Max(point => point.MinuteAbsolute)
            : 0;
        var maxPeriod = match.Score.Count > 0
            ? match.Score.Max(point => point.Period)
            : match.Period;
        var estimatedByPeriods = maxPeriod > 0 && match.PeriodDuration > 0
            ? maxPeriod * match.PeriodDuration
            : 0;
        var maxInOutMinute = match.Teams
            .SelectMany(team => team.Players ?? [])
            .SelectMany(player => player.InOutsList ?? [])
            .Select(mark => mark.MinuteAbsolut)
            .DefaultIfEmpty(0)
            .Max();

        return Math.Max(Math.Max(maxScoreMinute, maxInOutMinute), estimatedByPeriods);
    }

    private static bool IsMeaningfulOnOff(PlayerImpactSummary summary)
    {
        return summary.OnMinutes >= 12 &&
               summary.OffMinutes >= 12 &&
               Math.Abs(summary.OnOffContrast) >= 0.2;
    }

    private static double CalculateImpactPriority(PlayerImpactSummary summary)
    {
        return summary.Points * 2.5 +
               summary.Valoration * 2.0 +
               summary.PlusMinus * 0.75 +
               summary.OnOffContrast * 12;
    }

    private static string FormatImpactPlayerLine(PlayerImpactSummary summary, string side, string teamName)
    {
        var reasons = new List<string>();

        if (summary.Points > 0)
            reasons.Add($"{summary.Points} pts");
        if (summary.Valoration > 0)
            reasons.Add($"{summary.Valoration} val");
        if (summary.PlusMinus != 0)
            reasons.Add($"+/- {FormatSigned(summary.PlusMinus)}");

        var detail = "";
        if (IsMeaningfulOnOff(summary))
        {
            detail =
                $"; con ella, parcial {FormatSigned(summary.OnDiff)} en {summary.OnMinutes} min y sin ella {FormatSigned(summary.OffDiff)} en {summary.OffMinutes} min";
        }
        else if (summary.AllPositiveStints && summary.StintSwings.Count >= 2)
        {
            detail = $"; todos sus turnos fueron positivos ({FormatSwingList(summary.StintSwings)})";
        }

        return $"{side} {teamName}: {summary.Name} con {string.Join(", ", reasons)}{detail}";
    }

    private static string JoinPlayerNames(IEnumerable<string?> playerNames)
    {
        return string.Join(", ", playerNames.Where(name => !string.IsNullOrWhiteSpace(name)).Select(name => name!.Trim()));
    }

    private static string FormatSwingList(IEnumerable<int> swings)
    {
        return string.Join(", ", swings.Take(4).Select(FormatSigned));
    }

    private static string FormatSigned(int value)
    {
        return value > 0 ? $"+{value}" : value.ToString();
    }

    private static void AddDistinct(List<PlayerImpactSummary> selected, PlayerImpactSummary? summary)
    {
        if (summary is null)
            return;

        if (selected.Any(item => item.ActorId == summary.ActorId))
            return;

        selected.Add(summary);
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

    private sealed record PlayerStint(
        int StartMinute,
        int EndMinute,
        int StartDiff,
        int EndDiff);

    private sealed record PlayerImpactSummary(
        long ActorId,
        string Name,
        string Dorsal,
        int Points,
        int Valoration,
        int PlusMinus,
        int OnMinutes,
        int OffMinutes,
        int OnDiff,
        int OffDiff,
        double OnOffContrast,
        bool Starting,
        IReadOnlyList<int> StintSwings,
        bool AllPositiveStints);

    private sealed record LineupSummary(
        IReadOnlyList<string> PlayerNames,
        int Minutes,
        int Diff,
        int Stints);

    private sealed class LineupSummaryBuilder
    {
        public LineupSummaryBuilder(IReadOnlyList<string> playerNames)
        {
            PlayerNames = playerNames;
        }

        public IReadOnlyList<string> PlayerNames { get; }
        public int Minutes { get; set; }
        public int Diff { get; set; }
        public int Stints { get; set; }
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
