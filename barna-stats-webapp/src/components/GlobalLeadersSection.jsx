import PrettySelect from "./PrettySelect.jsx";

const styles = {
    section: {
        display: "grid",
        gap: 20,
        padding: "24px clamp(18px, 3vw, 30px)",
        borderRadius: "var(--radius-xl)",
        background: "linear-gradient(180deg, rgba(255, 252, 247, 0.92) 0%, rgba(248, 242, 232, 0.9) 100%)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-md)",
        animation: "fade-up 860ms ease both"
    },
    header: {
        display: "grid",
        gap: 16
    },
    headerTop: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 16,
        flexWrap: "wrap"
    },
    titleBlock: {
        display: "grid",
        gap: 10,
        minWidth: "min(100%, 540px)"
    },
    eyebrow: {
        color: "var(--accent)",
        fontSize: 12,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.12em"
    },
    title: {
        fontSize: "clamp(1.85rem, 2.6vw, 2.7rem)"
    },
    subtitle: {
        color: "var(--muted)",
        maxWidth: 760,
        lineHeight: 1.6
    },
    metaRow: {
        display: "flex",
        gap: 10,
        flexWrap: "wrap"
    },
    controlBlock: {
        display: "grid",
        gap: 8,
        justifyItems: "end",
        flex: "0 0 auto"
    },
    controlHint: {
        color: "var(--muted)",
        fontSize: 12,
        fontWeight: 700
    },
    metaChip: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 13px",
        borderRadius: 999,
        background: "rgba(255, 249, 242, 0.9)",
        border: "1px solid rgba(107, 86, 58, 0.14)",
        color: "var(--navy)",
        fontSize: 13,
        fontWeight: 700
    },
    boards: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: 18
    },
    board: {
        display: "grid",
        gap: 16,
        padding: 20,
        borderRadius: "var(--radius-lg)",
        background: "linear-gradient(180deg, rgba(255, 255, 255, 0.84) 0%, rgba(249, 242, 233, 0.92) 100%)",
        border: "1px solid rgba(107, 86, 58, 0.12)"
    },
    boardHeader: {
        display: "grid",
        gap: 6
    },
    boardKicker: {
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        fontWeight: 800
    },
    boardTitle: {
        fontFamily: "var(--font-display)",
        fontSize: "1.65rem",
        lineHeight: 1
    },
    boardSubtitle: {
        fontSize: 14,
        color: "var(--muted)",
        lineHeight: 1.5
    },
    rows: {
        display: "grid",
        gap: 10
    },
    row: {
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1fr) auto",
        gap: 14,
        alignItems: "center",
        padding: "14px 16px",
        borderRadius: "var(--radius-md)",
        background: "rgba(255, 251, 245, 0.9)",
        border: "1px solid rgba(107, 86, 58, 0.1)"
    },
    rank: {
        width: 34,
        height: 34,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        fontWeight: 800,
        fontSize: 13,
        background: "rgba(26, 53, 87, 0.1)",
        color: "var(--navy)"
    },
    playerBlock: {
        display: "grid",
        gap: 5,
        minWidth: 0
    },
    playerName: {
        fontWeight: 800,
        fontSize: 15
    },
    teamMeta: {
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        alignItems: "center"
    },
    teamBadge: {
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        background: "rgba(188, 63, 43, 0.08)",
        color: "var(--accent-strong)",
        fontSize: 12,
        fontWeight: 800,
        border: "none",
        cursor: "pointer"
    },
    gamesMeta: {
        color: "var(--muted)",
        fontSize: 12,
        fontWeight: 700
    },
    statBlock: {
        display: "grid",
        gap: 2,
        justifyItems: "end",
        textAlign: "right"
    },
    statValue: {
        fontFamily: "var(--font-display)",
        fontSize: "1.7rem",
        lineHeight: 0.9
    },
    statLabel: {
        color: "var(--muted)",
        fontSize: 12,
        fontWeight: 700
    },
    emptyState: {
        padding: "18px 16px",
        borderRadius: "var(--radius-lg)",
        background: "rgba(245, 236, 224, 0.8)",
        border: "1px dashed rgba(107, 86, 58, 0.2)",
        color: "var(--muted)"
    }
};

function formatMetric(value, digits = 1) {
    return Number(value ?? 0).toLocaleString("es-ES", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    });
}

