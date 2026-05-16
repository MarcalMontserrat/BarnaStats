import {useMemo} from "react";
import TeamBadge from "./TeamBadge.jsx";
import MatchDetailContent from "./MatchDetailContent.jsx";
import MatchReportPanel from "./MatchReportPanel.jsx";
import {useAnalysisData} from "../hooks/useAnalysisData.js";

const EMPTY_LIST = [];

const styles = {
    shell: {
        display: "grid",
        gap: 16,
        minWidth: 0
    },
    grid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
        gap: 16,
        minWidth: 0
    },
    card: {
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1fr)",
        columnGap: 12,
        rowGap: 14,
        alignContent: "start",
        padding: 16,
        borderRadius: "var(--radius-lg)",
        background: "linear-gradient(180deg, rgba(255, 255, 255, 0.88) 0%, rgba(248, 242, 233, 0.94) 100%)",
        border: "1px solid rgba(107, 86, 58, 0.12)",
        minWidth: 0
    },
    badgeButton: {
        gridColumn: 1,
        alignSelf: "start",
        padding: 0,
        border: "none",
        background: "transparent",
        cursor: "pointer",
        minWidth: 0
    },
    headerButton: {
        display: "grid",
        gap: 8,
        gridColumn: 2,
        alignSelf: "start",
        padding: 0,
        border: "none",
        background: "transparent",
        textAlign: "left",
        cursor: "pointer",
        minWidth: 0
    },
    badgeWrap: {
        gridColumn: 1,
        alignSelf: "start",
        paddingTop: 2
    },
    headerStatic: {
        display: "grid",
        gap: 8,
        gridColumn: 2,
        alignSelf: "start",
        minWidth: 0
    },
    titleBlock: {
        display: "grid",
        gap: 8,
        minWidth: 0
    },
    contentWrap: {
        gridColumn: 2,
        minWidth: 0
    },
    metaRow: {
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 8,
        minWidth: 0
    },
    eyebrow: {
        display: "inline-flex",
        alignItems: "center",
        minHeight: 24,
        padding: "0 10px",
        borderRadius: 999,
        background: "rgba(188, 63, 43, 0.1)",
        color: "var(--accent-strong)",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase"
    },
    teamName: {
        fontSize: 16,
        fontWeight: 800,
        color: "var(--navy)",
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
    },
    subtitle: {
        color: "var(--muted)",
        fontSize: 13,
        lineHeight: 1.45
    },
    stateCard: {
        gridColumn: "1 / -1",
        padding: 18,
        borderRadius: "var(--radius-lg)",
        background: "rgba(255, 251, 245, 0.82)",
        border: "1px dashed rgba(107, 86, 58, 0.22)",
        color: "var(--muted)",
        lineHeight: 1.55
    }
};

function formatResultLabel(result) {
    switch (String(result ?? "").toUpperCase()) {
    case "W":
        return "Victoria";
    case "L":
        return "Derrota";
    case "T":
        return "Empate";
    default:
        return "";
    }
}

function areSharedSummariesEquivalent(firstSummary, secondSummary) {
    if (!firstSummary || !secondSummary) {
        return false;
    }

    return String(firstSummary.matchReport ?? "") === String(secondSummary.matchReport ?? "")
        && String(firstSummary.matchReportGeneratedAtUtc ?? "") === String(secondSummary.matchReportGeneratedAtUtc ?? "")
        && String(firstSummary.matchReportModel ?? "") === String(secondSummary.matchReportModel ?? "");
}

