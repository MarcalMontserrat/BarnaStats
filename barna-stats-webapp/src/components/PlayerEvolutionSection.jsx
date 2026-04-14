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

function PlayerEvolutionSection({
    playersList,
    selectedPlayer,
    onSelectedPlayerChange,
    chartData
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
            ) : (
                <div style={styles.emptyState}>
                    Elige una jugadora para ver su curva de partido a partido.
                </div>
            )}
        </section>
    );
}

export default PlayerEvolutionSection;
