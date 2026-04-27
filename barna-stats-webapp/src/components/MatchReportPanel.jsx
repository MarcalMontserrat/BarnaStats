import {useEffect, useState} from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:5071";

const styles = {
    card: {
        marginTop: 12,
        display: "grid",
        gap: 14,
        background: "linear-gradient(180deg, rgba(255, 248, 236, 0.96) 0%, rgba(250, 238, 219, 0.9) 100%)",
        border: "1px solid rgba(211, 159, 52, 0.22)",
        borderRadius: "var(--radius-lg)",
        padding: 18,
        boxShadow: "var(--shadow-sm)"
    },
    header: {
        display: "flex",
        gap: 12,
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap"
    },
    titleBlock: {
        display: "grid",
        gap: 6
    },
    title: {
        fontWeight: 800,
        color: "#7b4b10",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        fontSize: 12
    },
    subtitle: {
        color: "#7f684a",
        lineHeight: 1.55,
        fontSize: 14
    },
    actionButton: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 40,
        padding: "0 14px",
        borderRadius: 999,
        border: "1px solid rgba(123, 75, 16, 0.16)",
        background: "linear-gradient(135deg, #fff9ef 0%, #fde7b6 100%)",
        color: "#7b4b10",
        fontWeight: 800,
        cursor: "pointer",
        boxShadow: "0 8px 20px rgba(123, 75, 16, 0.08)"
    },
    actionButtonDisabled: {
        opacity: 0.66,
        cursor: "wait"
    },
    statusText: {
        color: "#8b7355",
        fontSize: 13,
        lineHeight: 1.55
    },
    errorText: {
        color: "#b33a1a",
        fontSize: 13,
        lineHeight: 1.55
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

function getInitialReportState(matchReport, matchReportGeneratedAtUtc, matchReportModel) {
    return {
        summary: matchReport ?? "",
        generatedAtUtc: matchReportGeneratedAtUtc ?? null,
        model: matchReportModel ?? ""
    };
}

function buildReportUrl(matchWebId, focusTeamIdExtern, forceRefresh) {
    const query = new URLSearchParams();
    if (typeof forceRefresh === "boolean") {
        query.set("forceRefresh", forceRefresh ? "true" : "false");
    }
    if (Number(focusTeamIdExtern) > 0) {
        query.set("focusTeamIdExtern", String(Number(focusTeamIdExtern)));
    }

    const queryString = query.toString();
    return `${API_BASE_URL}/api/matches/${matchWebId}/report${queryString ? `?${queryString}` : ""}`;
}

async function readApiPayload(response) {
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
        return null;
    }

    return await response.json();
}

function MatchReportPanel({
    matchWebId,
    matchReport,
    matchReportGeneratedAtUtc,
    matchReportModel,
    subtitle,
    focusTeamIdExtern,
    focusTeamName
}) {
    const [reportState, setReportState] = useState(() =>
        Number(focusTeamIdExtern) > 0
            ? getInitialReportState("", null, "")
            : getInitialReportState(matchReport, matchReportGeneratedAtUtc, matchReportModel));
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        setReportState(
            Number(focusTeamIdExtern) > 0
                ? getInitialReportState("", null, "")
                : getInitialReportState(matchReport, matchReportGeneratedAtUtc, matchReportModel)
        );
        setError("");

        if (!matchWebId) {
            return undefined;
        }

        let cancelled = false;

        async function loadCachedReport() {
            setLoading(true);
            setError("");

            try {
                const response = await fetch(buildReportUrl(matchWebId, focusTeamIdExtern));
                if (cancelled) {
                    return;
                }

                if (response.status === 204) {
                    return;
                }

                if (!response.ok) {
                    const payload = await readApiPayload(response);
                    throw new Error(payload?.detail ?? payload?.error ?? payload?.title ?? "No se pudo leer el análisis guardado.");
                }

                const payload = await response.json();
                if (!cancelled) {
                    setReportState({
                        summary: payload.summary ?? "",
                        generatedAtUtc: payload.generatedAtUtc ?? null,
                        model: payload.model ?? ""
                    });
                }
            } catch (err) {
                if (!cancelled) {
                    setError(String(err));
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        void loadCachedReport();

        return () => {
            cancelled = true;
        };
    }, [matchWebId, matchReport, matchReportGeneratedAtUtc, matchReportModel, focusTeamIdExtern]);

    async function generateReport(forceRefresh) {
        if (!matchWebId) {
            return;
        }

        setGenerating(true);
        setError("");

        try {
            const response = await fetch(
                buildReportUrl(matchWebId, focusTeamIdExtern, forceRefresh),
                {
                    method: "POST"
                }
            );

            const payload = await readApiPayload(response);
            if (!response.ok) {
                throw new Error(payload?.detail ?? payload?.error ?? payload?.title ?? "No se pudo generar el análisis con Gemini.");
            }

            setReportState({
                summary: payload?.summary ?? reportState.summary,
                generatedAtUtc: payload?.generatedAtUtc ?? reportState.generatedAtUtc,
                model: payload?.model ?? reportState.model
            });
        } catch (err) {
            setError(String(err));
        } finally {
            setGenerating(false);
        }
    }

    if (!matchWebId && !reportState.summary) {
        return null;
    }

    const blocks = reportState.summary
        .split(/\n\s*\n/)
        .map((block) => block.trim())
        .filter(Boolean);
    const isBusy = loading || generating;
    const hasReport = !!reportState.summary;
    const actionLabel = generating
        ? "Generando análisis..."
        : hasReport
            ? "Regenerar con Gemini"
            : "Generar con Gemini";

    return (
        <div style={styles.card}>
            <div style={styles.header}>
                <div style={styles.titleBlock}>
                    <div style={styles.title}>Análisis del partido</div>
                    <div style={styles.subtitle}>
                        {subtitle ?? "Resumen on demand generado con Gemini a partir de los stats y el play-by-play ya descargados."}
                        {Number(focusTeamIdExtern) > 0 && focusTeamName
                            ? ` En esta vista, el análisis se enfoca en ${focusTeamName}.`
                            : ""}
                    </div>
                </div>
                {matchWebId ? (
                    <button
                        type="button"
                        style={{
                            ...styles.actionButton,
                            ...(isBusy ? styles.actionButtonDisabled : {})
                        }}
                        disabled={isBusy}
                        onClick={() => generateReport(hasReport)}
                    >
                        {actionLabel}
                    </button>
                ) : null}
            </div>

            {loading && !hasReport ? (
                <div style={styles.statusText}>Buscando si ya existe un análisis generado para este partido...</div>
            ) : null}

            {error ? (
                <div style={styles.errorText}>{error}</div>
            ) : null}

            {!hasReport && !loading ? (
                <div style={styles.statusText}>
                    Todavía no hay análisis guardado para este partido. Puedes pedirlo ahora mismo desde aquí.
                </div>
            ) : null}

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
            {reportState.generatedAtUtc ? (
                <div style={styles.meta}>
                    Generado: {new Date(reportState.generatedAtUtc).toLocaleString("es-ES")}
                    {reportState.model ? ` · ${reportState.model}` : ""}
                </div>
            ) : null}
        </div>
    );
}

export default MatchReportPanel;
