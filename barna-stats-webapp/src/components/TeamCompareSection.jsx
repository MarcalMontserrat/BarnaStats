import AutocompleteField from "./AutocompleteField.jsx";
import TeamBadge from "./TeamBadge.jsx";

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
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
        gap: 16,
        alignItems: "end"
    },
    vsLabel: {
        display: "none"
    },
    comparisonGrid: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 18
    },
    comparisonGridFull: {
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: 18
    },
    teamCard: {
        display: "grid",
        gap: 14,
        padding: "clamp(16px, 3vw, 24px)",
        borderRadius: "var(--radius-lg)",
        background: "linear-gradient(135deg, rgba(19, 32, 51, 0.96) 0%, rgba(53, 28, 34, 0.92) 54%, rgba(143, 44, 29, 0.9) 100%)",
        color: "#fff7ef",
        border: "1px solid rgba(255, 255, 255, 0.08)"
    },
    teamCardHeader: {
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1fr)",
        gap: 14,
        alignItems: "center"
    },
    teamCardName: {
        fontFamily: "var(--font-display)",
        fontSize: "clamp(1.4rem, 2vw, 2rem)",
        lineHeight: 1,
        overflowWrap: "anywhere"
    },
    teamCardMeta: {
        color: "rgba(255, 243, 227, 0.7)",
        fontSize: 13
    },
    metricsGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 130px), 1fr))",
        gap: 12
    },
    metricCard: {
        display: "grid",
        gap: 6,
        padding: "14px",
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
        fontSize: "clamp(1.5rem, 2vw, 2rem)",
        lineHeight: 0.95,
        overflowWrap: "anywhere"
    },
    metricWinner: {
        color: "#ffd27d"
    },
    metricSub: {
        color: "rgba(255, 243, 227, 0.7)",
        fontSize: 12,
        lineHeight: 1.4
    },
    spotlightCard: {
        display: "grid",
        gap: 8,
        padding: "14px",
        borderRadius: "var(--radius-md)",
        background: "rgba(255, 248, 238, 0.08)",
        border: "1px solid rgba(255, 255, 255, 0.08)"
    },
    spotlightLabel: {
        color: "rgba(255, 243, 227, 0.7)",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase"
    },
    spotlightName: {
        fontFamily: "var(--font-display)",
        fontSize: "clamp(1.2rem, 1.6vw, 1.6rem)",
        lineHeight: 1,
        overflowWrap: "anywhere"
    },
    spotlightValue: {
        fontSize: 14,
        fontWeight: 800,
        overflowWrap: "anywhere"
    },
    noTeamCard: {
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
    loadingCard: {
        padding: 24,
        borderRadius: "var(--radius-lg)",
        background: "rgba(255, 251, 245, 0.86)",
        border: "1px solid rgba(107, 86, 58, 0.12)",
        boxShadow: "var(--shadow-sm)",
        color: "var(--muted)"
    },
    divider: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-display)",
        fontSize: "clamp(1.6rem, 2.5vw, 2.4rem)",
        color: "var(--muted)",
        userSelect: "none"
    },
    rowDivider: {
        gridColumn: "1 / -1",
        height: 1,
        background: "rgba(107, 86, 58, 0.14)",
        margin: "4px 0"
    }
};

function formatRecord(record) {
    if ((record?.ties ?? 0) > 0) {
        return `${record?.wins ?? 0}-${record?.losses ?? 0}-${record?.ties ?? 0}`;
    }

    return `${record?.wins ?? 0}-${record?.losses ?? 0}`;
}

function formatAverage(value) {
    return Number(value ?? 0).toLocaleString("es-ES", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    });
}

function formatSigned(value) {
    const number = Number(value ?? 0);
    const prefix = number > 0 ? "+" : "";

    return `${prefix}${number.toLocaleString("es-ES", {minimumFractionDigits: 0, maximumFractionDigits: 0})}`;
}

function StatRow({label, value1, value2, higherIsBetter = true, lowerIsBetter = false}) {
    const n1 = Number(value1 ?? 0);
    const n2 = Number(value2 ?? 0);
    const team1Wins = higherIsBetter ? n1 > n2 : (lowerIsBetter ? n1 < n2 : false);
    const team2Wins = higherIsBetter ? n2 > n1 : (lowerIsBetter ? n2 < n1 : false);

    return (
        <>
            <div style={styles.metricCard}>
                <div style={styles.metricLabel}>{label}</div>
                <div style={{...styles.metricValue, ...(team1Wins ? styles.metricWinner : {})}}>{value1 ?? "—"}</div>
            </div>
            <div style={styles.metricCard}>
                <div style={styles.metricLabel}>{label}</div>
                <div style={{...styles.metricValue, ...(team2Wins ? styles.metricWinner : {})}}>{value2 ?? "—"}</div>
            </div>
        </>
    );
}

