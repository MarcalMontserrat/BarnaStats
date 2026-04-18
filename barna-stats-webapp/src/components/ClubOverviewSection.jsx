import TeamBadge from "./TeamBadge.jsx";

const styles = {
    section: {
        display: "grid",
        gap: 18,
        padding: "24px clamp(18px, 3vw, 30px)",
        borderRadius: "var(--radius-xl)",
        background: "linear-gradient(180deg, rgba(255, 252, 247, 0.92) 0%, rgba(251, 245, 237, 0.88) 100%)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-md)",
        animation: "fade-up 920ms ease both"
    },
    header: {
        display: "grid",
        gap: 16
    },
    titleBlock: {
        display: "grid",
        gap: 8,
        maxWidth: 760
    },
    eyebrow: {
        color: "var(--accent)",
        fontSize: 12,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.12em"
    },
    title: {
        fontSize: "clamp(1.8rem, 2.4vw, 2.4rem)"
    },
    subtitle: {
        color: "var(--muted)",
        maxWidth: 760,
        lineHeight: 1.6
    },
    metricsGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
        gap: 12
    },
    metricCard: {
        display: "grid",
        gap: 6,
        padding: "16px 18px",
        borderRadius: "var(--radius-md)",
        background: "rgba(255, 251, 245, 0.96)",
        border: "1px solid rgba(107, 86, 58, 0.12)"
    },
    metricLabel: {
        fontSize: 12,
        color: "var(--muted)",
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.08em"
    },
    metricValue: {
        fontFamily: "var(--font-display)",
        fontSize: "1.75rem",
        lineHeight: 0.95,
        color: "var(--navy)"
    },
    metricMeta: {
        fontSize: 13,
        color: "var(--muted)"
    },
    categoryList: {
        display: "grid",
        gap: 18
    },
    categoryCard: {
        display: "grid",
        gap: 16,
        padding: "18px 20px",
        borderRadius: "var(--radius-lg)",
        background: "linear-gradient(180deg, rgba(255, 255, 255, 0.86) 0%, rgba(248, 242, 233, 0.92) 100%)",
        border: "1px solid rgba(107, 86, 58, 0.12)",
        boxShadow: "var(--shadow-sm)"
    },
    categoryHeader: {
        display: "grid",
        gap: 8
    },
    categoryTitle: {
        fontSize: "clamp(1.2rem, 2vw, 1.6rem)"
    },
    categoryMeta: {
        display: "flex",
        gap: 10,
        flexWrap: "wrap"
    },
    metaChip: {
        display: "inline-flex",
        alignItems: "center",
        minHeight: 34,
        padding: "0 12px",
        borderRadius: 999,
        background: "rgba(255, 249, 242, 0.92)",
        border: "1px solid rgba(107, 86, 58, 0.14)",
        color: "var(--navy)",
        fontSize: 12,
        fontWeight: 800
    },
    levelShell: {
        display: "grid",
        gap: 12
    },
    levelHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap"
    },
    levelTitle: {
        fontSize: 15,
        fontWeight: 800,
        color: "var(--navy)"
    },
    teamList: {
        display: "grid",
        gap: 10
    },
    teamRow: {
        display: "grid",
        gap: 12,
        padding: "16px 18px",
        borderRadius: "var(--radius-md)",
        background: "rgba(255, 251, 245, 0.96)",
        border: "1px solid rgba(107, 86, 58, 0.1)"
    },
    teamHeader: {
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        gap: 14,
        alignItems: "center"
    },
    teamIdentity: {
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1fr)",
        gap: 12,
        alignItems: "center",
        minWidth: 0
    },
    teamText: {
        display: "grid",
        gap: 6,
        minWidth: 0
    },
    teamName: {
        fontSize: 15,
        fontWeight: 800,
        color: "var(--navy)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
    },
    teamMeta: {
        display: "flex",
        gap: 8,
        flexWrap: "wrap"
    },
    teamMetaChip: {
        display: "inline-flex",
        alignItems: "center",
        minHeight: 30,
        padding: "0 10px",
        borderRadius: 999,
        background: "rgba(188, 63, 43, 0.08)",
        color: "var(--accent-strong)",
        fontSize: 12,
        fontWeight: 800
    },
    actions: {
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        justifyContent: "flex-end"
    },
    button: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 40,
        padding: "0 16px",
        borderRadius: 999,
        border: "1px solid rgba(26, 53, 87, 0.12)",
        background: "rgba(255, 251, 245, 0.96)",
        color: "var(--navy)",
        fontWeight: 800,
        cursor: "pointer",
        boxShadow: "var(--shadow-sm)"
    },
    primaryButton: {
        background: "linear-gradient(135deg, #1a3557 0%, #2d567b 100%)",
        color: "#fff7ef",
        borderColor: "transparent"
    }
};

function formatRecordLine(record) {
    if ((record?.ties ?? 0) > 0) {
        return `${record?.wins ?? 0}-${record?.losses ?? 0}-${record?.ties ?? 0}`;
    }

    return `${record?.wins ?? 0}-${record?.losses ?? 0}`;
}