function CompetitionMatchTeamDetail({
    match,
    team,
    sideLabel,
    analysisVersion,
    onTeamNavigate,
    onPlayerNavigate
}) {
    const matchesUrl = team?.matchesFile ? `data/${team.matchesFile}?v=${analysisVersion}` : null;
    const playersUrl = team?.playersFile ? `data/${team.playersFile}?v=${analysisVersion}` : null;
    const {
        analysis: teamMatches,
        loading: teamMatchesLoading,
        error: teamMatchesError
    } = useAnalysisData(matchesUrl);
    const {
        analysis: teamPlayers,
        loading: teamPlayersLoading,
        error: teamPlayersError
    } = useAnalysisData(playersUrl);

    const matchSummary = useMemo(
        () => (Array.isArray(teamMatches)
            ? teamMatches.find((summary) => Number(summary.matchWebId) === Number(match.matchWebId)) ?? null
            : null),
        [match.matchWebId, teamMatches]
    );
    const players = useMemo(
        () => (Array.isArray(teamPlayers)
            ? teamPlayers.filter((player) => Number(player.matchWebId) === Number(match.matchWebId))
            : EMPTY_LIST),
        [match.matchWebId, teamPlayers]
    );

    if (!team?.matchesFile || !team?.playersFile) {
        return (
            <div style={styles.card}>
                <div style={styles.stateCard}>
                    No se ha encontrado el detalle del equipo para este partido.
                </div>
            </div>
        );
    }

    if (teamMatchesLoading || teamPlayersLoading) {
        return (
            <div style={styles.card}>
                <div style={styles.stateCard}>
                    Cargando detalle de {team.teamName}...
                </div>
            </div>
        );
    }

    if (teamMatchesError || teamPlayersError) {
        return (
            <div style={styles.card}>
                <div style={styles.stateCard}>
                    No se ha podido cargar el detalle de {team.teamName}.
                </div>
            </div>
        );
    }

    const titleContent = (
        <div style={styles.titleBlock}>
            <div style={styles.metaRow}>
                <div style={styles.eyebrow}>{sideLabel}</div>
                <div style={styles.subtitle}>
                    {formatResultLabel(matchSummary?.result)
                        ? `Perspectiva: ${formatResultLabel(matchSummary.result)}`
                        : "Detalle partido a partido del equipo"}
                </div>
            </div>
            <div style={styles.teamName} title={team.teamName}>{team.teamName}</div>
        </div>
    );

    return (
        <div style={styles.card}>
            {team.teamKey && onTeamNavigate ? (
                <>
                    <button
                        type="button"
                        style={styles.badgeButton}
                        onClick={() => onTeamNavigate(team.teamKey)}
                        title={`Abrir ficha de ${team.teamName}`}
                        aria-label={`Abrir ficha de ${team.teamName}`}
                    >
                        <TeamBadge
                            size="md"
                            teamIdExtern={team.teamIdExtern}
                            teamName={team.teamName}
                        />
                    </button>
                    <button
                        type="button"
                        style={styles.headerButton}
                        onClick={() => onTeamNavigate(team.teamKey)}
                        title={`Abrir ficha de ${team.teamName}`}
                        aria-label={`Abrir ficha de ${team.teamName}`}
                    >
                        {titleContent}
                    </button>
                </>
            ) : (
                <>
                    <div style={styles.badgeWrap}>
                        <TeamBadge
                            size="md"
                            teamIdExtern={team.teamIdExtern}
                            teamName={team.teamName}
                        />
                    </div>
                    <div style={styles.headerStatic}>
                        {titleContent}
                    </div>
                </>
            )}

            <div style={styles.contentWrap}>
                <MatchDetailContent
                    matchWebId={match.matchWebId}
                    players={players}
                    insights={matchSummary?.insights ?? null}
                    matchReport={matchSummary?.matchReport ?? ""}
                    matchReportGeneratedAtUtc={matchSummary?.matchReportGeneratedAtUtc ?? null}
                    matchReportModel={matchSummary?.matchReportModel ?? ""}
                    onPlayerNavigate={onPlayerNavigate}
                    showMatchReport={false}
                    tableWithTopMargin={false}
                    emptyMessage={`No hay detalle disponible para ${team.teamName} en este partido.`}
                />
            </div>
        </div>
    );
}

