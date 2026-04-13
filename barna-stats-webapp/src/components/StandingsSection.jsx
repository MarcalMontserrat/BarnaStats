import PrettySelect from "./PrettySelect.jsx";

const styles = {
    section: {
        display: "grid",
        gap: 18,
        padding: "24px clamp(18px, 3vw, 30px)",
        borderRadius: "var(--radius-xl)",
        background: "linear-gradient(180deg, rgba(255, 252, 247, 0.92) 0%, rgba(251, 245, 237, 0.88) 100%)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-md)",
        animation: "fade-up 900ms ease both"
    },
    header: {
        display: "grid",
        gap: 8
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
    controls: {
        display: "flex",
        gap: 16,
        flexWrap: "wrap"
    },
    tableShell: {
        overflowX: "auto",
        borderRadius: "var(--radius-lg)",
        border: "1px solid rgba(26, 53, 87, 0.1)",
        boxShadow: "var(--shadow-sm)"
    },
    table: {
        width: "100%",
        minWidth: 760,
        borderCollapse: "collapse",
        background: "rgba(255, 252, 247, 0.96)"
    },
    headRow: {
        background: "linear-gradient(135deg, #172c47 0%, #234569 100%)"
    },
    headerCell: {
        padding: "14px 16px",
        textAlign: "left",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#f7efe4"
    },
    bodyCell: {
        padding: "14px 16px",
        fontSize: 14,
        borderBottom: "1px solid rgba(107, 86, 58, 0.08)"
    },
    teamButton: {
        padding: 0,
        border: "none",
        background: "transparent",
        color: "var(--navy)",
        fontWeight: 800,
        cursor: "pointer",
        textAlign: "left"
    },
    selectedRow: {
        background: "rgba(255, 239, 210, 0.72)"
    },
    emptyState: {
        padding: "18px 16px",
        borderRadius: "var(--radius-lg)",
        background: "rgba(245, 236, 224, 0.8)",
        border: "1px dashed rgba(107, 86, 58, 0.22)",
        color: "var(--muted)"
    }
};

function StandingsSection({
    rows,
    availablePhases,
    selectedPhase,
    onSelectedPhaseChange,
    selectedTeamKey,
    onTeamNavigate
}) {
    return (
        <section style={styles.section}>
            <div style={styles.header}>
                <div style={styles.eyebrow}>Clasificación</div>
                <h2 style={styles.title}>Cómo está la competición</h2>
                <p style={styles.subtitle}>
                    Tabla de la fase elegida para situar al equipo seleccionado y abrir cualquier rival con un clic.
                </p>
            </div>

            <div style={styles.controls}>
                <PrettySelect
                    label="Fase"
                    value={String(selectedPhase ?? "")}
                    onChange={(event) => onSelectedPhaseChange(event.target.value)}
                    ariaLabel="Selecciona fase de clasificación"
                    minWidth="220px"
                >
                    <option value="all">Todas las fases</option>
                    {availablePhases.map((phase) => (
                        <option key={phase} value={phase}>
                            Fase {phase}
                        </option>
                    ))}
                </PrettySelect>
            </div>

            {rows.length > 0 ? (
                <div style={styles.tableShell}>
                    <table style={styles.table}>
                        <thead>
                        <tr style={styles.headRow}>
                            <th style={styles.headerCell}>Pos</th>
                            <th style={styles.headerCell}>Equipo</th>
                            <th style={styles.headerCell}>PJ</th>
                            <th style={styles.headerCell}>G</th>
                            <th style={styles.headerCell}>P</th>
                            <th style={styles.headerCell}>PF</th>
                            <th style={styles.headerCell}>PC</th>
                            <th style={styles.headerCell}>Dif</th>
                        </tr>
                        </thead>

                        <tbody>
                        {rows.map((row) => (
                            <tr
                                key={row.teamKey}
                                style={row.teamKey === selectedTeamKey ? styles.selectedRow : undefined}
                            >
                                <td style={styles.bodyCell}>{row.position}</td>
                                <td style={styles.bodyCell}>
                                    <button
                                        type="button"
                                        style={styles.teamButton}
                                        onClick={() => onTeamNavigate(row.teamKey)}
                                    >
                                        {row.teamName}
                                    </button>
                                </td>
                                <td style={styles.bodyCell}>{row.played}</td>
                                <td style={styles.bodyCell}>{row.wins}</td>
                                <td style={styles.bodyCell}>{row.losses}</td>
                                <td style={styles.bodyCell}>{row.pointsFor}</td>
                                <td style={styles.bodyCell}>{row.pointsAgainst}</td>
                                <td style={styles.bodyCell}>{row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div style={styles.emptyState}>
                    No hay partidos suficientes para construir esta clasificación.
                </div>
            )}
        </section>
    );
}

export default StandingsSection;
