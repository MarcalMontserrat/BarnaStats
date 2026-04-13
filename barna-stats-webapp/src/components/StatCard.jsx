const cardStyles = {
    root: {
        background: "#fff",
        padding: 20,
        borderRadius: 12,
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        textAlign: "center",
        minWidth: 180,
        transition: "transform 0.2s"
    },
    title: {
        fontSize: 14,
        color: "#888"
    },
    value: {
        fontSize: 28,
        fontWeight: "bold",
        margin: "10px 0"
    },
    subtitle: {
        fontSize: 12,
        color: "#555"
    }
};

function StatCard({title, value, subtitle}) {
    return (
        <div style={cardStyles.root}>
            <div style={cardStyles.title}>{title}</div>
            <div style={cardStyles.value}>{value}</div>
            {subtitle ? (
                <div style={cardStyles.subtitle}>{subtitle}</div>
            ) : null}
        </div>
    );
}

export default StatCard;
