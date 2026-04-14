import PrettySelect from "./PrettySelect.jsx";
import {
    buildCompetitionPhaseLabel,
    filterCompetitionMatchesByPhaseOption,
    filterRowsByLevel
} from "../utils/analysisDerived.js";

const styles = {
    section: {
        display: "grid",
        gap: 18,
        padding: "24px clamp(18px, 3vw, 30px)",
        borderRadius: "var(--radius-xl)",
        background: "linear-gradient(180deg, rgba(255, 252, 247, 0.92) 0%, rgba(251, 245, 237, 0.88) 100%)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-md)",
        animation: "fade-up 940ms ease both"
    },
    header: {
        display: "grid",
        gap: 16
    },
    titleBlock: {
        display: "grid",
        gap: 8,
        maxWidth: 760
    },
    eyebrow: {
        color: "var(--accent)",
        fontSize: 12,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.12em"
    },
    title: {
        fontSize: "clamp(1.8rem, 2.4vw, 2.4rem)"
    },
    subtitle: {
        color: "var(--muted)",
        maxWidth: 760,
        lineHeight: 1.6
    },
    filtersCard: {
        display: "grid",
        gap: 10,
        padding: "16px 18px",
        borderRadius: "var(--radius-lg)",
        background: "rgba(255, 249, 242, 0.82)",
        border: "1px solid rgba(107, 86, 58, 0.12)"
    },
    filtersRow: {
        display: "flex",
        gap: 14,
        flexWrap: "wrap",
        alignItems: "end"
    },
    controlHint: {
        color: "var(--muted)",
        fontSize: 12,
        fontWeight: 700
    },
    metaRow: {
        display: "flex",
        gap: 10,
        flexWrap: "wrap"
    },
    metaChip: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 13px",
        borderRadius: 999,
        background: "rgba(255, 249, 242, 0.9)",
        border: "1px solid rgba(107, 86, 58, 0.14)",
        color: "var(--navy)",
        fontSize: 13,
        fontWeight: 700
    },
    list: {
        display: "grid",
        gap: 12
    },
    row: {
        display: "grid",
        gap: 12,
        padding: "18px 20px",
        borderRadius: "var(--radius-lg)",
        background: "linear-gradient(180deg, rgba(255, 255, 255, 0.86) 0%, rgba(248, 242, 233, 0.92) 100%)",
        border: "1px solid rgba(107, 86, 58, 0.12)",
        boxShadow: "var(--shadow-sm)"
    },
    rowHighlighted: {
        borderColor: "rgba(188, 63, 43, 0.28)",
        boxShadow: "0 14px 34px rgba(188, 63, 43, 0.08)"
    },
    rowMeta: {
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        alignItems: "center"
    },
    metaPill: {
        display: "inline-flex",
        alignItems: "center",
        minHeight: 32,
        padding: "0 12px",
        borderRadius: 999,
        background: "rgba(188, 63, 43, 0.08)",
        color: "var(--accent-strong)",
        fontWeight: 700,
        fontSize: 12
    },
    teamsRow: {
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
        gap: 12,
        alignItems: "center"
    },
    teamButton: {
        padding: 0,
        border: "none",
        background: "transparent",
        color: "var(--navy)",
        fontWeight: 800,
        textAlign: "left",
        cursor: "pointer",
        fontSize: 15
    },
    awayButton: {
        textAlign: "right"
    },
    scorePill: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 42,
        padding: "0 16px",
        borderRadius: 999,
        background: "linear-gradient(135deg, #172c47 0%, #234569 100%)",
        color: "#fff7ef",
        fontWeight: 800,
        letterSpacing: "0.04em"
    },
    resultNote: {
        color: "var(--muted)",
        fontSize: 13,
        lineHeight: 1.5
    },
    emptyState: {
        padding: "18px 16px",
        borderRadius: "var(--radius-lg)",
        background: "rgba(245, 236, 224, 0.8)",
        border: "1px dashed rgba(107, 86, 58, 0.22)",
        color: "var(--muted)"
    }
};

function formatDate(value) {
    if (!value) {
        return "Fecha pendiente";
    }

    return new Intl.DateTimeFormat("es-ES", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
    }).format(new Date(value));
}

