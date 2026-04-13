const tableStyles = {
    table: {
        width: "100%",
        borderCollapse: "collapse",
        background: "#fff",
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
    },
    headRow: {
        background: "#f0f0f0"
    },
    headerCell: {
        padding: 10,
        textAlign: "left",
        fontSize: 14
    },
    bodyCell: {
        padding: 10,
        fontSize: 14
    }
};

function MatchTable({players}) {
    const sortedPlayers = [...players].sort((a, b) => b.points - a.points);

    return (
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

                return (
                    <tr
                        key={`${player.matchWebId}-${player.playerName}-${index}`}
                        style={{
                            background: index % 2 === 0 ? "#fafafa" : "#fff"
                        }}
                    >
                        <td style={tableStyles.bodyCell}>{player.playerName}</td>
                        <td style={tableStyles.bodyCell}>{player.dorsal}</td>
                        <td style={tableStyles.bodyCell}>
                            {player.points} {medals}
                        </td>
                        <td style={tableStyles.bodyCell}>{player.minutes}</td>
                        <td style={tableStyles.bodyCell}>{player.valuation}</td>
                    </tr>
                );
            })}
            </tbody>
        </table>
    );
}

export default MatchTable;
