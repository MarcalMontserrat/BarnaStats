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
        background: "#fff",
        padding: 20,
        borderRadius: 12,
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        marginBottom: 30
    },
    controls: {
        marginBottom: 18
    },
    chart: {
        width: "100%",
        height: 300
    }
};

function PlayerEvolutionSection({
    playersList,
    selectedPlayer,
    onSelectedPlayerChange,
    chartData
}) {
    return (
        <div style={styles.panel}>
            <h2 style={{marginBottom: 10}}>📈 Evolución Jugadora</h2>
            <div style={styles.controls}>
                <PrettySelect
                    label="Jugadora"
                    value={selectedPlayer}
                    onChange={(event) => onSelectedPlayerChange(event.target.value)}
                    ariaLabel="Selecciona jugadora"
                    minWidth="320px"
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
                <div style={styles.chart}>
                    <ResponsiveContainer>
                        <LineChart data={chartData}>
                            <CartesianGrid stroke="#ccc"/>
                            <XAxis dataKey="match"/>
                            <YAxis/>
                            <Tooltip/>
                            <Line type="monotone" dataKey="points" stroke="#8884d8"/>
                            <Line type="monotone" dataKey="valuation" stroke="#82ca9d"/>
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            ) : null}
        </div>
    );
}

export default PlayerEvolutionSection;
