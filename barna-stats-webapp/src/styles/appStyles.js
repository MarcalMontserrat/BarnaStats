const appStyles = {
    page: {
        position: "relative",
        minHeight: "100vh",
        overflow: "hidden",
        padding: "clamp(18px, 3vw, 34px)"
    },
    glowPrimary: {
        position: "absolute",
        top: -120,
        left: -80,
        width: 340,
        height: 340,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(188, 63, 43, 0.22) 0%, rgba(188, 63, 43, 0) 72%)",
        filter: "blur(8px)",
        animation: "float-glow 8s ease-in-out infinite alternate",
        pointerEvents: "none"
    },
    glowSecondary: {
        position: "absolute",
        right: -100,
        top: 80,
        width: 360,
        height: 360,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(26, 53, 87, 0.18) 0%, rgba(26, 53, 87, 0) 72%)",
        filter: "blur(10px)",
        animation: "float-glow 10s ease-in-out infinite alternate-reverse",
        pointerEvents: "none"
    },
    container: {
        position: "relative",
        zIndex: 1,
        maxWidth: 1280,
        margin: "0 auto",
        display: "grid",
        gap: 24
    },
    topBar: {
        display: "grid",
        gap: 18,
        animation: "fade-up 650ms ease both"
    },
    topBarActions: {
        display: "grid",
        justifyItems: "start"
    },
    brand: {
        display: "grid",
        gap: 6
    },
    eyebrow: {
        color: "var(--accent)",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        margin: 0
    },
    brandTitle: {
        fontSize: "clamp(2rem, 4vw, 3.3rem)",
        lineHeight: 0.95
    },
    brandNote: {
        color: "var(--muted)",
        maxWidth: 540,
        fontSize: 15
    },
    nav: {
        display: "flex",
        gap: 10,
        flexWrap: "wrap"
    },
    navLink: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 44,
        padding: "0 18px",
        borderRadius: 999,
        textDecoration: "none",
        fontWeight: 800,
        border: "1px solid rgba(26, 53, 87, 0.14)",
        color: "var(--navy)",
        background: "rgba(255, 251, 245, 0.78)",
        boxShadow: "var(--shadow-sm)",
        backdropFilter: "blur(10px)"
    },
    navLinkActive: {
        background: "linear-gradient(135deg, #1a3557 0%, #2d567b 100%)",
        borderColor: "transparent",
        color: "#fff"
    },
    hero: {
        display: "grid",
        gap: 22,
        padding: "clamp(20px, 4vw, 34px)",
        borderRadius: "var(--radius-xl)",
        background: "linear-gradient(135deg, rgba(19, 32, 51, 0.96) 0%, rgba(53, 28, 34, 0.92) 54%, rgba(143, 44, 29, 0.9) 100%)",
        color: "#fff7ef",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "0 28px 70px rgba(22, 18, 15, 0.22)",
        overflow: "hidden",
        position: "relative",
        animation: "fade-up 720ms ease both"
    },
    heroPattern: {
        position: "absolute",
        inset: 0,
        background: "linear-gradient(120deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 24%), repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 72px)",
        pointerEvents: "none"
    },
    heroContent: {
        position: "relative",
        zIndex: 1,
        display: "grid",
        gap: 20
    },
    heroHeader: {
        display: "grid",
        gap: 10
    },
    heroIdentity: {
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1fr)",
        gap: 18,
        alignItems: "center"
    },
    heroIdentityText: {
        display: "grid",
        gap: 10,
        minWidth: 0
    },
    heroKicker: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 999,
        background: "rgba(255, 248, 238, 0.12)",
        width: "fit-content",
        fontSize: 12,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        fontWeight: 800
    },
    heroTitle: {
        fontSize: "clamp(2.3rem, 4vw, 4.2rem)",
        lineHeight: 0.95,
        color: "#fff7ef"
    },
    heroSummary: {
        color: "rgba(255, 243, 227, 0.82)",
        fontSize: 16,
        maxWidth: 760
    },
    heroMetaRow: {
        display: "flex",
        gap: 10,
        flexWrap: "wrap"
    },
    metaChip: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 14px",
        borderRadius: 999,
        background: "rgba(255, 248, 238, 0.1)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        color: "#fff8f0",
        fontSize: 13,
        fontWeight: 700
    },
    filterDeck: {
        display: "flex",
        gap: 14,
        flexWrap: "wrap"
    },
    teamSelectorSection: {
        position: "relative",
        zIndex: 6,
        display: "grid",
        gap: 18,
        padding: "clamp(20px, 4vw, 30px)",
        borderRadius: "var(--radius-xl)",
        background: "linear-gradient(160deg, rgba(255, 252, 247, 0.92) 0%, rgba(247, 238, 225, 0.94) 100%)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-md)",
        animation: "fade-up 700ms ease both"
    },
    teamSelectorHeader: {
        display: "grid",
        gap: 10,
        maxWidth: 780
    },
    teamSelectorTitle: {
        fontSize: "clamp(1.9rem, 3vw, 2.8rem)"
    },
    teamSelectorBody: {
        color: "var(--muted)",
        lineHeight: 1.6
    },
    teamSelectorMetaRow: {
        display: "flex",
        gap: 10,
        flexWrap: "wrap"
    },
    teamSelectorChip: {
        display: "inline-flex",
        alignItems: "center",
        minHeight: 38,
        padding: "0 14px",
        borderRadius: 999,
        background: "rgba(255, 250, 243, 0.96)",
        border: "1px solid rgba(107, 86, 58, 0.14)",
        color: "var(--navy)",
        fontSize: 13,
        fontWeight: 700
    },
    heroActions: {
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "flex-end",
        gap: 16,
        flexWrap: "wrap"
    },
    teamScopeSection: {
        display: "grid",
        gap: 16,
        padding: "clamp(18px, 3vw, 26px)",
        borderRadius: "var(--radius-xl)",
        background: "linear-gradient(180deg, rgba(255, 251, 245, 0.9) 0%, rgba(248, 240, 229, 0.92) 100%)",
        border: "1px solid rgba(107, 86, 58, 0.14)",
        boxShadow: "var(--shadow-md)",
        animation: "fade-up 760ms ease both"
    },
    teamScopeHeader: {
        display: "grid",
        gap: 8,
        maxWidth: 760
    },
    teamScopeTitle: {
        fontSize: "clamp(1.5rem, 2.4vw, 2rem)"
    },
    teamScopeBody: {
        color: "var(--muted)",
        lineHeight: 1.6
    },
    teamScopeActions: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        gap: 16,
        flexWrap: "wrap"
    },
    teamScopeMetaRow: {
        display: "flex",
        gap: 10,
        flexWrap: "wrap"
    },
    teamScopeChip: {
        display: "inline-flex",
        alignItems: "center",
        minHeight: 38,
        padding: "0 14px",
        borderRadius: 999,
        background: "rgba(255, 251, 245, 0.94)",
        border: "1px solid rgba(107, 86, 58, 0.14)",
        color: "var(--navy)",
        fontSize: 13,
        fontWeight: 700
    },
    emptyState: {
        background: "linear-gradient(180deg, rgba(255, 252, 247, 0.92) 0%, rgba(252, 246, 239, 0.88) 100%)",
        padding: 28,
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-md)",
        border: "1px solid var(--border)",
        color: "var(--muted)"
    },
    loadingCard: {
        padding: 24,
        borderRadius: "var(--radius-lg)",
        background: "rgba(255, 251, 245, 0.86)",
        border: "1px solid rgba(107, 86, 58, 0.12)",
        boxShadow: "var(--shadow-sm)",
        color: "var(--muted)"
    },
    syncPage: {
        display: "grid",
        gap: 18,
        animation: "fade-up 720ms ease both"
    },
    syncIntro: {
        display: "grid",
        gap: 12,
        padding: "clamp(20px, 4vw, 30px)",
        borderRadius: "var(--radius-xl)",
        background: "linear-gradient(160deg, rgba(255, 252, 247, 0.9) 0%, rgba(249, 239, 226, 0.92) 100%)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-md)"
    },
    syncEyebrow: {
        color: "var(--accent)",
        fontSize: 12,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.16em"
    },
    syncTitle: {
        fontSize: "clamp(2rem, 3vw, 3.2rem)"
    },
    syncBody: {
        maxWidth: 760,
        color: "var(--muted)",
        lineHeight: 1.6
    },
    secondaryLink: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 44,
        padding: "0 18px",
        borderRadius: 999,
        textDecoration: "none",
        fontWeight: 800,
        color: "#fff8f0",
        background: "rgba(255, 248, 238, 0.12)",
        border: "1px solid rgba(255, 255, 255, 0.16)",
        backdropFilter: "blur(10px)"
    },
    pageShell: {
        display: "grid",
        gap: 18,
        animation: "fade-up 720ms ease both"
    },
    competitionTabs: {
        display: "grid",
        gap: 12
    },
    competitionTabRow: {
        display: "flex",
        gap: 10,
        flexWrap: "wrap"
    },
    competitionTab: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 44,
        padding: "0 18px",
        borderRadius: 999,
        border: "1px solid rgba(26, 53, 87, 0.12)",
        background: "rgba(255, 251, 245, 0.86)",
        color: "var(--navy)",
        fontWeight: 800,
        cursor: "pointer",
        boxShadow: "var(--shadow-sm)"
    },
    competitionTabActive: {
        background: "linear-gradient(135deg, #1a3557 0%, #2d567b 100%)",
        borderColor: "transparent",
        color: "#fff7ef"
    },
    competitionTabHint: {
        color: "var(--muted)",
        fontSize: 14,
        lineHeight: 1.6
    },
    seasonCards: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
        gap: 18
    },
    seasonCard: {
        display: "grid",
        gap: 18,
        padding: "22px 20px",
        borderRadius: "var(--radius-xl)",
        background: "linear-gradient(180deg, rgba(255, 252, 247, 0.94) 0%, rgba(248, 240, 229, 0.94) 100%)",
        border: "1px solid rgba(107, 86, 58, 0.14)",
        boxShadow: "var(--shadow-md)"
    },
    seasonCardHeader: {
        display: "grid",
        gap: 8
    },
    seasonCardIdentity: {
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1fr)",
        gap: 14,
        alignItems: "center"
    },
    seasonCardIdentityText: {
        display: "grid",
        gap: 8,
        minWidth: 0
    },
    seasonCardEyebrow: {
        color: "var(--accent)",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.12em",
        textTransform: "uppercase"
    },
    seasonCardTitle: {
        fontSize: "clamp(1.55rem, 2vw, 2rem)"
    },
    seasonCardMeta: {
        color: "var(--muted)",
        fontSize: 14,
        lineHeight: 1.6
    },
    seasonMetricsGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))",
        gap: 12
    },
    seasonMetricCard: {
        display: "grid",
        gap: 6,
        padding: "14px 16px",
        borderRadius: "var(--radius-md)",
        background: "rgba(255, 251, 245, 0.94)",
        border: "1px solid rgba(107, 86, 58, 0.1)"
    },
    seasonMetricLabel: {
        color: "var(--muted)",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase"
    },
    seasonMetricValue: {
        fontFamily: "var(--font-display)",
        fontSize: "1.65rem",
        lineHeight: 0.95
    },
    seasonMetricMeta: {
        color: "var(--muted)",
        fontSize: 13
    },
    aggregateGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
        gap: 14
    },
    pageBackLink: {
        display: "inline-flex",
        alignItems: "center",
        width: "fit-content",
        minHeight: 40,
        padding: "0 16px",
        borderRadius: 999,
        textDecoration: "none",
        color: "var(--navy)",
        background: "rgba(255, 251, 245, 0.86)",
        border: "1px solid rgba(26, 53, 87, 0.12)",
        boxShadow: "var(--shadow-sm)",
        fontWeight: 800
    },
    playerTeamButton: {
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        textAlign: "left",
        color: "var(--accent-strong)",
        fontSize: 14,
        fontWeight: 700,
        lineHeight: 1.4
    }
};

export default appStyles;
