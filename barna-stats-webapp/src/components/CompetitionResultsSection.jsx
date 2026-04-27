import {useState} from "react";
import CompetitionMatchDetail from "./CompetitionMatchDetail.jsx";
import PrettySelect from "./PrettySelect.jsx";
import TeamBadge from "./TeamBadge.jsx";
import {
    buildCompetitionPhaseLabel,
    filterCompetitionMatchesByPhaseOption,
    filterRowsByCategory,
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
    matchCard: {
        display: "grid",
        gap: 0
    },
    row: {
        display: "grid",
        gap: 12,
        padding: "18px 20px",
        borderRadius: "var(--radius-lg)",
        background: "linear-gradient(180deg, rgba(255, 255, 255, 0.86) 0%, rgba(248, 242, 233, 0.92) 100%)",
        border: "1px solid rgba(107, 86, 58, 0.12)",
        boxShadow: "var(--shadow-sm)",
        position: "relative",
        cursor: "pointer"
    },
    rowOpen: {
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        borderBottom: "none"
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
        alignItems: "center",
        minWidth: 0
    },
    teamButton: {
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        minWidth: 0,
        padding: 0,
        border: "none",
        background: "transparent",
        color: "var(--navy)",
        fontWeight: 800,
        textAlign: "left",
        cursor: "pointer",
        fontSize: 15,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
    },
    teamButtonLabel: {
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
    },
    awayButton: {
        justifyContent: "flex-end",
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
        borderBottomLeftRadius: "var(--radius-lg)",
        borderBottomRightRadius: "var(--radius-lg)",
        border: "1px solid rgba(107, 86, 58, 0.12)",
        borderTop: "none",
        background: "rgba(255, 252, 247, 0.95)",
        boxShadow: "var(--shadow-sm)"
    },
    detailCard: {
        margin: 12,
        background: "linear-gradient(180deg, rgba(255, 248, 236, 0.96) 0%, rgba(250, 238, 219, 0.9) 100%)",
        border: "1px solid rgba(211, 159, 52, 0.22)",
        borderRadius: "var(--radius-lg)",
        padding: 18,
        boxShadow: "var(--shadow-sm)"
    },
    detailTitle: {
        fontWeight: 800,
        marginBottom: 10,
        color: "#7b4b10",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        fontSize: 12
    },
    detailChips: {
        display: "flex",
        gap: 10,
        flexWrap: "wrap"
    },
    detailChip: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 12px",
        borderRadius: 999,
        background: "rgba(255, 255, 255, 0.74)",
        border: "1px solid rgba(26, 53, 87, 0.1)",
        color: "var(--navy)",
        fontSize: 13,
        fontWeight: 700
    },
    detailChipLabel: {
        color: "#5d738e",
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        fontSize: 11
    },
    detailEmpty: {
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

function formatMatchLabel(match) {
    const phase = buildCompetitionPhaseLabel(match);
    return `${phase} · ${match.homeTeam} vs ${match.awayTeam}`;
}

function CompetitionResultsSection({
    matches,
    teamDetailsByKey,
    analysisVersion,
    phaseOptions,
    selectedPhase,
    onSelectedPhaseChange,
    levelOptions,
    selectedLevel,
    onSelectedLevelChange,
    categoryOptions,
    selectedCategory,
    onSelectedCategoryChange,
    selectedTeamKey,
    onTeamNavigate,
    onPlayerNavigate,
    openMatches,
    onToggleMatch,
    enableMatchReportOnDemand = true
}) {
    const sortedFilteredMatches = [...filterRowsByCategory(
        filterRowsByLevel(
            filterCompetitionMatchesByPhaseOption(matches, selectedPhase),
            selectedLevel
        ),
        selectedCategory
    )]
        .sort((a, b) => {
            const dateA = a.matchDate ? new Date(a.matchDate).getTime() : 0;
            const dateB = b.matchDate ? new Date(b.matchDate).getTime() : 0;
            if (dateA !== dateB) {
                return dateB - dateA;
            }

            return Number(b.matchWebId ?? 0) - Number(a.matchWebId ?? 0);
        });

    const [selectedMatch, setSelectedMatch] = useState("");

    const visibleMatches = selectedMatch
        ? sortedFilteredMatches.filter((m) => String(m.matchWebId) === selectedMatch)
        : sortedFilteredMatches;

    const latestMatchDate = sortedFilteredMatches[0]?.matchDate ?? null;

    return (
        <section style={styles.section}>
            <div style={styles.header}>
                <div style={styles.titleBlock}>
                    <div style={styles.eyebrow}>Resultados</div>
                    <h2 style={styles.title}>Partidos de la competición</h2>
                    <p style={styles.subtitle}>
                        Consulta los partidos cargados, ordenados del más reciente al más antiguo. Haz clic o presiona Enter en un partido para ver su detalle.
                    </p>
                </div>

                <div style={styles.filtersCard}>
                    <div style={styles.filtersRow}>
                        {categoryOptions?.length > 0 ? (
                            <PrettySelect
                                label="Categoría"
                                value={String(selectedCategory ?? "")}
                                onChange={(event) => onSelectedCategoryChange(event.target.value)}
                                ariaLabel="Selecciona categoría para los resultados"
                                minWidth="220px"
                            >
                                {categoryOptions.map((cat) => (
                                    <option key={cat.value} value={cat.value}>
                                        {cat.label}
                                    </option>
                                ))}
                            </PrettySelect>
                        ) : null}
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
                        <PrettySelect
                            label="Partido"
                            value={selectedMatch}
                            onChange={(event) => setSelectedMatch(event.target.value)}
                            ariaLabel="Selecciona partido"
                            minWidth="300px"
                        >
                            <option value="">Todos los partidos</option>
                            {sortedFilteredMatches.map((match) => (
                                <option key={match.matchWebId} value={String(match.matchWebId)}>
                                    {formatMatchLabel(match)}
                                </option>
                            ))}
                        </PrettySelect>
                    </div>
                    <span style={styles.controlHint}>Estos filtros solo afectan al listado de partidos.</span>
                </div>

                <div style={styles.metaRow}>
                    <span style={styles.metaChip}>{visibleMatches.length} partidos</span>
                    {latestMatchDate ? (
                        <span style={styles.metaChip}>Último partido: {formatDate(latestMatchDate)}</span>
                    ) : null}
                </div>
            </div>

            {visibleMatches.length > 0 ? (
                <div style={styles.list}>
                    {visibleMatches.map((match) => {
                        const isSelectedTeamMatch = selectedTeamKey &&
                            (match.homeTeamKey === selectedTeamKey || match.awayTeamKey === selectedTeamKey);
                        const isOpen = Boolean(openMatches?.[match.matchWebId]);
                        const detailId = `competition-match-detail-${match.matchWebId}`;

                        return (
                            <div key={match.matchWebId} style={styles.matchCard}>
                                <div
                                    style={{
                                        ...styles.row,
                                        ...(isSelectedTeamMatch ? styles.rowHighlighted : {}),
                                        ...(isOpen ? styles.rowOpen : {})
                                    }}
                                    role="button"
                                    tabIndex={0}
                                    aria-expanded={isOpen}
                                    aria-controls={detailId}
                                    onClick={() => onToggleMatch?.(match.matchWebId)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault();
                                            onToggleMatch?.(match.matchWebId);
                                        }
                                    }}
                                >
                                    <div style={styles.rowMeta}>
                                        <span style={styles.metaPill}>{buildCompetitionPhaseLabel(match)}</span>
                                        <span style={styles.metaPill}>{formatDate(match.matchDate)}</span>
                                    </div>

                                    <div style={styles.teamsRow}>
                                        <button
                                            type="button"
                                            style={styles.teamButton}
                                            title={match.homeTeam}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onTeamNavigate?.(match.homeTeamKey);
                                            }}
                                        >
                                            <TeamBadge
                                                size="sm"
                                                teamIdExtern={match.homeTeamIdExtern}
                                                teamName={match.homeTeam}
                                            />
                                            <span style={styles.teamButtonLabel}>{match.homeTeam}</span>
                                        </button>

                                        <div style={styles.scorePill}>
                                            {match.homeScore} - {match.awayScore}
                                        </div>

                                        <button
                                            type="button"
                                            style={{...styles.teamButton, ...styles.awayButton}}
                                            title={match.awayTeam}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onTeamNavigate?.(match.awayTeamKey);
                                            }}
                                        >
                                            <span style={styles.teamButtonLabel}>{match.awayTeam}</span>
                                            <TeamBadge
                                                size="sm"
                                                teamIdExtern={match.awayTeamIdExtern}
                                                teamName={match.awayTeam}
                                            />
                                        </button>
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
                                        <CompetitionMatchDetail
                                            match={match}
                                            teamDetailsByKey={teamDetailsByKey}
                                            analysisVersion={analysisVersion}
                                            onTeamNavigate={onTeamNavigate}
                                            onPlayerNavigate={onPlayerNavigate}
                                            enableMatchReportOnDemand={enableMatchReportOnDemand}
                                        />
                                    </div>
                                ) : null}
                            </div>
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
