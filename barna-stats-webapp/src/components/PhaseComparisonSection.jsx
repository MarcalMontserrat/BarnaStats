import {buildCompetitionPhaseLabel} from "../utils/analysisDerived.js";

const styles = {
    section: {
        display: "grid",
        gap: 18,
        padding: "24px clamp(18px, 3vw, 30px)",
        borderRadius: "var(--radius-xl)",
        background: "linear-gradient(180deg, rgba(255, 252, 247, 0.92) 0%, rgba(248, 242, 232, 0.9) 100%)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-md)",
        animation: "fade-up 860ms ease both"
    },
    header: {
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
        fontSize: "clamp(1.8rem, 2.5vw, 2.6rem)"
    },
    subtitle: {
        color: "var(--muted)",
        maxWidth: 760,
        lineHeight: 1.6
    },
    grid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: 16
    },
    card: {
        display: "grid",
        gap: 14,
        padding: 18,
        borderRadius: "var(--radius-lg)",
        background: "rgba(255, 251, 245, 0.88)",
        border: "1px solid rgba(107, 86, 58, 0.12)"
    },
    cardKicker: {
        color: "var(--accent)",
        fontSize: 12,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.12em"
    },
    cardTitle: {
        fontFamily: "var(--font-display)",
        fontSize: "1.8rem",
        lineHeight: 1
    },
    metrics: {
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 12
    },
    metric: {
        display: "grid",
        gap: 4
    },
    metricLabel: {
        color: "var(--muted)",
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        fontWeight: 800
    },
    metricValue: {
        fontSize: 17,
        fontWeight: 800
    },
    deltaBar: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 12
    },
    deltaCard: {
        display: "grid",
        gap: 5,
        padding: 14,
        borderRadius: "var(--radius-md)",
        background: "linear-gradient(180deg, rgba(255, 248, 236, 0.96) 0%, rgba(250, 238, 219, 0.9) 100%)",
        border: "1px solid rgba(211, 159, 52, 0.22)"
    },
    deltaLabel: {
        color: "#8b7355",
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        fontWeight: 800
    },
    deltaValue: {
        fontSize: 19,
        fontWeight: 800
    },
    emptyState: {
        padding: "18px 16px",
        borderRadius: "var(--radius-lg)",
        background: "rgba(245, 236, 224, 0.8)",
        border: "1px dashed rgba(107, 86, 58, 0.22)",
        color: "var(--muted)"
    }
};

function formatNumber(value, digits = 1) {
    return Number(value ?? 0).toLocaleString("es-ES", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    });
}

function formatSigned(value, digits = 1) {
    const numericValue = Number(value ?? 0);
    const prefix = numericValue > 0 ? "+" : "";

    return `${prefix}${numericValue.toLocaleString("es-ES", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    })}`;
}

function PhaseCard({phase}) {
    return (
        <article style={styles.card}>
            <div style={styles.cardKicker}>{buildCompetitionPhaseLabel(phase)}</div>
            <h3 style={styles.cardTitle}>{phase.wins}-{phase.losses}{phase.ties ? `-${phase.ties}` : ""}</h3>

            <div style={styles.metrics}>
                <div style={styles.metric}>
                    <div style={styles.metricLabel}>Partidos</div>
                    <div style={styles.metricValue}>{phase.matches}</div>
                </div>

                <div style={styles.metric}>
                    <div style={styles.metricLabel}>Puntos a favor</div>
                    <div style={styles.metricValue}>{formatNumber(phase.avgPointsFor)} pts</div>
                </div>

                <div style={styles.metric}>
                    <div style={styles.metricLabel}>Puntos en contra</div>
                    <div style={styles.metricValue}>{formatNumber(phase.avgPointsAgainst)} pts</div>
                </div>

                <div style={styles.metric}>
                    <div style={styles.metricLabel}>Valoración</div>
                    <div style={styles.metricValue}>{formatNumber(phase.avgValuation)} val</div>
                </div>
            </div>
        </article>
    );
}

function PhaseComparisonSection({phaseSummaries, comparison}) {
    if (!phaseSummaries?.length) {
        return null;
    }

    return (
        <section style={styles.section}>
            <div style={styles.header}>
                <div style={styles.eyebrow}>Comparativa</div>
                <h2 style={styles.title}>Cómo cambia el equipo de una fase a otra</h2>
                <p style={styles.subtitle}>
                    Una lectura rápida para ver si el equipo mejora en balance, anotación y valoración conforme avanza la temporada.
                </p>
            </div>

            <div style={styles.grid}>
                {phaseSummaries.map((phase) => (
                    <PhaseCard key={phase.phaseKey ?? `${phase.phaseNumber}-${phase.sourcePhaseId ?? "none"}`} phase={phase}/>
                ))}
            </div>

            {comparison ? (
                <div style={styles.deltaBar}>
                    <div style={styles.deltaCard}>
                        <div style={styles.deltaLabel}>Victorias</div>
                        <div style={styles.deltaValue}>{formatSigned(comparison.winsDelta, 0)}</div>
                    </div>

                    <div style={styles.deltaCard}>
                        <div style={styles.deltaLabel}>Puntos por partido</div>
                        <div style={styles.deltaValue}>{formatSigned(comparison.avgPointsDelta)}</div>
                    </div>

                    <div style={styles.deltaCard}>
                        <div style={styles.deltaLabel}>Valoración media</div>
                        <div style={styles.deltaValue}>{formatSigned(comparison.avgValuationDelta)}</div>
                    </div>

                    <div style={styles.deltaCard}>
                        <div style={styles.deltaLabel}>Diferencial</div>
                        <div style={styles.deltaValue}>{formatSigned(comparison.pointDiffDelta, 0)}</div>
                    </div>
                </div>
            ) : (
                <div style={styles.emptyState}>
                    Hace falta más de una fase para poder comparar la evolución del equipo.
                </div>
            )}
        </section>
    );
}

export default PhaseComparisonSection;