function CompetitionMatchDetail({
    match,
    teamDetailsByKey,
    analysisVersion,
    onTeamNavigate,
    onPlayerNavigate,
    enableMatchReportOnDemand = true,
    matchReportApiAvailable = true
}) {
    const homeTeam = teamDetailsByKey.get(match.homeTeamKey) ?? {
        teamKey: match.homeTeamKey,
        teamIdExtern: Number(match.homeTeamIdExtern ?? 0),
        teamName: match.homeTeam,
        matchesFile: "",
        playersFile: ""
    };
    const awayTeam = teamDetailsByKey.get(match.awayTeamKey) ?? {
        teamKey: match.awayTeamKey,
        teamIdExtern: Number(match.awayTeamIdExtern ?? 0),
        teamName: match.awayTeam,
        matchesFile: "",
        playersFile: ""
    };
    const homeSharedReportMatchesUrl = homeTeam.matchesFile
        ? `data/${homeTeam.matchesFile}?v=${analysisVersion}`
        : null;
    const awaySharedReportMatchesUrl = awayTeam.matchesFile
        ? `data/${awayTeam.matchesFile}?v=${analysisVersion}`
        : null;
    const {
        analysis: homeSharedReportMatches
    } = useAnalysisData(homeSharedReportMatchesUrl);
    const {
        analysis: awaySharedReportMatches
    } = useAnalysisData(awaySharedReportMatchesUrl);
    const homeSharedReportSummary = useMemo(
        () => (Array.isArray(homeSharedReportMatches)
            ? homeSharedReportMatches.find((summary) => Number(summary.matchWebId) === Number(match.matchWebId)) ?? null
            : null),
        [homeSharedReportMatches, match.matchWebId]
    );
    const awaySharedReportSummary = useMemo(
        () => (Array.isArray(awaySharedReportMatches)
            ? awaySharedReportMatches.find((summary) => Number(summary.matchWebId) === Number(match.matchWebId)) ?? null
            : null),
        [awaySharedReportMatches, match.matchWebId]
    );
    const sharedReportSummary = useMemo(() => {
        if (areSharedSummariesEquivalent(homeSharedReportSummary, awaySharedReportSummary)) {
            return homeSharedReportSummary;
        }

        return null;
    }, [awaySharedReportSummary, homeSharedReportSummary]);
    const sharedMatchReport = sharedReportSummary?.matchReport ?? "";
    const sharedMatchReportGeneratedAtUtc = sharedReportSummary?.matchReportGeneratedAtUtc ?? null;
    const sharedMatchReportModel = sharedReportSummary?.matchReportModel ?? "";
    const showSharedReport = enableMatchReportOnDemand || !!sharedMatchReport;

    return (
        <div style={styles.shell}>
            <div style={styles.grid}>
                <CompetitionMatchTeamDetail
                    match={match}
                    team={homeTeam}
                    sideLabel="Local"
                    analysisVersion={analysisVersion}
                    onTeamNavigate={onTeamNavigate}
                    onPlayerNavigate={onPlayerNavigate
                        ? (playerIdentityKey) => onPlayerNavigate(homeTeam.teamKey, playerIdentityKey)
                        : undefined}
                />
                <CompetitionMatchTeamDetail
                    match={match}
                    team={awayTeam}
                    sideLabel="Visitante"
                    analysisVersion={analysisVersion}
                    onTeamNavigate={onTeamNavigate}
                    onPlayerNavigate={onPlayerNavigate
                        ? (playerIdentityKey) => onPlayerNavigate(awayTeam.teamKey, playerIdentityKey)
                        : undefined}
                />
            </div>
            {showSharedReport ? (
                <MatchReportPanel
                    matchWebId={match.matchWebId}
                    matchReport={sharedMatchReport}
                    matchReportGeneratedAtUtc={sharedMatchReportGeneratedAtUtc}
                    matchReportModel={sharedMatchReportModel}
                    subtitle="Lectura compartida del partido para local y visitante. Si ya existe, se recupera desde la caché; si no, puedes generarla aquí."
                    enableOnDemand={enableMatchReportOnDemand}
                    apiAvailable={matchReportApiAvailable}
                    withTopMargin={false}
                />
            ) : null}
        </div>
    );
}

export default CompetitionMatchDetail;
