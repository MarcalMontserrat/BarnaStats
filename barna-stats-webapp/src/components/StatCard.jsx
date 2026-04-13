const toneMap = {
    ember: {
        background: "linear-gradient(160deg, rgba(255, 245, 239, 0.95) 0%, rgba(252, 226, 215, 0.95) 100%)",
        borderColor: "rgba(188, 63, 43, 0.18)",
        accent: "var(--accent)"
    },
    ink: {
        background: "linear-gradient(160deg, rgba(28, 42, 63, 0.96) 0%, rgba(35, 58, 90, 0.96) 100%)",
        borderColor: "rgba(26, 53, 87, 0.32)",
        accent: "#f6efe3",
        inverse: true
    },
    gold: {
        background: "linear-gradient(160deg, rgba(255, 248, 230, 0.96) 0%, rgba(248, 230, 182, 0.96) 100%)",
        borderColor: "rgba(211, 159, 52, 0.24)",
        accent: "#8b5b09"
    },
    mint: {
        background: "linear-gradient(160deg, rgba(242, 250, 242, 0.96) 0%, rgba(219, 236, 220, 0.96) 100%)",
        borderColor: "rgba(91, 122, 96, 0.22)",
        accent: "var(--mint)"
    }
};

const cardStyles = {
    root: {
        position: "relative",
        display: "grid",
        gap: 14,
        minHeight: 172,
        padding: 22,
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-md)",
        border: "1px solid transparent",
        overflow: "hidden"
    },
    aura: {
        position: "absolute",
        width: 120,
        height: 120,
        borderRadius: "50%",
        right: -28,
        top: -32,
        background: "radial-gradient(circle, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0) 72%)",
        pointerEvents: "none"
    },
    title: {
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        fontWeight: 800,
        opacity: 0.78
    },
    value: {
        fontFamily: "var(--font-display)",
        fontSize: "clamp(1.8rem, 2vw, 2.5rem)",
        lineHeight: 0.95
    },
    subtitle: {
        fontSize: 13,
        lineHeight: 1.5,
        opacity: 0.78
    }
};

function StatCard({title, value, subtitle, tone = "ember"}) {
    const theme = toneMap[tone] ?? toneMap.ember;

    return (
        <div
            style={{
                ...cardStyles.root,
                background: theme.background,
                borderColor: theme.borderColor,
                color: theme.inverse ? "#f8f2e9" : "var(--text)"
            }}
        >
            <div style={cardStyles.aura}/>
            <div style={{...cardStyles.title, color: theme.accent}}>
                {title}
            </div>
            <div style={cardStyles.value}>{value}</div>
            {subtitle ? (
                <div style={cardStyles.subtitle}>{subtitle}</div>
            ) : null}
        </div>
    );
}

export default StatCard;
