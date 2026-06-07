const footerStyles = {
    footer: {
        marginTop: 40,
        paddingTop: 24,
        paddingBottom: 8,
        borderTop: "1px solid rgba(107, 86, 58, 0.14)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 8,
        color: "var(--muted)",
        fontSize: 13
    },
    left: {
        display: "flex",
        alignItems: "center",
        gap: 6
    },
    disclaimer: {
        opacity: 0.7
    }
};

export default function Footer() {
    const year = new Date().getFullYear();

    return (
        <footer style={footerStyles.footer}>
            <span style={footerStyles.left}>
                © {year} Marçal Montserrat
            </span>
            <span style={footerStyles.disclaimer}>Proyecto personal. No oficial.</span>
        </footer>
    );
}
