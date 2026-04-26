const styles = {
    card: {
        marginTop: 12,
        background: "linear-gradient(180deg, rgba(255, 248, 236, 0.96) 0%, rgba(250, 238, 219, 0.9) 100%)",
        border: "1px solid rgba(211, 159, 52, 0.22)",
        borderRadius: "var(--radius-lg)",
        padding: 18,
        boxShadow: "var(--shadow-sm)"
    },
    title: {
        fontWeight: 800,
        marginBottom: 10,
        color: "#7b4b10",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        fontSize: 12
    },
    paragraph: {
        margin: "0 0 12px",
        lineHeight: 1.65,
        color: "#51473d"
    },
    list: {
        margin: "0 0 12px",
        paddingLeft: 20,
        color: "#51473d",
        lineHeight: 1.6
    },
    meta: {
        marginTop: 10,
        color: "#8b7355",
        fontSize: 12
    }
};

function MatchReportPanel({
    matchReport,
    matchReportGeneratedAtUtc,
    matchReportModel
}) {
    if (!matchReport) {
        return null;
    }

    const blocks = matchReport
        .split(/\n\s*\n/)
        .map((block) => block.trim())
        .filter(Boolean);

    return (
        <div style={styles.card}>
            <div style={styles.title}>Análisis del partido</div>
            {blocks.map((block, index) => {
                const lines = block
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean);
                const isBulletBlock = lines.every((line) => line.startsWith("- "));

                if (isBulletBlock) {
                    return (
                        <ul key={index} style={styles.list}>
                            {lines.map((line) => (
                                <li key={line}>{line.slice(2)}</li>
                            ))}
                        </ul>
                    );
                }

                return (
                    <p key={index} style={styles.paragraph}>
                        {block}
                    </p>
                );
            })}
            {matchReportGeneratedAtUtc ? (
                <div style={styles.meta}>
                    Generado: {new Date(matchReportGeneratedAtUtc).toLocaleString("es-ES")}
                    {matchReportModel ? ` · ${matchReportModel}` : ""}
                </div>
            ) : null}
        </div>
    );
}

export default MatchReportPanel;