function formatSignedNumber(value) {
    const number = Number(value ?? 0);
    const prefix = number > 0 ? "+" : "";
    return `${prefix}${number.toLocaleString("es-ES")}`;
}

function ClubOverviewSection({club, onTeamNavigate, onCompetitionNavigate}) {
    return (
        <section style={styles.section}>
            <div style={styles.header}>
                <div style={styles.titleBlock}>
                    <div style={styles.eyebrow}>Club</div>
                    <h2 style={styles.title}>Todos los equipos del club en una sola vista</h2>
                    <p style={styles.subtitle}>
                        Agrupamos los equipos por categoria y nivel para que puedas saltar rapido a la ficha del equipo
                        o a la clasificacion exacta donde compite ahora mismo.
                    </p>
                </div>

                <div style={styles.metricsGrid}>
                    <div style={styles.metricCard}>
                        <div style={styles.metricLabel}>Equipos</div>
                        <div style={styles.metricValue}>{club.totalTeams}</div>
                        <div style={styles.metricMeta}>Equipos activos del club en la temporada actual</div>
                    </div>

                    <div style={styles.metricCard}>
                        <div style={styles.metricLabel}>Categorias</div>
                        <div style={styles.metricValue}>{club.categoriesCount}</div>
                        <div style={styles.metricMeta}>Categorias donde el club tiene presencia</div>
                    </div>

                    <div style={styles.metricCard}>
                        <div style={styles.metricLabel}>Partidos</div>
                        <div style={styles.metricValue}>{club.totalMatches}</div>
                        <div style={styles.metricMeta}>Suma de partidos jugados por todos sus equipos</div>
                    </div>

                    <div style={styles.metricCard}>
                        <div style={styles.metricLabel}>Jugadoras</div>
                        <div style={styles.metricValue}>{club.totalPlayers}</div>
                        <div style={styles.metricMeta}>Plantillas registradas entre todos los equipos</div>
                    </div>
                </div>
            </div>

            <div style={styles.categoryList}>
                {club.categories.map((category) => (
                    <article key={category.categoryName} style={styles.categoryCard}>
                        <div style={styles.categoryHeader}>
                            <h3 style={styles.categoryTitle}>{category.categoryName}</h3>
                            <div style={styles.categoryMeta}>
                                <span style={styles.metaChip}>
                                    {category.levels.reduce((sum, level) => sum + level.teams.length, 0)} equipo{category.levels.reduce((sum, level) => sum + level.teams.length, 0) === 1 ? "" : "s"}
                                </span>
                            </div>
                        </div>

                        {category.levels.map((level) => (
                            <div key={`${category.categoryName}:${level.levelKey}`} style={styles.levelShell}>
                                <div style={styles.levelHeader}>
                                    <div style={styles.levelTitle}>{level.levelName || "Sin nivel visible"}</div>
                                    <span style={styles.metaChip}>{level.teams.length} equipo{level.teams.length === 1 ? "" : "s"}</span>
                                </div>

                                <div style={styles.teamList}>
                                    {level.teams.map((team) => (
                                        <article key={team.teamKey} style={styles.teamRow}>
                                            <div style={styles.teamHeader}>
                                                <div style={styles.teamIdentity}>
                                                    <TeamBadge
                                                        size="md"
                                                        teamIdExtern={team.teamIdExtern}
                                                        teamName={team.teamName}
                                                    />
                                                    <div style={styles.teamText}>
                                                        <div style={styles.teamName}>{team.teamName}</div>
                                                        <div style={styles.teamMeta}>
                                                            {team.standingPosition ? (
                                                                <span style={styles.teamMetaChip}>#{team.standingPosition}</span>
                                                            ) : null}
                                                            <span style={styles.teamMetaChip}>{formatRecordLine(team.record)}</span>
                                                            <span style={styles.teamMetaChip}>{team.matchesPlayed} partidos</span>
                                                            <span style={styles.teamMetaChip}>{team.playersCount} jugadoras</span>
                                                            <span style={styles.teamMetaChip}>{formatSignedNumber(team.pointDiff)}</span>
                                                            <span style={styles.teamMetaChip}>{team.avgValuation.toFixed(1)} val.</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div style={styles.actions}>
                                                    <button
                                                        type="button"
                                                        style={styles.button}
                                                        onClick={() => onTeamNavigate(team.teamKey)}
                                                    >
                                                        Ver equipo
                                                    </button>
                                                    <button
                                                        type="button"
                                                        style={{...styles.button, ...styles.primaryButton}}
                                                        onClick={() => onCompetitionNavigate(team)}
                                                    >
                                                        Ver clasificacion
                                                    </button>
                                                </div>
                                            </div>

                                            {team.phaseLabel ? (
                                                <div style={styles.teamMeta}>
                                                    <span style={styles.teamMetaChip}>{team.phaseLabel}</span>
                                                    {team.groupCode ? (
                                                        <span style={styles.teamMetaChip}>Grupo {team.groupCode}</span>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                        </article>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </article>
                ))}
            </div>
        </section>
    );
}

export default ClubOverviewSection;
