import MatchDetailContent from "./MatchDetailContent.jsx";
import PrettySelect from "./PrettySelect.jsx";
import TeamBadge from "./TeamBadge.jsx";
import {buildCompetitionPhaseLabel} from "../utils/analysisDerived.js";

const styles = {
    section: {
        display: "grid",
        gap: 18,
        animation: "fade-up 1s ease both"
    },
    heading: {
        display: "grid",
        gap: 8
    },
    eyebrow: {
        color: "var(--accent)",
        fontSize: 12,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.12em"
    },
    title: {
        fontSize: "clamp(1.9rem, 2.6vw, 2.6rem)"
    },
    subtitle: {
        color: "var(--muted)",
        maxWidth: 720,
        lineHeight: 1.6
    },
    controls: {
        display: "flex",
        gap: 16,
        flexWrap: "wrap"
    },
    matchCard: {
        display: "grid",
        gap: 12,
        minWidth: 0,
        maxWidth: "100%"
    },
    matchHeader: {
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
        gap: 16,
        alignItems: "center",
        padding: "18px 18px",
        position: "relative",
        borderRadius: "var(--radius-lg)",
        background: "linear-gradient(135deg, rgba(255, 251, 245, 0.96) 0%, rgba(245, 235, 221, 0.92) 100%)",
        border: "1px solid rgba(107, 86, 58, 0.12)",
        boxShadow: "var(--shadow-md)",
        cursor: "pointer"
    },
    matchHeaderWin: {
        background: "linear-gradient(135deg, rgba(248, 252, 246, 0.98) 0%, rgba(235, 245, 234, 0.94) 100%)",
        border: "1px solid rgba(84, 130, 92, 0.22)",
        boxShadow: "inset 4px 0 0 rgba(84, 130, 92, 0.72), var(--shadow-md)"
    },
    matchHeaderLoss: {
        background: "linear-gradient(135deg, rgba(255, 250, 248, 0.98) 0%, rgba(246, 236, 232, 0.94) 100%)",
        border: "1px solid rgba(167, 90, 73, 0.2)",
        boxShadow: "inset 4px 0 0 rgba(167, 90, 73, 0.68), var(--shadow-md)"
    },
    matchHeaderTie: {
        background: "linear-gradient(135deg, rgba(255, 252, 247, 0.98) 0%, rgba(245, 239, 229, 0.94) 100%)",
        border: "1px solid rgba(172, 132, 59, 0.2)",
        boxShadow: "inset 4px 0 0 rgba(172, 132, 59, 0.7), var(--shadow-md)"
    },
    teamSide: {
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1fr)",
        gap: 12,
        alignItems: "center",
        minWidth: 0
    },
    teamSideAway: {
        gridTemplateColumns: "minmax(0, 1fr) auto"
    },
    teamText: {
        display: "grid",
        gap: 2,
        minWidth: 0
    },
    teamTextAway: {
        textAlign: "right",
        justifyItems: "end"
    },
    teamName: {
        fontFamily: "var(--font-display)",
        fontSize: "clamp(1.02rem, 1.7vw, 1.34rem)",
        lineHeight: 1.08,
        color: "var(--navy)",
        minWidth: 0,
        overflow: "hidden",
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical"
    },
    teamNameCurrent: {
        color: "var(--accent-strong)"
    },
    teamLogoAction: {
        padding: 0,
        border: "none",
        background: "transparent",
        cursor: "pointer",
        borderRadius: 18,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center"
    },
    teamLogoStatic: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center"
    },
    matchCenter: {
        display: "grid",
        gap: 8,
        justifyItems: "center",
        alignContent: "center",
        minWidth: 140,
        textAlign: "center"
    },
    matchCenterMeta: {
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center"
    },
    metaPill: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 30,
        padding: "0 10px",
        borderRadius: 999,
        background: "rgba(188, 63, 43, 0.1)",
        color: "var(--accent-strong)",
        fontWeight: 700,
        fontSize: 12
    },
    scoreLine: {
        display: "flex",
        alignItems: "baseline",
        justifyContent: "center",
        gap: 8,
        fontFamily: "var(--font-display)",
        color: "var(--navy)"
    },
    scoreValue: {
        fontSize: "clamp(1.8rem, 2.4vw, 2.3rem)",
        lineHeight: 1,
        letterSpacing: "-0.03em"
    },
    scoreDivider: {
        fontSize: "clamp(1rem, 1.5vw, 1.2rem)",
        lineHeight: 1,
        color: "rgba(26, 53, 87, 0.46)"
    },
    expandDock: {
        position: "absolute",
        left: 18,
        right: 18,
        bottom: 0,
        height: 18,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none"
    },
    expandIndicator: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: 999,
        border: "1px solid rgba(26, 53, 87, 0.14)",
        background: "rgba(255, 251, 245, 0.72)",
        boxShadow: "0 8px 18px rgba(22, 18, 15, 0.08)",
        color: "var(--navy)",
        transition: "transform 180ms ease, background 180ms ease, border-color 180ms ease"
    },
    expandIndicatorOpen: {
        transform: "rotate(180deg)",
        background: "rgba(188, 63, 43, 0.12)",
        borderColor: "rgba(188, 63, 43, 0.22)"
    },
    expandIndicatorGlyph: {
        fontSize: 16,
        lineHeight: 1,
        fontWeight: 900
    },
    detailShell: {
        padding: "0 4px 4px",
        minWidth: 0,
        maxWidth: "100%",
        overflow: "hidden"
    },
    reportCard: {
        marginTop: 12,
        background: "linear-gradient(180deg, rgba(255, 248, 236, 0.96) 0%, rgba(250, 238, 219, 0.9) 100%)",
        border: "1px solid rgba(211, 159, 52, 0.22)",
        borderRadius: "var(--radius-lg)",
        padding: 18,
        boxShadow: "var(--shadow-sm)"
    },
    reportTitle: {
        fontWeight: 800,
        marginBottom: 10,
        color: "#7b4b10",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        fontSize: 12
    },
    reportParagraph: {
        margin: "0 0 12px",
        lineHeight: 1.65,
        color: "#51473d"
    },
    reportList: {
        margin: "0 0 12px",
        paddingLeft: 20,
        color: "#51473d",
        lineHeight: 1.6
    },
    reportMeta: {
        marginTop: 10,
        color: "#8b7355",
        fontSize: 12
    },
    emptyState: {
        padding: 22,
        borderRadius: "var(--radius-lg)",
        background: "rgba(255, 251, 245, 0.8)",
        border: "1px dashed rgba(107, 86, 58, 0.22)",
        color: "var(--muted)"
    }
};

