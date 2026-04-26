import AutocompleteField from "./AutocompleteField.jsx";

const styles = {
    section: {
        display: "grid",
        gap: 24,
        padding: "24px clamp(18px, 3vw, 30px)",
        borderRadius: "var(--radius-xl)",
        background: "linear-gradient(180deg, rgba(255, 252, 247, 0.92) 0%, rgba(248, 242, 232, 0.9) 100%)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-md)",
        animation: "fade-up 780ms ease both"
    },
    header: {
        display: "grid",
        gap: 10
    },
    eyebrow: {
        color: "var(--accent)",
        fontSize: 12,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.12em"
    },
    title: {
        fontSize: "clamp(1.9rem, 2.6vw, 2.8rem)"
    },
    subtitle: {
        color: "var(--muted)",
        maxWidth: 760,
        lineHeight: 1.6
    },
    selectorRow: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
        gap: 16,
        alignItems: "end"
    },
    comparisonGrid: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 18
    },
    playerCard: {
        display: "grid",
        gap: 14,
        padding: "clamp(16px, 3vw, 24px)",
        borderRadius: "var(--radius-lg)",
        background: "linear-gradient(135deg, rgba(19, 32, 51, 0.96) 0%, rgba(53, 28, 34, 0.92) 54%, rgba(143, 44, 29, 0.9) 100%)",
        color: "#fff7ef",
        border: "1px solid rgba(255, 255, 255, 0.08)"
    },
    playerName: {
        fontFamily: "var(--font-display)",
        fontSize: "clamp(1.4rem, 2vw, 2rem)",
        lineHeight: 1,
        overflowWrap: "anywhere"
    },
    playerMeta: {
        color: "rgba(255, 243, 227, 0.7)",
        fontSize: 13,
        lineHeight: 1.5
    },
    metricsGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 110px), 1fr))",
        gap: 10
    },
    metricCard: {
        display: "grid",
        gap: 6,
        padding: "12px",
        borderRadius: "var(--radius-md)",
        background: "rgba(255, 248, 238, 0.1)",
        border: "1px solid rgba(255, 255, 255, 0.08)"
    },
    metricLabel: {
        color: "rgba(255, 243, 227, 0.7)",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase"
    },
    metricValue: {
        fontFamily: "var(--font-display)",
        fontSize: "clamp(1.4rem, 2vw, 1.9rem)",
        lineHeight: 0.95,
        overflowWrap: "anywhere"
    },
    metricWinner: {
        color: "#ffd27d"
    },
    metricSub: {
        color: "rgba(255, 243, 227, 0.65)",
        fontSize: 11,
        lineHeight: 1.4
    },
    noPlayerCard: {
        display: "grid",
        gap: 12,
        padding: 24,
        borderRadius: "var(--radius-lg)",
        background: "rgba(255, 251, 245, 0.86)",
        border: "1px solid var(--border)",
        color: "var(--muted)",
        placeItems: "center",
        textAlign: "center",
        minHeight: 160
    },
    seasonSection: {
        display: "grid",
        gap: 8
    },
    seasonLabel: {
        color: "rgba(255, 243, 227, 0.7)",
        fontSize: 11,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.08em"
    },
    seasonRow: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr auto 1fr 1fr",
        gap: 8,
        alignItems: "center"
    }
};

function formatDecimal(value, digits = 1) {
    return Number(value ?? 0).toLocaleString("es-ES", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    });
}

