import MatchTable from "./MatchTable.jsx";
import PrettySelect from "./PrettySelect.jsx";

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
        gap: 12
    },
    matchHeader: {
        display: "flex",
        justifyContent: "space-between",
        gap: 18,
        flexWrap: "wrap",
        alignItems: "center",
        padding: "18px 20px",
        borderRadius: "var(--radius-lg)",
        background: "linear-gradient(135deg, rgba(255, 251, 245, 0.96) 0%, rgba(245, 235, 221, 0.92) 100%)",
        border: "1px solid rgba(107, 86, 58, 0.12)",
        boxShadow: "var(--shadow-md)",
        cursor: "pointer"
    },
    matchHeaderMain: {
        display: "grid",
        gap: 6
    },
    matchTitle: {
        fontFamily: "var(--font-display)",
        fontSize: "clamp(1.25rem, 2vw, 1.65rem)",
        lineHeight: 1
    },
    matchMeta: {
        color: "var(--muted)",
        fontSize: 14
    },
    headerAside: {
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "flex-end"
    },
    scorePill: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 44,
        padding: "0 16px",
        borderRadius: 999,
        background: "linear-gradient(135deg, #172c47 0%, #234569 100%)",
        color: "#fff7ef",
        fontWeight: 800,
        letterSpacing: "0.04em"
    },
    metaPill: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 40,
        padding: "0 14px",
        borderRadius: 999,
        background: "rgba(188, 63, 43, 0.1)",
        color: "var(--accent-strong)",
        fontWeight: 700,
        fontSize: 13
    },
    detailShell: {
        padding: "0 4px 4px"
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

function MatchListSection({
    sortedMatches,
    visibleMatches,
    selectedMatch,
    onSelectedMatchChange,
    selectedPhase,
    openMatches,
    onToggleMatch
}) {
    const renderMatchReport = (match) => {
        if (!match.matchReport) {
            return null;
        }

        const blocks = match.matchReport
            .split(/\n\s*\n/)
            .map((block) => block.trim())
            .filter(Boolean);

        return (
            <div style={styles.reportCard}>
                <div style={styles.reportTitle}>Analisis del partido</div>
                {blocks.map((block, index) => {
                    const lines = block
                        .split("\n")
                        .map((line) => line.trim())
                        .filter(Boolean);
                    const isBulletBlock = lines.every((line) => line.startsWith("- "));

                    if (isBulletBlock) {
                        return (
                            <ul key={index} style={styles.reportList}>
                                {lines.map((line) => (
                                    <li key={line}>{line.slice(2)}</li>
                                ))}
                            </ul>
                        );
                    }

                    return (
                        <p key={index} style={styles.reportParagraph}>
                            {block}
                        </p>
                    );
                })}
                {match.matchReportGeneratedAtUtc ? (
                    <div style={styles.reportMeta}>
                        Generado: {new Date(match.matchReportGeneratedAtUtc).toLocaleString("es-ES")}
                        {match.matchReportModel ? ` · ${match.matchReportModel}` : ""}
                    </div>
                ) : null}
            </div>
        );
    };

    const formatMatchTitle = (match) => {
        if (selectedPhase) {
            return `Jornada ${match.phaseRound ?? "-"} · vs ${match.rival}`;
        }

        return `Fase ${match.phaseNumber ?? "-"} · Jornada ${match.phaseRound ?? "-"} · vs ${match.rival}`;
    };

    if (sortedMatches.length === 0) {
        return (
            <section style={styles.section}>
                <div style={styles.heading}>
                    <div style={styles.eyebrow}>Partidos</div>
                    <h2 style={styles.title}>Bitacora de jornadas</h2>
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
                <h2 style={styles.title}>Bitacora de jornadas</h2>
                <p style={styles.subtitle}>
                    Despliega cada encuentro para revisar la tabla individual y, si existe, el resumen generado del partido.
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
                const totalPoints = match.players.reduce(
                    (sum, player) => sum + Number(player.points), 0
                );
                const scoreLine = match.teamScore === null || match.rivalScore === null
                    ? `${totalPoints} pts`
                    : `${match.teamScore} - ${match.rivalScore}`;
                const location = match.isHome ? "Casa" : "Fuera";
                const isOpen = openMatches[match.matchWebId];

                return (
                    <div key={match.matchWebId} style={styles.matchCard}>
                        <div
                            style={styles.matchHeader}
                            onClick={() => onToggleMatch(match.matchWebId)}
                        >
                            <div style={styles.matchHeaderMain}>
                                <div style={styles.matchTitle}>
                                    {formatMatchTitle(match)}
                                </div>
                                <div style={styles.matchMeta}>
                                    {match.result || "-"} · {location}
                                </div>
                            </div>

                            <div style={styles.headerAside}>
                                <span style={styles.scorePill}>{scoreLine}</span>
                                <span style={styles.metaPill}>
                                    {isOpen ? "Ocultar detalle" : "Ver detalle"}
                                </span>
                            </div>
                        </div>

                        {isOpen ? (
                            <div style={styles.detailShell}>
                                <MatchTable players={match.players}/>
                                {renderMatchReport(match)}
                            </div>
                        ) : null}
                    </div>
                );
            })}
        </section>
    );
}

export default MatchListSection;
