const styles = {
    card: {
        marginTop: 12,
        display: "grid",
        gap: 14,
        background: "linear-gradient(180deg, rgba(240, 247, 255, 0.96) 0%, rgba(227, 239, 252, 0.9) 100%)",
        border: "1px solid rgba(26, 53, 87, 0.14)",
        borderRadius: "var(--radius-lg)",
        padding: 18,
        boxShadow: "var(--shadow-sm)"
    },
    header: {
        display: "grid",
        gap: 6
    },
    title: {
        fontWeight: 800,
        color: "var(--navy)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        fontSize: 12
    },
    subtitle: {
        color: "#4a5f7a",
        lineHeight: 1.55,
        fontSize: 14
    },
    chips: {
        display: "flex",
        gap: 10,
        flexWrap: "wrap"
    },
    chip: {
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
    chipLabel: {
        color: "#5d738e",
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        fontSize: 11
    },
    periodBar: {
        display: "flex",
        gap: 10,
        flexWrap: "wrap"
    },
    periodPill: {
        display: "grid",
        gap: 3,
        padding: "10px 12px",
        borderRadius: "var(--radius-md)",
        background: "rgba(255, 255, 255, 0.72)",
        border: "1px solid rgba(26, 53, 87, 0.1)"
    },
    periodLabel: {
        color: "#5d738e",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        fontWeight: 800
    },
    periodScore: {
        color: "var(--navy)",
        fontSize: 15,
        fontWeight: 800
    }
};

function renderSigned(value) {
    const number = Number(value ?? 0);
    return number > 0 ? `+${number}` : String(number);
}

function MatchInsightsPanel({insights}) {
    if (!insights) {
        return null;
    }

    return (
        <div style={styles.card}>
            <div style={styles.header}>
                <div style={styles.title}>Lectura del partido</div>
                <div style={styles.subtitle}>
                    {insights.firstScorer
                        ? `${insights.firstScorer} abrió el marcador`
                        : "Sin detalle de anotadoras en el play-by-play"}
                    {insights.lastScorer ? ` y ${insights.lastScorer} cerró la última canasta registrada.` : "."}
                </div>
            </div>

            <div style={styles.chips}>
                <div style={styles.chip}>
                    <span style={styles.chipLabel}>Cambios de mando</span>
                    <span>{insights.leadChanges}</span>
                </div>

                <div style={styles.chip}>
                    <span style={styles.chipLabel}>Empates</span>
                    <span>{insights.ties}</span>
                </div>

                <div style={styles.chip}>
                    <span style={styles.chipLabel}>Mayor ventaja</span>
                    <span>{renderSigned(insights.maxLead)}</span>
                </div>

                <div style={styles.chip}>
                    <span style={styles.chipLabel}>Máxima desventaja</span>
                    <span>{renderSigned(-insights.maxDeficit)}</span>
                </div>

                <div style={styles.chip}>
                    <span style={styles.chipLabel}>Mejor racha</span>
                    <span>{insights.bestRun}-0</span>
                </div>

                <div style={styles.chip}>
                    <span style={styles.chipLabel}>Peor racha</span>
                    <span>0-{insights.rivalBestRun}</span>
                </div>

                {insights.bestPeriodLabel ? (
                    <div style={styles.chip}>
                        <span style={styles.chipLabel}>Mejor parcial</span>
                        <span>{insights.bestPeriodLabel} ({renderSigned(insights.bestPeriodDiff)})</span>
                    </div>
                ) : null}

                {insights.teamFirstScorer ? (
                    <div style={styles.chip}>
                        <span style={styles.chipLabel}>Primera canasta del equipo</span>
                        <span>{insights.teamFirstScorer}</span>
                    </div>
                ) : null}

                {insights.teamLastScorer ? (
                    <div style={styles.chip}>
                        <span style={styles.chipLabel}>Última canasta del equipo</span>
                        <span>{insights.teamLastScorer}</span>
                    </div>
                ) : null}
            </div>

            {insights.periodScores?.length ? (
                <div style={styles.periodBar}>
                    {insights.periodScores.map((period) => (
                        <div key={period.periodNumber} style={styles.periodPill}>
                            <div style={styles.periodLabel}>{period.label}</div>
                            <div style={styles.periodScore}>
                                {period.teamPoints} - {period.rivalPoints}
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

export default MatchInsightsPanel;