function CompetitionResultsSection({
    matches,
    phaseOptions,
    selectedPhase,
    onSelectedPhaseChange,
    levelOptions,
    selectedLevel,
    onSelectedLevelChange,
    selectedTeamKey,
    onTeamNavigate
}) {
    const filteredMatches = [...filterRowsByLevel(
        filterCompetitionMatchesByPhaseOption(matches, selectedPhase),
        selectedLevel
    )]
        .sort((a, b) => {
            const dateA = a.matchDate ? new Date(a.matchDate).getTime() : 0;
            const dateB = b.matchDate ? new Date(b.matchDate).getTime() : 0;
            if (dateA !== dateB) {
                return dateB - dateA;
            }

            return Number(b.matchWebId ?? 0) - Number(a.matchWebId ?? 0);
        });

    const latestMatchDate = filteredMatches[0]?.matchDate ?? null;

    return (
        <section style={styles.section}>
            <div style={styles.header}>
                <div style={styles.titleBlock}>
                    <div style={styles.eyebrow}>Resultados</div>
                    <h2 style={styles.title}>Partidos de la competición</h2>
                    <p style={styles.subtitle}>
                        Recorrido completo de los encuentros cargados, ordenados del más reciente al más antiguo.
                    </p>
                </div>

                <div style={styles.filtersCard}>
                    <div style={styles.filtersRow}>
                        <PrettySelect
                            label="Fase"
                            value={String(selectedPhase ?? "all")}
                            onChange={(event) => onSelectedPhaseChange(event.target.value)}
                            ariaLabel="Selecciona fase para los resultados"
                            minWidth="220px"
                        >
                            <option value="all">Todas las fases</option>
                            {phaseOptions.map((phase) => (
                                <option key={phase.value} value={phase.value}>
                                    {phase.label}
                                </option>
                            ))}
                        </PrettySelect>
                        {levelOptions.length > 0 ? (
                            <PrettySelect
                                label="Nivel"
                                value={String(selectedLevel ?? "all")}
                                onChange={(event) => onSelectedLevelChange(event.target.value)}
                                ariaLabel="Selecciona nivel para los resultados"
                                minWidth="220px"
                            >
                                <option value="all">Todos los niveles</option>
                                {levelOptions.map((level) => (
                                    <option key={level.value} value={level.value}>
                                        {level.label}
                                    </option>
                                ))}
                            </PrettySelect>
                        ) : null}
                    </div>
                    <span style={styles.controlHint}>Estos filtros solo afectan al listado de partidos.</span>
                </div>

                <div style={styles.metaRow}>
                    <span style={styles.metaChip}>{filteredMatches.length} partidos</span>
                    {latestMatchDate ? (
                        <span style={styles.metaChip}>Último partido: {formatDate(latestMatchDate)}</span>
                    ) : null}
                </div>
            </div>

            {filteredMatches.length > 0 ? (
                <div style={styles.list}>
                    {filteredMatches.map((match) => {
                        const isSelectedTeamMatch = selectedTeamKey &&
                            (match.homeTeamKey === selectedTeamKey || match.awayTeamKey === selectedTeamKey);

                        return (
                            <article
                                key={match.matchWebId}
                                style={isSelectedTeamMatch
                                    ? {...styles.row, ...styles.rowHighlighted}
                                    : styles.row}
                            >
                                <div style={styles.rowMeta}>
                                    <span style={styles.metaPill}>{buildCompetitionPhaseLabel(match)}</span>
                                    <span style={styles.metaPill}>{formatDate(match.matchDate)}</span>
                                </div>

                                <div style={styles.teamsRow}>
                                    <button
                                        type="button"
                                        style={styles.teamButton}
                                        onClick={() => onTeamNavigate?.(match.homeTeamKey)}
                                    >
                                        {match.homeTeam}
                                    </button>

                                    <div style={styles.scorePill}>
                                        {match.homeScore} - {match.awayScore}
                                    </div>

                                    <button
                                        type="button"
                                        style={{...styles.teamButton, ...styles.awayButton}}
                                        onClick={() => onTeamNavigate?.(match.awayTeamKey)}
                                    >
                                        {match.awayTeam}
                                    </button>
                                </div>

                                <div style={styles.resultNote}>
                                    {match.topScorer
                                        ? `Máxima anotadora del partido: ${match.topScorer} (${match.topScorerTeam}, ${match.topScorerPoints} pts).`
                                        : "No hay detalle de anotación individual para este partido."}
                                </div>
                            </article>
                        );
                    })}
                </div>
            ) : (
                <div style={styles.emptyState}>
                    No hay partidos disponibles para esta fase.
                </div>
            )}
        </section>
    );
}

export default CompetitionResultsSection;
