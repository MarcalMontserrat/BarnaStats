import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from "recharts";
import PrettySelect from "./PrettySelect.jsx";

const styles = {
    panel: {
        display: "grid",
        gap: 18,
        padding: "24px clamp(18px, 3vw, 30px)",
        borderRadius: "var(--radius-xl)",
        background: "linear-gradient(180deg, rgba(255, 252, 247, 0.92) 0%, rgba(251, 245, 237, 0.88) 100%)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-md)",
        animation: "fade-up 900ms ease both"
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
        fontSize: "clamp(1.8rem, 2.4vw, 2.4rem)"
    },
    subtitle: {
        color: "var(--muted)",
        maxWidth: 680,
        lineHeight: 1.6
    },
    controls: {
        display: "flex",
        gap: 16,
        flexWrap: "wrap"
    },
    summaryGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: 12
    },
    summaryCard: {
        display: "grid",
        gap: 5,
        padding: "14px 16px",
        borderRadius: "var(--radius-md)",
        background: "linear-gradient(180deg, rgba(255, 250, 241, 0.94) 0%, rgba(247, 239, 227, 0.88) 100%)",
        border: "1px solid rgba(107, 86, 58, 0.12)"
    },
    summaryLabel: {
        color: "var(--muted)",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase"
    },
    summaryValue: {
        fontFamily: "var(--font-display)",
        fontSize: "1.55rem",
        lineHeight: 0.95
    },
    summaryMeta: {
        color: "var(--muted)",
        fontSize: 13
    },
    chartShell: {
        height: 340,
        padding: "12px 12px 4px",
        borderRadius: "var(--radius-lg)",
        background: "linear-gradient(180deg, rgba(250, 238, 222, 0.62) 0%, rgba(255, 251, 245, 0.88) 100%)",
        border: "1px solid rgba(107, 86, 58, 0.1)"
    },
    emptyState: {
        padding: "22px 18px",
        borderRadius: "var(--radius-lg)",
        background: "rgba(245, 236, 224, 0.8)",
        border: "1px dashed rgba(107, 86, 58, 0.22)",
        color: "var(--muted)"
    }
};

function formatMetric(value, digits = 1) {
    return Number(value ?? 0).toLocaleString("es-ES", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    });
}

function formatShotLine(made, attempted) {
    return `${Number(made ?? 0)}/${Number(attempted ?? 0)}`;
}

