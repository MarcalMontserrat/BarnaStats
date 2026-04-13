import {useEffect, useState} from "react";

const styles = {
    panel: {
        background: "#fff",
        padding: 20,
        borderRadius: 12,
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        display: "grid",
        gap: 16
    },
    intro: {
        display: "grid",
        gap: 6
    },
    titleRow: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap"
    },
    title: {
        margin: 0,
        fontSize: 20
    },
    helper: {
        color: "#666",
        fontSize: 14
    },
    statusPill: {
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "6px 10px",
        fontSize: 12,
        fontWeight: 700
    },
    controls: {
        display: "flex",
        gap: 12,
        flexWrap: "wrap"
    },
    input: {
        flex: "1 1 520px",
        minHeight: 48,
        padding: "0 16px",
        borderRadius: 10,
        border: "1px solid #d8dbe5",
        fontSize: 15
    },
    button: {
        minHeight: 48,
        padding: "0 20px",
        borderRadius: 10,
        border: "none",
        background: "#172554",
        color: "#fff",
        fontWeight: 700,
        cursor: "pointer"
    },
    mutedButton: {
        background: "#94a3b8",
        cursor: "not-allowed"
    },
    meta: {
        display: "grid",
        gap: 4,
        color: "#555",
        fontSize: 14
    },
    error: {
        color: "#b91c1c",
        fontSize: 14
    },
    logs: {
        margin: 0,
        background: "#0f172a",
        color: "#dbeafe",
        borderRadius: 10,
        padding: 14,
        maxHeight: 220,
        overflow: "auto",
        fontSize: 13,
        lineHeight: 1.5,
        whiteSpace: "pre-wrap"
    }
};

const STATUS_LABELS = {
    pending: "Pendiente",
    running: "En marcha",
    succeeded: "Completado",
    failed: "Con error"
};

const STATUS_STYLES = {
    pending: {background: "#fef3c7", color: "#92400e"},
    running: {background: "#dbeafe", color: "#1d4ed8"},
    succeeded: {background: "#dcfce7", color: "#166534"},
    failed: {background: "#fee2e2", color: "#b91c1c"}
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
        ? `Fase: ${job.sourceId ?? "-"}`
        : `Fuente: ${job?.sourceId ?? "-"}`;

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
        ? {background: "#e2e8f0", color: "#334155"}
        : status === "offline"
            ? {background: "#fee2e2", color: "#991b1b"}
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
                    <h2 style={styles.title}>Cargar fase</h2>
                    <span style={{...styles.statusPill, ...statusStyle}}>
                        {statusLabel}
                    </span>
                </div>
                <div style={styles.helper}>
                    Pega la URL de resultados de una fase y la app lanzará `sync-all`. Si sale captcha,
                    se abrirá el navegador auxiliar para resolverlo.
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
                <div style={styles.meta}>
                    <div>{scopeLabel}</div>
                    <div>Job: {job.jobId}</div>
                    <div>URL: {job.sourceUrl}</div>
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