function getResultPresentation(result) {
    switch (result) {
    case "W":
        return {
            headerStyle: styles.matchHeaderWin
        };
    case "L":
        return {
            headerStyle: styles.matchHeaderLoss
        };
    case "T":
        return {
            headerStyle: styles.matchHeaderTie
        };
    default:
        return {
            headerStyle: null
        };
    }
}

function getTeamIdExternFromTeamKey(teamKey) {
    const match = String(teamKey ?? "").match(/TEAM:(\d+)$/);
    return match ? Number(match[1]) : 0;
}

function MatchListSection({
    sortedMatches,
    visibleMatches,
    selectedMatch,
    onSelectedMatchChange,
    selectedPhase,
    openMatches,
    onToggleMatch,
    onTeamNavigate,
    onPlayerNavigate
}) {
    const formatMatchTitle = (match) => `Jornada ${match.phaseRound ?? "-"} · vs ${match.rival}`;

    if (sortedMatches.length === 0) {
        return (
            <section style={styles.section}>
                <div style={styles.heading}>
                    <div style={styles.eyebrow}>Partidos</div>
                    <h2 style={styles.title}>Jornadas y partidos</h2>
                </div>
                <div style={styles.emptyState}>
                    No hay partidos disponibles para este filtro.
                </div>
            </section>
        );
    }

    return (
        <section style={styles.section}>
            <div style={styles.heading}>
                <div style={styles.eyebrow}>Partidos</div>
                <h2 style={styles.title}>Jornadas y partidos</h2>
                <p style={styles.subtitle}>
                    Haz clic en la tarjeta para desplegar el partido. El escudo te lleva a la ficha del otro equipo.
                </p>
            </div>

            <div style={styles.controls}>
                <PrettySelect
                    label="Partido"
                    value={selectedMatch}
                    onChange={(event) => onSelectedMatchChange(event.target.value)}
                    ariaLabel="Selecciona partido"
                    minWidth="360px"
                >
                    <option value="">Todos</option>
                    {sortedMatches.map((match) => (
                        <option key={match.matchWebId} value={match.matchWebId}>
                            {formatMatchTitle(match)}
                        </option>
                    ))}
                </PrettySelect>
            </div>

            {visibleMatches.map((match) => {
                const isOpen = openMatches[match.matchWebId];
                const resultPresentation = getResultPresentation(match.result);
                const detailId = `match-detail-${match.matchWebId}`;
                const phaseLabel = selectedPhase
                    ? (match.phaseName || buildCompetitionPhaseLabel(match))
                    : buildCompetitionPhaseLabel(match);
                const currentTeamKey = match.teamKey ?? "";
                const rivalTeamKey = match.rivalTeamKey ?? "";
                const homeTeam = {
                    name: match.homeTeam,
                    teamKey: match.homeTeamKey || (match.isHome ? currentTeamKey : rivalTeamKey),
                    teamIdExtern: match.isHome
                        ? Number(match.teamIdExtern ?? 0)
                        : getTeamIdExternFromTeamKey(match.homeTeamKey || rivalTeamKey),
                    isCurrentTeam: (match.homeTeamKey || (match.isHome ? currentTeamKey : rivalTeamKey)) === currentTeamKey
                };
                const awayTeam = {
                    name: match.awayTeam,
                    teamKey: match.awayTeamKey || (match.isHome ? rivalTeamKey : currentTeamKey),
                    teamIdExtern: match.isHome
                        ? getTeamIdExternFromTeamKey(match.awayTeamKey || rivalTeamKey)
                        : Number(match.teamIdExtern ?? 0),
                    isCurrentTeam: (match.awayTeamKey || (match.isHome ? rivalTeamKey : currentTeamKey)) === currentTeamKey
                };

                const renderTeamLogo = (team) => {
                    const canNavigate = Boolean(team.teamKey);
                    const badgeProps = {
                        teamIdExtern: team.teamIdExtern,
                        teamName: team.name,
                        size: "md",
                        title: team.name,
                        style: {
                            width: 56,
                            height: 56,
                            minWidth: 56
                        }
                    };

                    if (!canNavigate) {
                        return (
                            <span style={styles.teamLogoStatic}>
                                <TeamBadge {...badgeProps}/>
                            </span>
                        );
                    }

                    return (
                        <button
                            type="button"
                            style={styles.teamLogoAction}
                            title={`Abrir ficha de ${team.name}`}
                            aria-label={`Abrir ficha de ${team.name}`}
                            onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                onTeamNavigate?.(team.teamKey);
                            }}
                        >
                            <TeamBadge {...badgeProps}/>
                        </button>
                    );
                };

                return (
                    <div key={match.matchWebId} style={styles.matchCard}>
                        <div
                            style={{
                                ...styles.matchHeader,
                                ...(resultPresentation.headerStyle ?? {})
                            }}
                            role="button"
                            tabIndex={0}
                            aria-expanded={isOpen}
                            aria-controls={detailId}
                            onClick={() => onToggleMatch(match.matchWebId)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    onToggleMatch(match.matchWebId);
                                }
                            }}
                        >
                            <div style={styles.teamSide} className="match-team-side">
                                {renderTeamLogo(homeTeam)}
                                <div style={styles.teamText} className="match-team-text">
                                    <div
                                        style={{
                                            ...styles.teamName,
                                            ...(homeTeam.isCurrentTeam ? styles.teamNameCurrent : {})
                                        }}
                                        title={homeTeam.name}
                                    >
                                        {homeTeam.name}
                                    </div>
                                </div>
                            </div>

                            <div style={styles.matchCenter} className="match-center">
                                <div style={styles.matchCenterMeta}>
                                    <span style={styles.metaPill}>{`Jornada ${match.phaseRound ?? "-"}`}</span>
                                    <span style={styles.metaPill}>{phaseLabel}</span>
                                </div>
                                <div style={styles.scoreLine}>
                                    <span style={styles.scoreValue}>{match.homeScore ?? "-"}</span>
                                    <span style={styles.scoreDivider}>·</span>
                                    <span style={styles.scoreValue}>{match.awayScore ?? "-"}</span>
                                </div>
                            </div>

                            <div style={{...styles.teamSide, ...styles.teamSideAway}} className="match-team-side match-team-side-away">
                                <div style={{...styles.teamText, ...styles.teamTextAway}} className="match-team-text">
                                    <div
                                        style={{
                                            ...styles.teamName,
                                            ...(awayTeam.isCurrentTeam ? styles.teamNameCurrent : {})
                                        }}
                                        title={awayTeam.name}
                                    >
                                        {awayTeam.name}
                                    </div>
                                </div>
                                {renderTeamLogo(awayTeam)}
                            </div>

                            <div style={styles.expandDock} aria-hidden="true">
                                <span
                                    style={{
                                        ...styles.expandIndicator,
                                        ...(isOpen ? styles.expandIndicatorOpen : {})
                                    }}
                                >
                                    <span style={styles.expandIndicatorGlyph}>⌄</span>
                                </span>
                            </div>
                        </div>

                        {isOpen ? (
                            <div id={detailId} style={styles.detailShell}>
                                <MatchDetailContent
                                    matchWebId={match.matchWebId}
                                    focusTeamIdExtern={Number(match.teamIdExtern ?? 0)}
                                    focusTeamName={homeTeam.isCurrentTeam ? homeTeam.name : awayTeam.name}
                                    players={match.players}
                                    insights={match.insights}
                                    matchReport={match.matchReport}
                                    matchReportGeneratedAtUtc={match.matchReportGeneratedAtUtc}
                                    matchReportModel={match.matchReportModel}
                                    onPlayerNavigate={onPlayerNavigate}
                                    emptyMessage="No hay detalle disponible para este partido."
                                />
                            </div>
                        ) : null}
                    </div>
                );
            })}
        </section>
    );
}

export default MatchListSection;
