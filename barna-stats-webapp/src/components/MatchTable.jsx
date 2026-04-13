const tableStyles = {
    shell: {
        marginTop: 14,
        overflowX: "auto",
        borderRadius: "var(--radius-lg)",
        border: "1px solid rgba(26, 53, 87, 0.1)",
        boxShadow: "var(--shadow-sm)"
    },
    table: {
        width: "100%",
        minWidth: 620,
        borderCollapse: "collapse",
        background: "rgba(255, 252, 247, 0.96)"
    },
    headRow: {
        background: "linear-gradient(135deg, #172c47 0%, #234569 100%)"
    },
    headerCell: {
        padding: "14px 16px",
        textAlign: "left",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#f7efe4"
    },
    bodyCell: {
        padding: "14px 16px",
        fontSize: 14,
        borderBottom: "1px solid rgba(107, 86, 58, 0.08)"
    },
    medal: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 28,
        height: 28,
        borderRadius: 999,
        background: "rgba(188, 63, 43, 0.12)",
        marginLeft: 8,
        fontSize: 13
    },
    pointsBadge: {
        display: "inline-flex",
        alignItems: "center",
        minHeight: 32,
        padding: "0 10px",
        borderRadius: 999,
        background: "rgba(188, 63, 43, 0.12)",
        color: "var(--accent-strong)",
        fontWeight: 800
    }
};

function MatchTable({players}) {
    const sortedPlayers = [...players].sort((a, b) => b.points - a.points);

    return (
        <div style={tableStyles.shell}>
            <table style={tableStyles.table}>
                <thead>
                <tr style={tableStyles.headRow}>
                    <th style={tableStyles.headerCell}>Jugadora</th>
                    <th style={tableStyles.headerCell}>Dorsal</th>
                    <th style={tableStyles.headerCell}>Pts</th>
                    <th style={tableStyles.headerCell}>Min</th>
                    <th style={tableStyles.headerCell}>Val</th>
                </tr>
                </thead>

                <tbody>
                {sortedPlayers.map((player, index) => {
                    const medals = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "";
                    const rowBackground = index === 0
                        ? "rgba(255, 239, 210, 0.72)"
                        : index % 2 === 0
                            ? "rgba(255, 252, 247, 0.96)"
                            : "rgba(249, 243, 236, 0.86)";

                    return (
                        <tr
                            key={`${player.matchWebId}-${player.playerName}-${index}`}
                            style={{background: rowBackground}}
                        >
                            <td style={tableStyles.bodyCell}>{player.playerName}</td>
                            <td style={tableStyles.bodyCell}>{player.dorsal}</td>
                            <td style={tableStyles.bodyCell}>
                                <span style={tableStyles.pointsBadge}>
                                    {player.points}
                                    {medals ? <span style={tableStyles.medal}>{medals}</span> : null}
                                </span>
                            </td>
                            <td style={tableStyles.bodyCell}>{player.minutes}</td>
                            <td style={tableStyles.bodyCell}>{player.valuation}</td>
                        </tr>
                    );
                })}
                </tbody>
            </table>
        </div>
    );
}

export default MatchTable;
