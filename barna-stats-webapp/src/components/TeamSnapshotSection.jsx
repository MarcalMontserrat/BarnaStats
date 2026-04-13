const styles = {
    section: {
        display: "grid",
        gap: 18,
        padding: "24px clamp(18px, 3vw, 30px)",
        borderRadius: "var(--radius-xl)",
        background: "linear-gradient(180deg, rgba(255, 252, 247, 0.92) 0%, rgba(248, 242, 232, 0.9) 100%)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-md)",
        animation: "fade-up 780ms ease both"
    },
    header: {
        display: "grid",
        gap: 10
    },
    eyebrow: {
        color: "var(--accent)",
        fontSize: 12,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.12em"
    },
    title: {
        fontSize: "clamp(1.9rem, 2.6vw, 2.8rem)"
    },
    subtitle: {
        color: "var(--muted)",
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
        background: "rgba(255, 249, 242, 0.9)",
        border: "1px solid rgba(107, 86, 58, 0.14)",
        color: "var(--navy)",
        fontSize: 13,
        fontWeight: 700
    },
    layout: {
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.3fr) minmax(320px, 0.9fr)",
        gap: 18
    },
    metricsGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 14
    },
    metricCard: {
        display: "grid",
        gap: 10,
        padding: 18,
        borderRadius: "var(--radius-lg)",
        background: "linear-gradient(180deg, rgba(255, 255, 255, 0.84) 0%, rgba(249, 242, 233, 0.92) 100%)",
        border: "1px solid rgba(107, 86, 58, 0.12)"
    },
    metricLabel: {
        color: "var(--muted)",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase"
    },
    metricValue: {
        fontFamily: "var(--font-display)",
        fontSize: "clamp(1.7rem, 2vw, 2.4rem)",
        lineHeight: 0.95
    },
    metricSubtitle: {
        color: "var(--muted)",
        fontSize: 13,
        lineHeight: 1.5
    },
    spotlightColumn: {
        display: "grid",
        gap: 14
    },
    spotlightCard: {
        display: "grid",
        gap: 12,
        padding: 20,
        borderRadius: "var(--radius-lg)",
        background: "linear-gradient(135deg, rgba(19, 32, 51, 0.96) 0%, rgba(53, 28, 34, 0.92) 54%, rgba(143, 44, 29, 0.9) 100%)",
        color: "#fff7ef",
        border: "1px solid rgba(255, 255, 255, 0.08)"
    },
    spotlightKicker: {
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "rgba(255, 243, 227, 0.72)"
    },
    spotlightName: {
        fontFamily: "var(--font-display)",
        fontSize: "clamp(1.6rem, 2vw, 2.2rem)",
        lineHeight: 0.95
    },
    spotlightValue: {
        fontSize: 16,
        fontWeight: 800
    },
    spotlightMeta: {
        color: "rgba(255, 243, 227, 0.8)",
        fontSize: 14,
        lineHeight: 1.55
    }
};

function formatSigned(value, digits = 0) {
    const number = Number(value ?? 0);
    const prefix = number > 0 ? "+" : "";

    return `${prefix}${number.toLocaleString("es-ES", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    })}`;
}

function formatRecord(record) {
    if ((record?.ties ?? 0) > 0) {
        return `${record?.wins ?? 0}-${record?.losses ?? 0}-${record?.ties ?? 0}`;
    }

    return `${record?.wins ?? 0}-${record?.losses ?? 0}`;
}

function formatAverage(value) {
    return Number(value ?? 0).toLocaleString("es-ES", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    });
}

function TeamSnapshotSection({
    seasonLabel,
    record,
    standingRow,
    standingLabel,
    bestWinStreak,
    teamAveragePoints,
    topScorer,
    mvp
}) {
    const pointsDiff = Number(record?.pointsFor ?? 0) - Number(record?.pointsAgainst ?? 0);

    return (
        <section style={styles.section}>
            <div style={styles.header}>
                <div style={styles.eyebrow}>Resumen del equipo</div>
                <h2 style={styles.title}>Dónde está el equipo ahora</h2>
                <p style={styles.subtitle}>
                    Una lectura rápida del tramo que tienes filtrado para entender balance, posición y quién está tirando del carro.
                </p>
            </div>

            <div style={styles.metaRow}>
                <span style={styles.metaChip}>{seasonLabel}</span>
                <span style={styles.metaChip}>{record.matches} partidos</span>
                <span style={styles.metaChip}>{standingLabel}</span>
            </div>

            <div style={styles.layout}>
                <div style={styles.metricsGrid}>
                    <div style={styles.metricCard}>
                        <div style={styles.metricLabel}>Balance</div>
                        <div style={styles.metricValue}>{formatRecord(record)}</div>
                        <div style={styles.metricSubtitle}>Victorias y derrotas del tramo visible.</div>
                    </div>

                    <div style={styles.metricCard}>
                        <div style={styles.metricLabel}>Posición</div>
                        <div style={styles.metricValue}>{standingRow ? `#${standingRow.position}` : "—"}</div>
                        <div style={styles.metricSubtitle}>{standingLabel}</div>
                    </div>

                    <div style={styles.metricCard}>
                        <div style={styles.metricLabel}>Mejor racha</div>
                        <div style={styles.metricValue}>{bestWinStreak}</div>
                        <div style={styles.metricSubtitle}>Victorias consecutivas en este tramo.</div>
                    </div>

                    <div style={styles.metricCard}>
                        <div style={styles.metricLabel}>Media anotadora</div>
                        <div style={styles.metricValue}>{formatAverage(teamAveragePoints)}</div>
                        <div style={styles.metricSubtitle}>Puntos por partido.</div>
                    </div>

                    <div style={styles.metricCard}>
                        <div style={styles.metricLabel}>Diferencial</div>
                        <div style={styles.metricValue}>{formatSigned(pointsDiff, 0)}</div>
                        <div style={styles.metricSubtitle}>Puntos a favor menos puntos en contra.</div>
                    </div>
                </div>

                <div style={styles.spotlightColumn}>
                    <div style={styles.spotlightCard}>
                        <div style={styles.spotlightKicker}>Máxima anotadora</div>
                        <div style={styles.spotlightName}>{topScorer?.name ?? "—"}</div>
                        <div style={styles.spotlightValue}>{topScorer ? `${topScorer.points} puntos` : "Sin datos"}</div>
                        <div style={styles.spotlightMeta}>
                            {topScorer
                                ? `${formatAverage(topScorer.avgPoints)} por partido en ${topScorer.games} encuentros.`
                                : "No hay suficientes partidos para destacarla todavía."}
                        </div>
                    </div>

                    <div style={styles.spotlightCard}>
                        <div style={styles.spotlightKicker}>Mejor valoración</div>
                        <div style={styles.spotlightName}>{mvp?.name ?? "—"}</div>
                        <div style={styles.spotlightValue}>{mvp ? `${mvp.valuation} de valoración total` : "Sin datos"}</div>
                        <div style={styles.spotlightMeta}>
                            {mvp
                                ? `${formatAverage(mvp.avgValuation)} de media en ${mvp.games} partidos.`
                                : "No hay suficientes partidos para destacarla todavía."}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default TeamSnapshotSection;
