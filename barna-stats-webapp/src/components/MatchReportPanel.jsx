import {useEffect, useState} from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:5071";

const styles = {
    card: {
        display: "grid",
        gap: 16,
        background: "linear-gradient(180deg, rgba(255, 250, 242, 0.98) 0%, rgba(248, 239, 225, 0.94) 100%)",
        border: "1px solid rgba(180, 133, 44, 0.18)",
        borderRadius: "var(--radius-lg)",
        padding: 18,
        boxShadow: "var(--shadow-sm)"
    },
    cardWithTopMargin: {
        marginTop: 12
    },
    header: {
        display: "flex",
        gap: 14,
        justifyContent: "space-between",
        alignItems: "flex-start",
        flexWrap: "wrap"
    },
    titleBlock: {
        display: "grid",
        gap: 10,
        minWidth: 0,
        flex: "1 1 340px"
    },
    badgeRow: {
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        alignItems: "center"
    },
    eyebrow: {
        display: "inline-flex",
        alignItems: "center",
        minHeight: 24,
        padding: "0 10px",
        borderRadius: 999,
        background: "rgba(26, 53, 87, 0.08)",
        color: "var(--navy)",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase"
    },
    providerBadge: {
        display: "inline-flex",
        alignItems: "center",
        minHeight: 24,
        padding: "0 10px",
        borderRadius: 999,
        background: "rgba(188, 63, 43, 0.12)",
        color: "var(--accent-strong)",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase"
    },
    title: {
        fontWeight: 900,
        color: "var(--navy)",
        fontSize: 18,
        lineHeight: 1.2
    },
    subtitle: {
        color: "#6b5a43",
        lineHeight: 1.6,
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
    notice: {
        padding: "12px 14px",
        borderRadius: "var(--radius-md)",
        background: "rgba(255, 255, 255, 0.58)",
        border: "1px solid rgba(123, 75, 16, 0.12)",
        color: "#7c684c",
        fontSize: 13,
        lineHeight: 1.55
    },
    errorNotice: {
        padding: "12px 14px",
        borderRadius: "var(--radius-md)",
        background: "rgba(255, 239, 234, 0.9)",
        border: "1px solid rgba(179, 58, 26, 0.18)",
        color: "#b33a1a",
        fontSize: 13,
        lineHeight: 1.55
    },
    body: {
        display: "grid",
        gap: 12
    },
    paragraph: {
        margin: 0,
        lineHeight: 1.7,
        color: "#41352a",
        fontSize: 15
    },
    list: {
        margin: 0,
        paddingLeft: 20,
        color: "#41352a",
        lineHeight: 1.7
    },
    footer: {
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        paddingTop: 12,
        borderTop: "1px solid rgba(123, 75, 16, 0.14)",
        color: "#8b7355",
        fontSize: 12
    },
    footerItem: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6
    },
    footerLabel: {
        color: "#7b4b10",
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        fontSize: 11
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

function inferProviderFromModel(model, enableOnDemand) {
    const normalizedModel = String(model ?? "").trim().toLowerCase();
    if (normalizedModel.includes("gemini")) {
        return "Gemini";
    }

    if (
        normalizedModel.includes("openai")
        || normalizedModel.startsWith("gpt")
        || normalizedModel.startsWith("o1")
        || normalizedModel.startsWith("o3")
        || normalizedModel.startsWith("o4")
    ) {
        return "OpenAI";
    }

    return enableOnDemand ? "Gemini" : "IA";
}

function MatchReportPanel({
    matchWebId,
    matchReport,
    matchReportGeneratedAtUtc,
    matchReportModel,
    subtitle,
    focusTeamIdExtern,
    focusTeamName,
    enableOnDemand = true,
    apiAvailable = true,
    withTopMargin = true
}) {
    const [reportState, setReportState] = useState(() =>
        enableOnDemand && Number(focusTeamIdExtern) > 0
            ? getInitialReportState("", null, "")
            : getInitialReportState(matchReport, matchReportGeneratedAtUtc, matchReportModel));
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        setReportState(
            enableOnDemand && Number(focusTeamIdExtern) > 0
                ? getInitialReportState("", null, "")
                : getInitialReportState(matchReport, matchReportGeneratedAtUtc, matchReportModel)
        );
        setError("");

        if (!enableOnDemand || !apiAvailable || !matchWebId) {
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
    }, [apiAvailable, enableOnDemand, matchWebId, matchReport, matchReportGeneratedAtUtc, matchReportModel, focusTeamIdExtern]);

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

    if (!enableOnDemand && !reportState.summary) {
        return null;
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
    const providerLabel = inferProviderFromModel(reportState.model, enableOnDemand);
    const canGenerate = enableOnDemand && apiAvailable && !!matchWebId;
    const actionLabel = generating
        ? "Generando análisis..."
        : hasReport
            ? "Regenerar análisis"
            : "Generar análisis";
    const cardStyle = withTopMargin
        ? {...styles.card, ...styles.cardWithTopMargin}
        : styles.card;

    return (
        <div style={cardStyle}>
            <div style={styles.header}>
                <div style={styles.titleBlock}>
                    <div style={styles.badgeRow}>
                        <div style={styles.eyebrow}>Análisis IA</div>
                        <div style={styles.providerBadge}>{providerLabel}</div>
                    </div>
                    <div style={styles.title}>Análisis del partido</div>
                    <div style={styles.subtitle}>
                        {subtitle ?? "Resumen generado a partir de los stats y del play-by-play ya descargados."}
                        {enableOnDemand && Number(focusTeamIdExtern) > 0 && focusTeamName
                            ? ` En esta vista, el análisis se enfoca en ${focusTeamName}.`
                            : ""}
                    </div>
                </div>
                {enableOnDemand && matchWebId ? (
                    <button
                        type="button"
                        style={{
                            ...styles.actionButton,
                            ...((isBusy || !canGenerate) ? styles.actionButtonDisabled : {})
                        }}
                        disabled={isBusy || !canGenerate}
                        onClick={() => generateReport(hasReport)}
                    >
                        {canGenerate ? actionLabel : "API no disponible"}
                    </button>
                ) : null}
            </div>

            {enableOnDemand && !apiAvailable ? (
                <div style={styles.notice}>
                    El servicio de análisis no está disponible ahora mismo. Cuando la API vuelva a estar accesible,
                    aquí podrás generar un único análisis del partido.
                </div>
            ) : null}

            {enableOnDemand && loading && !hasReport ? (
                <div style={styles.notice}>Buscando si ya existe un análisis generado para este partido...</div>
            ) : null}

            {error ? (
                <div style={styles.errorNotice}>{error}</div>
            ) : null}

            {!hasReport && !loading && enableOnDemand && apiAvailable ? (
                <div style={styles.notice}>
                    Todavía no hay análisis guardado para este partido. Puedes pedirlo ahora mismo desde aquí.
                </div>
            ) : null}

            {hasReport ? (
                <div style={styles.body}>
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
                </div>
            ) : null}
            {reportState.generatedAtUtc || reportState.model ? (
                <div style={styles.footer}>
                    {reportState.generatedAtUtc ? (
                        <div style={styles.footerItem}>
                            <span style={styles.footerLabel}>Generado</span>
                            <span>{new Date(reportState.generatedAtUtc).toLocaleString("es-ES")}</span>
                        </div>
                    ) : null}
                    {reportState.model ? (
                        <div style={styles.footerItem}>
                            <span style={styles.footerLabel}>Modelo</span>
                            <span>{reportState.model}</span>
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

export default MatchReportPanel;
