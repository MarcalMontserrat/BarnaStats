import MatchTable from "./MatchTable.jsx";
import PrettySelect from "./PrettySelect.jsx";

const styles = {
    separator: {
        margin: "30px 0"
    },
    controls: {
        marginBottom: 20
    },
    matchCard: {
        marginBottom: 30
    },
    matchHeader: {
        background: "#fff",
        padding: 15,
        borderRadius: 10,
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        cursor: "pointer"
    },
    matchTitle: {
        fontWeight: 700,
        marginBottom: 4
    },
    matchMeta: {
        color: "#666",
        fontSize: 14
    },
    reportCard: {
        marginTop: 12,
        background: "#fffdf6",
        border: "1px solid #eadfbc",
        borderRadius: 10,
        padding: 16,
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
    },
    reportTitle: {
        fontWeight: 700,
        marginBottom: 8
    },
    reportParagraph: {
        margin: "0 0 10px",
        lineHeight: 1.5,
        color: "#4b5563"
    },
    reportList: {
        margin: 0,
        paddingLeft: 20,
        color: "#4b5563"
    },
    reportMeta: {
        marginTop: 10,
        color: "#8b7355",
        fontSize: 12
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

    return (
        <>
            <hr style={styles.separator}/>

            <h2>Jornadas</h2>

            <div style={styles.controls}>
                <PrettySelect
                    label="Partido"
                    value={selectedMatch}
                    onChange={(event) => onSelectedMatchChange(event.target.value)}
                    ariaLabel="Selecciona partido"
                    minWidth="320px"
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

                return (
                    <div key={match.matchWebId} style={styles.matchCard}>
                        <div
                            style={styles.matchHeader}
                            onClick={() => onToggleMatch(match.matchWebId)}
                        >
                            <div style={styles.matchTitle}>
                                {formatMatchTitle(match)}
                            </div>
                            <div style={styles.matchMeta}>
                                {match.result || "-"} · {scoreLine} · {location}
                            </div>
                        </div>

                        {openMatches[match.matchWebId] ? (
                            <>
                                <MatchTable players={match.players}/>
                                {renderMatchReport(match)}
                            </>
                        ) : null}
                    </div>
                );
            })}
        </>
    );
}

export default MatchListSection;
