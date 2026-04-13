import {useEffect, useState} from "react";

const styles = {
    panel: {
        display: "grid",
        gap: 18,
        padding: "24px clamp(18px, 3vw, 30px)",
        borderRadius: "var(--radius-xl)",
        background: "linear-gradient(180deg, rgba(255, 252, 247, 0.94) 0%, rgba(246, 237, 224, 0.92) 100%)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-lg)"
    },
    intro: {
        display: "grid",
        gap: 8
    },
    titleRow: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap"
    },
    title: {
        margin: 0,
        fontSize: "clamp(1.5rem, 2vw, 2rem)"
    },
    helper: {
        color: "var(--muted)",
        fontSize: 15,
        lineHeight: 1.6,
        maxWidth: 760
    },
    statusPill: {
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "7px 12px",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase"
    },
    controls: {
        display: "flex",
        gap: 12,
        flexWrap: "wrap"
    },
    input: {
        flex: "1 1 520px",
        minHeight: 56,
        padding: "0 18px",
        borderRadius: 18,
        border: "1px solid rgba(107, 86, 58, 0.18)",
        background: "rgba(255, 252, 247, 0.94)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)",
        color: "var(--text)",
        fontSize: 15
    },
    button: {
        minHeight: 56,
        padding: "0 22px",
        borderRadius: 18,
        border: "none",
        background: "linear-gradient(135deg, #1a3557 0%, #bc3f2b 100%)",
        color: "#fff8ef",
        fontWeight: 800,
        cursor: "pointer",
        boxShadow: "0 16px 28px rgba(40, 30, 21, 0.14)"
    },
    mutedButton: {
        background: "linear-gradient(135deg, #8e97a2 0%, #b0b6bd 100%)",
        cursor: "not-allowed",
        boxShadow: "none"
    },
    metaGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 12
    },
    metaCard: {
        display: "grid",
        gap: 6,
        padding: 14,
        borderRadius: "var(--radius-md)",
        background: "rgba(255, 251, 245, 0.88)",
        border: "1px solid rgba(107, 86, 58, 0.1)"
    },
    metaLabel: {
        color: "var(--muted)",
        fontSize: 12,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.08em"
    },
    metaValue: {
        color: "var(--text)",
        fontSize: 14,
        lineHeight: 1.45,
        wordBreak: "break-word"
    },
    error: {
        color: "#9d2618",
        fontSize: 14,
        lineHeight: 1.6
    },
    logs: {
        margin: 0,
        background: "linear-gradient(180deg, #132033 0%, #182a43 100%)",
        color: "#ecf1f6",
        borderRadius: "var(--radius-lg)",
        padding: 16,
        maxHeight: 260,
        overflow: "auto",
        fontSize: 13,
        lineHeight: 1.6,
        whiteSpace: "pre-wrap",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)"
    }
};

const STATUS_LABELS = {
    pending: "Pendiente",
    running: "En marcha",
    succeeded: "Completado",
    failed: "Con error"
};

const STATUS_STYLES = {
    pending: {background: "#fef0cb", color: "#925f00"},
    running: {background: "#dce8f6", color: "#1a3557"},
    succeeded: {background: "#e4f1e4", color: "#2d5d34"},
    failed: {background: "#f8dcd6", color: "#9d2618"}
};

function SyncPanel({
    apiAvailable,
    job,
    starting,
    error,
    onStartSync
}) {
    const [sourceUrl, setSourceUrl] = useState(() => window.localStorage.getItem("barna-sync-source-url") ?? "");
    const scopeLabel = job?.sourceKind === "phase"
        ? `Fase ${job.sourceId ?? "-"}`
        : `Fuente ${job?.sourceId ?? "-"}`;

    useEffect(() => {
        window.localStorage.setItem("barna-sync-source-url", sourceUrl);
    }, [sourceUrl]);

    const status = job?.status ?? (apiAvailable ? "idle" : "offline");
    const isBusy = starting || status === "pending" || status === "running";
    const statusLabel = status === "idle"
        ? "Lista"
        : status === "offline"
            ? "API no disponible"
            : (STATUS_LABELS[status] ?? status);
    const statusStyle = status === "idle"
        ? {background: "#efe4d5", color: "#6c5b49"}
        : status === "offline"
            ? {background: "#f8dcd6", color: "#9d2618"}
            : STATUS_STYLES[status];

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!sourceUrl.trim() || isBusy) {
            return;
        }

        await onStartSync(sourceUrl.trim());
    };

    return (
        <form style={styles.panel} onSubmit={handleSubmit}>
            <div style={styles.intro}>
                <div style={styles.titleRow}>
                    <h2 style={styles.title}>Sincronizar fase</h2>
                    <span style={{...styles.statusPill, ...statusStyle}}>
                        {statusLabel}
                    </span>
                </div>
                <div style={styles.helper}>
                    Pega la URL oficial de resultados y la app reconstruirá el mapping, descargará `stats` y `moves`,
                    y regenerará el análisis publicado para la web. Si sale captcha, se abrirá el navegador auxiliar.
                </div>
            </div>

            <div style={styles.controls}>
                <input
                    type="url"
                    value={sourceUrl}
                    onChange={(event) => setSourceUrl(event.target.value)}
                    placeholder="https://www.basquetcatala.cat/competicions/resultats/20855/0"
                    style={styles.input}
                    disabled={isBusy}
                />
                <button
                    type="submit"
                    style={isBusy ? {...styles.button, ...styles.mutedButton} : styles.button}
                    disabled={isBusy}
                >
                    {isBusy ? "Sincronizando..." : "Cargar fase"}
                </button>
            </div>

            {job ? (
                <div style={styles.metaGrid}>
                    <div style={styles.metaCard}>
                        <div style={styles.metaLabel}>Scope</div>
                        <div style={styles.metaValue}>{scopeLabel}</div>
                    </div>
                    <div style={styles.metaCard}>
                        <div style={styles.metaLabel}>Job</div>
                        <div style={styles.metaValue}>{job.jobId}</div>
                    </div>
                    <div style={styles.metaCard}>
                        <div style={styles.metaLabel}>Fuente</div>
                        <div style={styles.metaValue}>{job.sourceUrl}</div>
                    </div>
                </div>
            ) : null}

            {!apiAvailable ? (
                <div style={styles.error}>
                    La API local no responde en `http://127.0.0.1:5071`. Lanza `npm run dev:api` o `npm run dev:all`.
                </div>
            ) : null}

            {error ? (
                <div style={styles.error}>{error}</div>
            ) : null}

            {job?.error ? (
                <div style={styles.error}>{job.error}</div>
            ) : null}

            {job?.logs?.length ? (
                <pre style={styles.logs}>{job.logs.join("\n")}</pre>
            ) : null}
        </form>
    );
}

export default SyncPanel;
