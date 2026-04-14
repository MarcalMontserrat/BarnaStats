const styles = {
    section: {
        display: "grid",
        gap: 20,
        padding: "24px clamp(18px, 3vw, 30px)",
        borderRadius: "var(--radius-xl)",
        background: "linear-gradient(135deg, rgba(19, 32, 51, 0.96) 0%, rgba(53, 28, 34, 0.92) 54%, rgba(143, 44, 29, 0.9) 100%)",
        color: "#fff7ef",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "0 28px 70px rgba(22, 18, 15, 0.18)"
    },
    header: {
        display: "grid",
        gap: 10
    },
    eyebrow: {
        color: "rgba(255, 243, 227, 0.72)",
        fontSize: 12,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.12em"
    },
    title: {
        fontSize: "clamp(1.9rem, 2.6vw, 2.8rem)",
        color: "#fff7ef"
    },
    subtitle: {
        color: "rgba(255, 243, 227, 0.82)",
        maxWidth: 760,
        lineHeight: 1.6
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
        background: "rgba(255, 248, 238, 0.12)",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        color: "#fff8f0",
        fontSize: 13,
        fontWeight: 700
    },
    boards: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: 18
    },
    board: {
        display: "grid",
        gap: 16,
        padding: 20,
        borderRadius: "var(--radius-lg)",
        background: "rgba(255, 248, 238, 0.08)",
        border: "1px solid rgba(255, 255, 255, 0.1)"
    },
    boardHeader: {
        display: "grid",
        gap: 6
    },
    boardKicker: {
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        fontWeight: 800,
        color: "rgba(255, 243, 227, 0.74)"
    },
    boardTitle: {
        fontFamily: "var(--font-display)",
        fontSize: "1.65rem",
        lineHeight: 1,
        color: "#fff7ef"
    },
    boardSubtitle: {
        fontSize: 14,
        color: "rgba(255, 243, 227, 0.8)",
        lineHeight: 1.5
    },
    rows: {
        display: "grid",
        gap: 10
    },
    row: {
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1fr) auto",
        gap: 14,
        alignItems: "center",
        padding: "14px 16px",
        borderRadius: "var(--radius-md)",
        background: "rgba(255, 248, 238, 0.08)",
        border: "1px solid rgba(255, 255, 255, 0.08)"
    },
    rank: {
        width: 34,
        height: 34,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        fontWeight: 800,
        fontSize: 13,
        background: "rgba(255, 248, 238, 0.14)",
        color: "#fff7ef"
    },
    playerBlock: {
        display: "grid",
        gap: 5,
        minWidth: 0
    },
    playerName: {
        fontWeight: 800,
        fontSize: 15
    },
    gamesMeta: {
        color: "rgba(255, 243, 227, 0.74)",
        fontSize: 12,
        fontWeight: 700
    },
    statBlock: {
        display: "grid",
        gap: 2,
        justifyItems: "end",
        textAlign: "right"
    },
    statValue: {
        fontFamily: "var(--font-display)",
        fontSize: "1.7rem",
        lineHeight: 0.9,
        color: "#fff7ef"
    },
    statLabel: {
        color: "rgba(255, 243, 227, 0.74)",
        fontSize: 12,
        fontWeight: 700
    },
    emptyState: {
        padding: "18px 16px",
        borderRadius: "var(--radius-lg)",
        background: "rgba(255, 248, 238, 0.08)",
        border: "1px dashed rgba(255, 255, 255, 0.2)",
        color: "rgba(255, 243, 227, 0.8)"
    }
};

function formatMetric(value, digits = 1) {
    return Number(value ?? 0).toLocaleString("es-ES", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    });
}

function buildSecondaryText(player, metric) {
    if (metric === "avgValuation") {
        return `${player.valuation} val total · ${player.games} pj`;
    }

    return `${formatMetric(player.avgPoints, 1)} pts/partido · ${player.games} pj`;
}

function TeamBoard({title, subtitle, rows, metric, label}) {
    return (
        <article style={styles.board}>
            <div style={styles.boardHeader}>
                <div style={styles.boardKicker}>Equipo</div>
                <h3 style={styles.boardTitle}>{title}</h3>
                <p style={styles.boardSubtitle}>{subtitle}</p>
            </div>

            {rows.length > 0 ? (
                <div style={styles.rows}>
                    {rows.map((player, index) => (
                        <div key={player.name} style={styles.row}>
                            <div style={styles.rank}>#{index + 1}</div>

                            <div style={styles.playerBlock}>
                                <div style={styles.playerName}>{player.name}</div>
                                <div style={styles.gamesMeta}>{player.games} partidos</div>
                            </div>

                            <div style={styles.statBlock}>
                                <div style={styles.statValue}>
                                    {metric === "avgValuation"
                                        ? formatMetric(player.avgValuation, 1)
                                        : player.points}
                                </div>
                                <div style={styles.statLabel}>{label}</div>
                                <div style={styles.gamesMeta}>{buildSecondaryText(player, metric)}</div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div style={styles.emptyState}>
                    No hay suficientes datos para construir este ranking.
                </div>
            )}
        </article>
    );
}

function TeamLeadersSection({
    teamName,
    seasonLabel,
    matchesCount,
    playersCount,
    leadersByAvgValuation,
    leadersByPoints
}) {
    return (
        <section style={styles.section}>
            <div style={styles.header}>
                <div style={styles.eyebrow}>Ranking del equipo</div>
                <h2 style={styles.title}>{teamName}</h2>
                <p style={styles.subtitle}>
                    Lectura rápida del equipo seleccionado para ver quién destaca en valoración y quién lleva el peso
                    anotador en el tramo filtrado.
                </p>
            </div>

            <div style={styles.metaRow}>
                <span style={styles.metaChip}>{seasonLabel}</span>
                <span style={styles.metaChip}>{matchesCount} partidos</span>
                <span style={styles.metaChip}>{playersCount} jugadoras</span>
            </div>

            <div style={styles.boards}>
                <TeamBoard
                    title="Mejor valoración media"
                    subtitle="Promedio de valoración por partido."
                    rows={leadersByAvgValuation}
                    metric="avgValuation"
                    label="val media"
                />

                <TeamBoard
                    title="Máximas anotadoras"
                    subtitle="Puntos totales con referencia de media por encuentro."
                    rows={leadersByPoints}
                    metric="points"
                    label="pts totales"
                />
            </div>
        </section>
    );
}

export default TeamLeadersSection;