function TeamCard({team, record, standingRow, bestWinStreak, teamAvg, topScorer, mvp, loading, error}) {
    if (!team) {
        return (
            <div style={styles.noTeamCard}>
                <div>Selecciona un equipo</div>
            </div>
        );
    }

    if (loading) {
        return <div style={styles.loadingCard}>Cargando datos del equipo...</div>;
    }

    if (error) {
        return <div style={styles.loadingCard}>{error}</div>;
    }

    const pointsDiff = Number(record?.pointsFor ?? 0) - Number(record?.pointsAgainst ?? 0);

    return (
        <div style={styles.teamCard}>
            <div style={styles.teamCardHeader}>
                <TeamBadge
                    size="lg"
                    teamIdExtern={team.teamIdExtern}
                    teamName={team.teamName}
                />
                <div>
                    <div style={styles.teamCardName}>{team.teamName}</div>
                    <div style={styles.teamCardMeta}>{record?.matches ?? 0} partidos</div>
                </div>
            </div>

            <div style={styles.metricsGrid}>
                <div style={styles.metricCard}>
                    <div style={styles.metricLabel}>Balance</div>
                    <div style={styles.metricValue}>{record ? formatRecord(record) : "—"}</div>
                    <div style={styles.metricSub}>V-D{(record?.ties ?? 0) > 0 ? "-E" : ""}</div>
                </div>

                <div style={styles.metricCard}>
                    <div style={styles.metricLabel}>Victorias</div>
                    <div style={styles.metricValue}>{record?.wins ?? "—"}</div>
                    <div style={styles.metricSub}>de {record?.matches ?? 0} jugados</div>
                </div>

                <div style={styles.metricCard}>
                    <div style={styles.metricLabel}>Posición</div>
                    <div style={styles.metricValue}>{standingRow ? `#${standingRow.position}` : "—"}</div>
                    <div style={styles.metricSub}>Clasificación</div>
                </div>

                <div style={styles.metricCard}>
                    <div style={styles.metricLabel}>Media pts</div>
                    <div style={styles.metricValue}>{formatAverage(teamAvg)}</div>
                    <div style={styles.metricSub}>Puntos por partido</div>
                </div>

                <div style={styles.metricCard}>
                    <div style={styles.metricLabel}>Diferencial</div>
                    <div style={styles.metricValue}>{formatSigned(pointsDiff)}</div>
                    <div style={styles.metricSub}>Pts a favor vs en contra</div>
                </div>

                <div style={styles.metricCard}>
                    <div style={styles.metricLabel}>Mejor racha</div>
                    <div style={styles.metricValue}>{bestWinStreak ?? "—"}</div>
                    <div style={styles.metricSub}>Victorias seguidas</div>
                </div>
            </div>

            <div style={styles.spotlightCard}>
                <div style={styles.spotlightLabel}>Máxima anotadora</div>
                <div style={styles.spotlightName}>{topScorer?.name ?? "—"}</div>
                <div style={styles.spotlightValue}>
                    {topScorer ? `${topScorer.points} pts · ${formatAverage(topScorer.avgPoints)} por partido` : "Sin datos"}
                </div>
            </div>

            <div style={styles.spotlightCard}>
                <div style={styles.spotlightLabel}>Mejor valoración</div>
                <div style={styles.spotlightName}>{mvp?.name ?? "—"}</div>
                <div style={styles.spotlightValue}>
                    {mvp ? `${mvp.valuation} val · ${formatAverage(mvp.avgValuation)} media` : "Sin datos"}
                </div>
            </div>
        </div>
    );
}