function PlayerCard({player}) {
    if (!player) {
        return (
            <div style={styles.noPlayerCard}>
                <div>Selecciona una jugadora</div>
            </div>
        );
    }

    const totals = player.totals ?? null;

    if (!totals) {
        return (
            <div style={styles.noPlayerCard}>
                <div>Sin datos acumulados para esta jugadora.</div>
            </div>
        );
    }

    return (
        <div style={styles.playerCard}>
            <div>
                {player.latestShirtNumber ? (
                    <div style={styles.playerMeta}>#{player.latestShirtNumber}</div>
                ) : null}
                <div style={styles.playerName}>{player.label}</div>
                <div style={styles.playerMeta}>
                    {totals.seasons} temporada{totals.seasons === 1 ? "" : "s"} · {totals.games} partidos
                </div>
            </div>

            <div style={styles.metricsGrid}>
                <div style={styles.metricCard}>
                    <div style={styles.metricLabel}>Pts totales</div>
                    <div style={styles.metricValue}>{totals.points}</div>
                    <div style={styles.metricSub}>{formatDecimal(totals.avgPoints)} por partido</div>
                </div>

                <div style={styles.metricCard}>
                    <div style={styles.metricLabel}>Val total</div>
                    <div style={styles.metricValue}>{totals.valuation}</div>
                    <div style={styles.metricSub}>{formatDecimal(totals.avgValuation)} media</div>
                </div>

                <div style={styles.metricCard}>
                    <div style={styles.metricLabel}>Partidos</div>
                    <div style={styles.metricValue}>{totals.games}</div>
                    <div style={styles.metricSub}>{totals.seasons} temporada{totals.seasons === 1 ? "" : "s"}</div>
                </div>

                <div style={styles.metricCard}>
                    <div style={styles.metricLabel}>Faltas</div>
                    <div style={styles.metricValue}>{totals.fouls}</div>
                    <div style={styles.metricSub}>{formatDecimal(totals.avgFouls)} por partido</div>
                </div>

                {totals.minutes > 0 ? (
                    <div style={styles.metricCard}>
                        <div style={styles.metricLabel}>Minutos</div>
                        <div style={styles.metricValue}>{totals.minutes}</div>
                        <div style={styles.metricSub}>Acumulados</div>
                    </div>
                ) : null}
            </div>

            {player.seasonSummaries?.length > 0 ? (
                <div style={styles.seasonSection}>
                    <div style={styles.seasonLabel}>Por temporada</div>
                    {player.seasonSummaries.map((season) => (
                        <div key={season.key} style={{
                            display: "grid",
                            gridTemplateColumns: "auto 1fr auto auto auto",
                            gap: "6px 10px",
                            padding: "10px 12px",
                            borderRadius: "var(--radius-sm)",
                            background: "rgba(255, 248, 238, 0.08)",
                            border: "1px solid rgba(255, 255, 255, 0.06)",
                            fontSize: 13
                        }}>
                            <div style={{color: "rgba(255, 243, 227, 0.6)", fontWeight: 800, fontSize: 11}}>
                                {season.seasonLabel}
                            </div>
                            <div style={{color: "rgba(255, 243, 227, 0.85)", overflowWrap: "anywhere", fontSize: 12}}>
                                {season.teamNames?.[0] ?? season.primaryTeamName ?? ""}
                            </div>
                            <div style={{fontWeight: 800}}>{season.points}pts</div>
                            <div style={{color: "rgba(255, 243, 227, 0.75)"}}>val {season.valuation}</div>
                            <div style={{color: "rgba(255, 243, 227, 0.6)"}}>{season.games}p</div>
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

function PlayerCompareSection({
    playerOptions,
    playerQuery1,
    playerQuery2,
    onPlayer1QueryChange,
    onPlayer2QueryChange,
    onPlayer1Select,
    onPlayer2Select,
    selectedPlayer1,
    selectedPlayer2,
    loading
}) {
    if (loading) {
        return (
            <section style={styles.section}>
                <div style={styles.header}>
                    <div style={styles.eyebrow}>Comparativa de jugadoras</div>
                    <h2 style={styles.title}>Cargando archivo de jugadoras...</h2>
                </div>
            </section>
        );
    }

    const totals1 = selectedPlayer1?.totals ?? null;
    const totals2 = selectedPlayer2?.totals ?? null;

    const faceOffStats = totals1 && totals2
        ? [
            {label: "Puntos totales", v1: totals1.points, v2: totals2.points, higher: true},
            {label: "Pts/partido", v1: Number(totals1.avgPoints).toFixed(1), v2: Number(totals2.avgPoints).toFixed(1), higher: true, numeric: true},
            {label: "Valoración", v1: totals1.valuation, v2: totals2.valuation, higher: true},
            {label: "Val media", v1: Number(totals1.avgValuation).toFixed(1), v2: Number(totals2.avgValuation).toFixed(1), higher: true, numeric: true},
            {label: "Partidos", v1: totals1.games, v2: totals2.games, higher: true},
            {label: "Temporadas", v1: totals1.seasons, v2: totals2.seasons, higher: true}
        ]
        : [];

    return (
        <section style={styles.section}>
            <div style={styles.header}>
                <div style={styles.eyebrow}>Comparativa de jugadoras</div>
                <h2 style={styles.title}>Elige dos jugadoras y compara su trayectoria</h2>
                <p style={styles.subtitle}>
                    Busca dos jugadoras en el archivo histórico y compara sus estadísticas acumuladas y el rendimiento temporada a temporada.
                </p>
            </div>

            <div style={styles.selectorRow}>
                <AutocompleteField
                    label="Jugadora A"
                    value={playerQuery1}
                    onValueChange={onPlayer1QueryChange}
                    onSelectOption={onPlayer1Select}
                    options={playerOptions}
                    placeholder="Escribe el nombre de la jugadora"
                    ariaLabel="Busca la primera jugadora"
                    noResultsText="No se han encontrado jugadoras con ese nombre"
                    minWidth="min(100%, 360px)"
                />

                <AutocompleteField
                    label="Jugadora B"
                    value={playerQuery2}
                    onValueChange={onPlayer2QueryChange}
                    onSelectOption={onPlayer2Select}
                    options={playerOptions}
                    placeholder="Escribe el nombre de la jugadora"
                    ariaLabel="Busca la segunda jugadora"
                    noResultsText="No se han encontrado jugadoras con ese nombre"
                    minWidth="min(100%, 360px)"
                />
            </div>

            <div style={styles.comparisonGrid}>
                <PlayerCard player={selectedPlayer1} />
                <PlayerCard player={selectedPlayer2} />
            </div>

            {faceOffStats.length > 0 ? (
                <div style={{
                    display: "grid",
                    gap: 0,
                    padding: "20px clamp(16px, 3vw, 24px)",
                    borderRadius: "var(--radius-lg)",
                    background: "rgba(255, 251, 245, 0.86)",
                    border: "1px solid var(--border)"
                }}>
                    <div style={{
                        fontSize: 12,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        color: "var(--accent)",
                        marginBottom: 12
                    }}>
                        Estadísticas cara a cara
                    </div>

                    {faceOffStats.map(({label, v1, v2, higher, numeric}) => {
                        const n1 = Number(numeric ? v1 : (v1 ?? 0));
                        const n2 = Number(numeric ? v2 : (v2 ?? 0));
                        const p1Wins = higher ? n1 > n2 : n1 < n2;
                        const p2Wins = higher ? n2 > n1 : n2 < n1;

                        return (
                            <div key={label} style={{
                                display: "grid",
                                gridTemplateColumns: "1fr auto 1fr",
                                gap: 10,
                                alignItems: "center",
                                padding: "10px 0",
                                borderBottom: "1px solid rgba(107, 86, 58, 0.1)"
                            }}>
                                <div style={{
                                    textAlign: "right",
                                    fontFamily: "var(--font-display)",
                                    fontSize: "clamp(1.4rem, 2vw, 1.8rem)",
                                    fontWeight: p1Wins ? 900 : 400,
                                    color: p1Wins ? "var(--accent)" : "var(--navy)"
                                }}>
                                    {p1Wins ? "▶ " : ""}{String(v1)}
                                </div>
                                <div style={{
                                    textAlign: "center",
                                    fontSize: 11,
                                    fontWeight: 800,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.08em",
                                    color: "var(--muted)",
                                    minWidth: 90
                                }}>
                                    {label}
                                </div>
                                <div style={{
                                    textAlign: "left",
                                    fontFamily: "var(--font-display)",
                                    fontSize: "clamp(1.4rem, 2vw, 1.8rem)",
                                    fontWeight: p2Wins ? 900 : 400,
                                    color: p2Wins ? "var(--accent)" : "var(--navy)"
                                }}>
                                    {String(v2)}{p2Wins ? " ◀" : ""}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : null}
        </section>
    );
}

export default PlayerCompareSection;