function PlayerEvolutionSection({
    playersList,
    selectedPlayer,
    onSelectedPlayerChange,
    chartData,
    selectedPlayerSummary
}) {
    return (
        <section style={styles.panel}>
            <div style={styles.header}>
                <div style={styles.eyebrow}>Seguimiento</div>
                <h2 style={styles.title}>Evolución por jugadora</h2>
                <p style={styles.subtitle}>
                    Sigue la progresión de puntos y valoración a lo largo de la temporada o de la fase filtrada.
                </p>
            </div>

            <div style={styles.controls}>
                <PrettySelect
                    label="Jugadora"
                    value={selectedPlayer}
                    onChange={(event) => onSelectedPlayerChange(event.target.value)}
                    ariaLabel="Selecciona jugadora"
                    minWidth="340px"
                >
                    <option value="">Selecciona jugadora</option>
                    {playersList.map((name) => (
                        <option key={name} value={name}>
                            {name}
                        </option>
                    ))}
                </PrettySelect>
            </div>

            {selectedPlayer ? (
                <>
                    {selectedPlayerSummary ? (
                        <div style={styles.summaryGrid}>
                            <div style={styles.summaryCard}>
                                <div style={styles.summaryLabel}>Partidos</div>
                                <div style={styles.summaryValue}>{selectedPlayerSummary.games}</div>
                                <div style={styles.summaryMeta}>Encuentros en el tramo visible.</div>
                            </div>

                            <div style={styles.summaryCard}>
                                <div style={styles.summaryLabel}>Puntos</div>
                                <div style={styles.summaryValue}>{selectedPlayerSummary.points}</div>
                                <div style={styles.summaryMeta}>{formatMetric(selectedPlayerSummary.avgPoints)} por partido.</div>
                            </div>

                            <div style={styles.summaryCard}>
                                <div style={styles.summaryLabel}>Valoración</div>
                                <div style={styles.summaryValue}>{selectedPlayerSummary.valuation}</div>
                                <div style={styles.summaryMeta}>{formatMetric(selectedPlayerSummary.avgValuation)} de media.</div>
                            </div>

                            <div style={styles.summaryCard}>
                                <div style={styles.summaryLabel}>Minutos</div>
                                <div style={styles.summaryValue}>{selectedPlayerSummary.minutes}</div>
                                <div style={styles.summaryMeta}>{formatMetric(selectedPlayerSummary.avgMinutes)} por partido.</div>
                            </div>

                            <div style={styles.summaryCard}>
                                <div style={styles.summaryLabel}>Tope de puntos</div>
                                <div style={styles.summaryValue}>{selectedPlayerSummary.bestPointsGame}</div>
                                <div style={styles.summaryMeta}>Mejor partido en anotación.</div>
                            </div>

                            <div style={styles.summaryCard}>
                                <div style={styles.summaryLabel}>Tope de valoración</div>
                                <div style={styles.summaryValue}>{selectedPlayerSummary.bestValuationGame}</div>
                                <div style={styles.summaryMeta}>Mejor partido en valoración.</div>
                            </div>

                            <div style={styles.summaryCard}>
                                <div style={styles.summaryLabel}>TL</div>
                                <div style={styles.summaryValue}>
                                    {formatShotLine(selectedPlayerSummary.ftMade, selectedPlayerSummary.ftAttempted)}
                                </div>
                                <div style={styles.summaryMeta}>{formatMetric(selectedPlayerSummary.ftPercentage)}% acierto.</div>
                            </div>

                            <div style={styles.summaryCard}>
                                <div style={styles.summaryLabel}>T2</div>
                                <div style={styles.summaryValue}>
                                    {formatShotLine(selectedPlayerSummary.twoMade, selectedPlayerSummary.twoAttempted)}
                                </div>
                                <div style={styles.summaryMeta}>{formatMetric(selectedPlayerSummary.twoPercentage)}% acierto.</div>
                            </div>

                            <div style={styles.summaryCard}>
                                <div style={styles.summaryLabel}>T3</div>
                                <div style={styles.summaryValue}>
                                    {formatShotLine(selectedPlayerSummary.threeMade, selectedPlayerSummary.threeAttempted)}
                                </div>
                                <div style={styles.summaryMeta}>{formatMetric(selectedPlayerSummary.threePercentage)}% acierto.</div>
                            </div>
                        </div>
                    ) : null}

                    <div style={styles.chartShell}>
                        <ResponsiveContainer>
                            <LineChart data={chartData} margin={{top: 18, right: 20, left: -8, bottom: 6}}>
                                <CartesianGrid stroke="rgba(107, 86, 58, 0.12)" vertical={false} strokeDasharray="4 6"/>
                                <XAxis
                                    dataKey="match"
                                    tick={{fill: "#6d665c", fontSize: 12}}
                                    tickLine={false}
                                    axisLine={{stroke: "rgba(107, 86, 58, 0.18)"}}
                                />
                                <YAxis
                                    tick={{fill: "#6d665c", fontSize: 12}}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: 16,
                                        border: "1px solid rgba(107, 86, 58, 0.14)",
                                        background: "rgba(255, 251, 245, 0.96)",
                                        boxShadow: "var(--shadow-sm)"
                                    }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="points"
                                    name="Puntos"
                                    stroke="var(--accent)"
                                    strokeWidth={3}
                                    dot={{r: 3, fill: "var(--accent)"}}
                                    activeDot={{r: 6, fill: "var(--accent-strong)"}}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="valuation"
                                    name="Valoracion"
                                    stroke="var(--navy)"
                                    strokeWidth={3}
                                    dot={{r: 3, fill: "var(--navy)"}}
                                    activeDot={{r: 6, fill: "var(--navy)"}}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </>
            ) : (
                <div style={styles.emptyState}>
                    Elige una jugadora para ver su curva de partido a partido.
                </div>
            )}
        </section>
    );
}

export default PlayerEvolutionSection;