function TeamCompareSection({
    teamOptions,
    teamQuery1,
    teamQuery2,
    onTeam1QueryChange,
    onTeam2QueryChange,
    onTeam1Select,
    onTeam2Select,
    teamData1,
    teamData2
}) {
    const {
        record: record1,
        standingRow: standingRow1,
        bestWinStreak: bestWinStreak1,
        teamAvg: teamAvg1,
        topScorer: topScorer1,
        mvp: mvp1,
        loading: loading1,
        error: error1,
        summary: summary1
    } = teamData1;

    const {
        record: record2,
        standingRow: standingRow2,
        bestWinStreak: bestWinStreak2,
        teamAvg: teamAvg2,
        topScorer: topScorer2,
        mvp: mvp2,
        loading: loading2,
        error: error2,
        summary: summary2
    } = teamData2;

    return (
        <section style={styles.section}>
            <div style={styles.header}>
                <div style={styles.eyebrow}>Comparativa de equipos</div>
                <h2 style={styles.title}>Elige dos equipos y compara sus estadísticas</h2>
                <p style={styles.subtitle}>
                    Busca dos equipos de la temporada actual para ver sus estadísticas cara a cara: balance, posición, media de puntos, diferencial y jugadoras destacadas.
                </p>
            </div>

            <div style={styles.selectorRow}>
                <AutocompleteField
                    label="Equipo A"
                    value={teamQuery1}
                    onValueChange={onTeam1QueryChange}
                    onSelectOption={onTeam1Select}
                    options={teamOptions}
                    placeholder="Escribe el nombre del equipo"
                    ariaLabel="Busca el primer equipo"
                    noResultsText="No se han encontrado equipos con ese nombre"
                    minWidth="min(100%, 360px)"
                />

                <AutocompleteField
                    label="Equipo B"
                    value={teamQuery2}
                    onValueChange={onTeam2QueryChange}
                    onSelectOption={onTeam2Select}
                    options={teamOptions}
                    placeholder="Escribe el nombre del equipo"
                    ariaLabel="Busca el segundo equipo"
                    noResultsText="No se han encontrado equipos con ese nombre"
                    minWidth="min(100%, 360px)"
                />
            </div>

            <div style={styles.comparisonGrid}>
                <TeamCard
                    team={summary1}
                    record={record1}
                    standingRow={standingRow1}
                    bestWinStreak={bestWinStreak1}
                    teamAvg={teamAvg1}
                    topScorer={topScorer1}
                    mvp={mvp1}
                    loading={loading1}
                    error={error1}
                />
                <TeamCard
                    team={summary2}
                    record={record2}
                    standingRow={standingRow2}
                    bestWinStreak={bestWinStreak2}
                    teamAvg={teamAvg2}
                    topScorer={topScorer2}
                    mvp={mvp2}
                    loading={loading2}
                    error={error2}
                />
            </div>

            {summary1 && summary2 && !loading1 && !loading2 && !error1 && !error2 ? (
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(6, 1fr)",
                    gap: 12,
                    padding: "20px clamp(16px, 3vw, 24px)",
                    borderRadius: "var(--radius-lg)",
                    background: "rgba(255, 251, 245, 0.86)",
                    border: "1px solid var(--border)"
                }}>
                    <div style={{
                        gridColumn: "1 / -1",
                        fontSize: 12,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        color: "var(--accent)",
                        marginBottom: 4
                    }}>
                        Estadísticas cara a cara
                    </div>

                    <div style={{
                        gridColumn: "1 / -1",
                        display: "grid",
                        gridTemplateColumns: "1fr auto 1fr",
                        gap: 10,
                        alignItems: "center"
                    }}>
                        {[
                            {label: "Victorias", v1: record1?.wins ?? 0, v2: record2?.wins ?? 0, higher: true},
                            {label: "Pts/partido", v1: Number(teamAvg1 ?? 0).toFixed(1), v2: Number(teamAvg2 ?? 0).toFixed(1), higher: true, numeric: true},
                            {label: "Diferencial", v1: (record1?.pointsFor ?? 0) - (record1?.pointsAgainst ?? 0), v2: (record2?.pointsFor ?? 0) - (record2?.pointsAgainst ?? 0), higher: true},
                            {label: "Mejor racha", v1: bestWinStreak1 ?? 0, v2: bestWinStreak2 ?? 0, higher: true}
                        ].map(({label, v1, v2, higher, numeric}) => {
                            const n1 = Number(numeric ? v1 : (v1 ?? 0));
                            const n2 = Number(numeric ? v2 : (v2 ?? 0));
                            const team1Wins = higher ? n1 > n2 : n1 < n2;
                            const team2Wins = higher ? n2 > n1 : n2 < n1;

                            return (
                                <div key={label} style={{
                                    gridColumn: "1 / -1",
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
                                        fontWeight: team1Wins ? 900 : 400,
                                        color: team1Wins ? "var(--accent)" : "var(--navy)"
                                    }}>
                                        {team1Wins ? "▶ " : ""}{String(v1)}
                                    </div>
                                    <div style={{
                                        textAlign: "center",
                                        fontSize: 11,
                                        fontWeight: 800,
                                        textTransform: "uppercase",
                                        letterSpacing: "0.08em",
                                        color: "var(--muted)",
                                        minWidth: 80
                                    }}>
                                        {label}
                                    </div>
                                    <div style={{
                                        textAlign: "left",
                                        fontFamily: "var(--font-display)",
                                        fontSize: "clamp(1.4rem, 2vw, 1.8rem)",
                                        fontWeight: team2Wins ? 900 : 400,
                                        color: team2Wins ? "var(--accent)" : "var(--navy)"
                                    }}>
                                        {String(v2)}{team2Wins ? " ◀" : ""}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : null}
        </section>
    );
}

export default TeamCompareSection;