function buildSecondaryText(player, metric) {
    if (metric === "avgValuation") {
        return `${player.valuation} val total · ${player.games} pj`;
    }

    return `${formatMetric(player.avgPoints, 1)} pts/partido · ${player.games} pj`;
}

function LeaderBoard({title, kicker, subtitle, rows, metric, accentColor, label, onTeamNavigate}) {
    return (
        <article style={styles.board}>
            <div style={styles.boardHeader}>
                <div style={{...styles.boardKicker, color: accentColor}}>{kicker}</div>
                <h3 style={styles.boardTitle}>{title}</h3>
                <p style={styles.boardSubtitle}>{subtitle}</p>
            </div>

            {rows.length > 0 ? (
                <div style={styles.rows}>
                    {rows.map((player, index) => (
                        <div key={player.key} style={styles.row}>
                            <div style={styles.rank}>#{index + 1}</div>

                            <div style={styles.playerBlock}>
                                <div style={styles.playerName}>{player.playerName}</div>
                                <div style={styles.teamMeta}>
                                    <button
                                        type="button"
                                        style={styles.teamBadge}
                                        onClick={() => onTeamNavigate?.(player.teamKey)}
                                    >
                                        {player.teamName}
                                    </button>
                                    <span style={styles.gamesMeta}>{player.games} partidos</span>
                                </div>
                            </div>

                            <div style={styles.statBlock}>
                                <div style={{...styles.statValue, color: accentColor}}>
                                    {metric === "avgValuation"
                                        ? formatMetric(player.avgValuation, 1)
                                        : player.points}
                                </div>
                                <div style={styles.statLabel}>{label}</div>
                                <div style={styles.gamesMeta}>{buildSecondaryText(player, metric)}</div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div style={styles.emptyState}>
                    Todavía no hay suficientes datos para construir este ranking.
                </div>
            )}
        </article>
    );
}

function GlobalLeadersSection({
    totalPlayers,
    totalTeams,
    leadersByAvgValuation,
    leadersByPoints,
    rankingMinGames,
    onRankingMinGamesChange,
    onTeamNavigate
}) {
    return (
        <section style={styles.section}>
            <div style={styles.header}>
                <div style={styles.headerTop}>
                    <div style={styles.titleBlock}>
                        <div style={styles.eyebrow}>Líderes individuales</div>
                        <h2 style={styles.title}>Jugadoras destacadas de la competición</h2>
                        <p style={styles.subtitle}>
                            Consulta de un vistazo quién lidera la valoración media y quién sostiene el mayor peso anotador,
                            con su equipo al lado para dar el contexto que importa.
                        </p>
                    </div>

                    <div style={styles.controlBlock}>
                        <PrettySelect
                            label="Mínimo de partidos"
                            value={rankingMinGames}
                            onChange={(event) => onRankingMinGamesChange(event.target.value)}
                            ariaLabel="Selecciona mínimo de partidos para el ranking"
                            minWidth="240px"
                        >
                            <option value="1">1 partido</option>
                            <option value="3">3 partidos</option>
                            <option value="5">5 partidos</option>
                        </PrettySelect>
                        <span style={styles.controlHint}>Este filtro solo afecta a los rankings de jugadoras.</span>
                    </div>
                </div>
            </div>

            <div style={styles.metaRow}>
                <span style={styles.metaChip}>{totalPlayers} jugadoras</span>
                <span style={styles.metaChip}>{totalTeams} equipos</span>
                <span style={styles.metaChip}>Clasificación general</span>
            </div>

            <div style={styles.boards}>
                <LeaderBoard
                    title="Mejor valoración media"
                    kicker="Impacto"
                    subtitle="Promedio de valoración por partido a lo largo de la temporada."
                    rows={leadersByAvgValuation}
                    metric="avgValuation"
                    accentColor="var(--accent)"
                    label="val media"
                    onTeamNavigate={onTeamNavigate}
                />

                <LeaderBoard
                    title="Máximas anotadoras"
                    kicker="Anotación"
                    subtitle="Puntos totales con el ritmo anotador por encuentro como referencia."
                    rows={leadersByPoints}
                    metric="points"
                    accentColor="var(--navy)"
                    label="pts totales"
                    onTeamNavigate={onTeamNavigate}
                />
            </div>
        </section>
    );
}

export default GlobalLeadersSection;
