import {useEffect, useState} from "react";
import PrettySelect from "./PrettySelect.jsx";
import {
    buildResultsUrl,
    GENDER_OPTIONS,
    TERRITORY_OPTIONS,
    useBasquetCatalaSourceBuilder
} from "../hooks/useBasquetCatalaSourceBuilder.js";

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
    builderSection: {
        display: "grid",
        gap: 16,
        padding: 18,
        borderRadius: "var(--radius-lg)",
        background: "rgba(255, 251, 245, 0.82)",
        border: "1px solid rgba(107, 86, 58, 0.12)"
    },
    builderGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 14
    },
    builderHint: {
        color: "var(--muted)",
        fontSize: 13,
        lineHeight: 1.6
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
    readOnlyInput: {
        background: "rgba(246, 237, 224, 0.94)",
        color: "var(--navy)"
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
    inlineTextButton: {
        minHeight: 40,
        padding: "0 16px",
        borderRadius: 14,
        border: "none",
        background: "linear-gradient(135deg, #1a3557 0%, #bc3f2b 100%)",
        color: "#fff8ef",
        fontWeight: 800,
        cursor: "pointer",
        boxShadow: "0 12px 22px rgba(40, 30, 21, 0.12)"
    },
    inlineButton: {
        minHeight: 40,
        minWidth: 40,
        width: 40,
        padding: 0,
        borderRadius: 14,
        border: "none",
        background: "linear-gradient(135deg, #1a3557 0%, #bc3f2b 100%)",
        color: "#fff8ef",
        fontWeight: 800,
        cursor: "pointer",
        boxShadow: "0 12px 22px rgba(40, 30, 21, 0.12)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center"
    },
    inlineDangerButton: {
        background: "linear-gradient(135deg, #7f2218 0%, #bc3f2b 100%)"
    },
    inlineActions: {
        display: "flex",
        gap: 8,
        flexWrap: "wrap"
    },
    actionIcon: {
        width: 18,
        height: 18,
        display: "block"
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
    subtleError: {
        color: "#9d2618",
        fontSize: 13,
        lineHeight: 1.6
    },
    manualSection: {
        display: "grid",
        gap: 12
    },
    sectionLabel: {
        color: "var(--muted)",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase"
    },
    savedSourcesSection: {
        display: "grid",
        gap: 12
    },
    savedSourcesHeader: {
        display: "grid",
        gap: 10
    },
    savedSourcesHeaderRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap"
    },
    savedSourcesTitle: {
        margin: 0,
        fontSize: "1.2rem"
    },
    savedSourcesHelper: {
        color: "var(--muted)",
        fontSize: 14,
        lineHeight: 1.6
    },
    savedSourcesTableShell: {
        overflowX: "auto",
        borderRadius: "var(--radius-lg)",
        border: "1px solid rgba(107, 86, 58, 0.12)",
        background: "rgba(255, 251, 245, 0.78)"
    },
    savedSourcesTable: {
        width: "100%",
        minWidth: 760,
        borderCollapse: "collapse"
    },
    savedSourcesHeaderCell: {
        padding: "14px 16px",
        textAlign: "left",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--muted)",
        borderBottom: "1px solid rgba(107, 86, 58, 0.12)"
    },
    savedSourcesBodyCell: {
        padding: "16px",
        fontSize: 14,
        lineHeight: 1.55,
        borderBottom: "1px solid rgba(107, 86, 58, 0.08)",
        verticalAlign: "middle"
    },
    savedSourcePrimary: {
        fontWeight: 800,
        color: "var(--text)"
    },
    savedSourceSecondary: {
        marginTop: 4,
        color: "var(--muted)",
        fontSize: 12,
        wordBreak: "break-word"
    },
    savedSourcesEmpty: {
        padding: 16,
        borderRadius: "var(--radius-md)",
        background: "rgba(255, 251, 245, 0.88)",
        border: "1px dashed rgba(107, 86, 58, 0.16)",
        color: "var(--muted)"
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

const ALL_PHASES_VALUE = "__all__";

function SyncActionIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={styles.actionIcon} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 11a8 8 0 0 0-13.66-5.66"/>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 5v4h4"/>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 13a8 8 0 0 0 13.66 5.66"/>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 19v-4h-4"/>
        </svg>
    );
}

function TrashActionIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={styles.actionIcon} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16"/>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v6"/>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 11v6"/>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/>
        </svg>
    );
}

function SyncPanel({
    apiAvailable,
    job,
    starting,
    error,
    savedSources,
    savedSourcesLoading,
    savedSourcesError,
    deletingPhaseId,
    onStartSync,
    onStartSyncBatch,
    onStartSyncAllSavedSources,
    onDeleteSavedSource
}) {
    const [manualSourceUrl, setManualSourceUrl] = useState(() => window.localStorage.getItem("barna-sync-source-url") ?? "");
    const [selectedGender, setSelectedGender] = useState(() => window.localStorage.getItem("barna-sync-gender") ?? "F");
    const [selectedTerritory, setSelectedTerritory] = useState(() => window.localStorage.getItem("barna-sync-territory") ?? "0");
    const [selectedCategory, setSelectedCategory] = useState(() => window.localStorage.getItem("barna-sync-category") ?? "");
    const [selectedPhase, setSelectedPhase] = useState(() => window.localStorage.getItem("barna-sync-phase") ?? "");
    const {
        categories,
        categoriesLoading,
        categoriesError,
        phases,
        phasesLoading,
        phasesError
    } = useBasquetCatalaSourceBuilder(true, selectedGender, selectedTerritory, selectedCategory);
    const canSyncAllPhases = phases.length > 1;
    const effectiveSelectedCategory = categories.some((option) => option.value === selectedCategory)
        ? selectedCategory
        : "";
    const effectiveSelectedPhase = phases.some((option) => option.value === selectedPhase)
        ? selectedPhase
        : (selectedPhase === ALL_PHASES_VALUE && canSyncAllPhases ? ALL_PHASES_VALUE : "");
    const isAllPhasesSelection = effectiveSelectedPhase === ALL_PHASES_VALUE;
    const selectedCategoryLabel = categories.find((option) => option.value === effectiveSelectedCategory)?.label ?? "";
    const selectedGenderLabel = GENDER_OPTIONS.find((option) => option.value === selectedGender)?.label ?? selectedGender;
    const selectedTerritoryLabel = TERRITORY_OPTIONS.find((option) => option.value === selectedTerritory)?.label ?? selectedTerritory;
    const batchSources = isAllPhasesSelection
        ? phases.map((option) => ({
            sourceUrl: buildResultsUrl(option.value),
            label: option.label
        }))
        : [];
    const generatedSourceUrl = buildResultsUrl(effectiveSelectedPhase);
    const generatedSelectionSummary = isAllPhasesSelection
        ? `${batchSources.length} fases seleccionadas`
        : generatedSourceUrl;
    const effectiveSourceUrl = generatedSourceUrl || manualSourceUrl.trim();
    const scopeLabel = job?.sourceKind === "phase"
        ? `Fase ${job.sourceId ?? "-"}`
        : job?.sourceKind === "registry"
            ? "Todas las fases guardadas"
            : job?.sourceKind === "selection"
                ? `Selección de ${job.sourceId ?? "-"} fases`
            : job
                ? "Fuente manual"
                : "";

    useEffect(() => {
        window.localStorage.setItem("barna-sync-source-url", manualSourceUrl);
    }, [manualSourceUrl]);

    useEffect(() => {
        window.localStorage.setItem("barna-sync-gender", selectedGender);
    }, [selectedGender]);

    useEffect(() => {
        window.localStorage.setItem("barna-sync-territory", selectedTerritory);
    }, [selectedTerritory]);

    useEffect(() => {
        window.localStorage.setItem("barna-sync-category", selectedCategory);
    }, [selectedCategory]);

    useEffect(() => {
        window.localStorage.setItem("barna-sync-phase", selectedPhase);
    }, [selectedPhase]);

    const status = job?.status ?? (apiAvailable ? "idle" : "offline");
    const isDeleting = deletingPhaseId != null;
    const isBusy = starting || status === "pending" || status === "running" || isDeleting;
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

        if (isBusy) {
            return;
        }

        if (isAllPhasesSelection) {
            if (!batchSources.length) {
                return;
            }

            const description = [
                selectedGenderLabel,
                selectedTerritoryLabel,
                selectedCategoryLabel,
                "Todas las fases"
            ].filter(Boolean).join(" · ");

            await onStartSyncBatch(batchSources, description);
            return;
        }

        if (!effectiveSourceUrl) {
            return;
        }

        await onStartSync(effectiveSourceUrl);
    };

    const handleStartSavedSource = async (savedSourceUrl) => {
        if (!savedSourceUrl || isBusy) {
            return;
        }

        setManualSourceUrl(savedSourceUrl);
        await onStartSync(savedSourceUrl);
    };

    const handleGenderChange = (event) => {
        setSelectedGender(event.target.value);
        setSelectedCategory("");
        setSelectedPhase("");
    };

    const handleTerritoryChange = (event) => {
        setSelectedTerritory(event.target.value);
        setSelectedCategory("");
        setSelectedPhase("");
    };

    const handleCategoryChange = (event) => {
        setSelectedCategory(event.target.value);
        setSelectedPhase("");
    };

    const handlePhaseChange = (event) => {
        setSelectedPhase(event.target.value);
    };

    const handleStartAllSavedSources = async () => {
        if (!savedSources?.length || isBusy) {
            return;
        }

        await onStartSyncAllSavedSources();
    };

    const handleDeleteSavedSource = async (source) => {
        if (!source?.phaseId || isBusy) {
            return;
        }

        const confirmed = window.confirm(
            `Se borrará la fase guardada "${formatSourceReference(source)}" y sus datos descargados.`
        );

        if (!confirmed) {
            return;
        }

        await onDeleteSavedSource?.(Number(source.phaseId));
    };

    const formatSourceReference = (source) => {
        const parts = [
            source.levelName,
            source.groupCode ? `Grupo ${source.groupCode}` : "",
            source.phaseName
        ].filter(Boolean);

        if (parts.length > 0) {
            return parts.join(" · ");
        }

        if (source.phaseId) {
            return `Fase ${source.phaseId}`;
        }

        return "Fuente sin referencia";
    };

    const formatLastSync = (value) => {
        if (!value) {
            return "Nunca";
        }

        return new Date(value).toLocaleString("es-ES");
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
                    Selecciona género, territorio, categoría y fase para construir la URL oficial por detrás. La app
                    obtendrá los partidos de la fase, descargará `stats` y `moves` y actualizará el análisis de la web.
                    Si aparece un captcha, se abrirá el navegador auxiliar.
                </div>
            </div>

            <div style={styles.builderSection}>
                <div style={styles.builderGrid}>
                    <PrettySelect
                        label="Género"
                        value={selectedGender}
                        onChange={handleGenderChange}
                        ariaLabel="Selecciona género"
                        minWidth="220px"
                    >
                        {GENDER_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </PrettySelect>

                    <PrettySelect
                        label="Territorio"
                        value={selectedTerritory}
                        onChange={handleTerritoryChange}
                        ariaLabel="Selecciona territorio"
                        minWidth="240px"
                    >
                        {TERRITORY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </PrettySelect>

                    <PrettySelect
                        label="Categoría"
                        value={effectiveSelectedCategory}
                        onChange={handleCategoryChange}
                        ariaLabel="Selecciona categoría"
                        minWidth="280px"
                    >
                        <option value="">
                            {categoriesLoading
                                ? "Cargando categorías..."
                                : categories.length > 0
                                    ? "Selecciona categoría"
                                    : "No hay categorías"}
                        </option>
                        {categories.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </PrettySelect>

                    <PrettySelect
                        label="Fase"
                        value={effectiveSelectedPhase}
                        onChange={handlePhaseChange}
                        ariaLabel="Selecciona fase"
                        minWidth="280px"
                    >
                        <option value="">
                            {!selectedCategory
                                ? "Selecciona categoría primero"
                                : phasesLoading
                                    ? "Cargando fases..."
                                    : phases.length > 0
                                        ? "Selecciona fase"
                                        : "No hay fases"}
                        </option>
                        {canSyncAllPhases ? (
                            <option value={ALL_PHASES_VALUE}>
                                {`Todas las fases (${phases.length})`}
                            </option>
                        ) : null}
                        {phases.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </PrettySelect>
                </div>

                <div style={styles.builderHint}>
                    La URL final se construye automáticamente a partir de la fase elegida. Si marcas `Todas las fases`,
                    se lanzará un batch con todas las fases visibles de esa categoría.
                </div>

                {categoriesError ? (
                    <div style={styles.subtleError}>{categoriesError}</div>
                ) : null}

                {phasesError ? (
                    <div style={styles.subtleError}>{phasesError}</div>
                ) : null}
            </div>

            <div style={styles.manualSection}>
                <div style={styles.sectionLabel}>URL generada</div>
                <div style={styles.controls}>
                    <input
                        type="text"
                        value={generatedSelectionSummary}
                        placeholder="Selecciona una fase para generar la URL de resultados"
                        style={{...styles.input, ...styles.readOnlyInput}}
                        readOnly
                    />
                    <button
                        type="submit"
                        style={(!effectiveSourceUrl && !isAllPhasesSelection) || isBusy
                            ? {...styles.button, ...styles.mutedButton}
                            : styles.button}
                        disabled={(!effectiveSourceUrl && !isAllPhasesSelection) || isBusy}
                    >
                        {isBusy
                            ? "Importando..."
                            : isAllPhasesSelection
                                ? "Importar todas las fases"
                                : "Importar fase"}
                    </button>
                </div>
                <div style={styles.builderHint}>
                    Si no eliges una fase, puedes seguir usando una URL manual como alternativa.
                </div>
            </div>

            <div style={styles.manualSection}>
                <div style={styles.sectionLabel}>URL manual opcional</div>
                <div style={styles.controls}>
                    <input
                        type="url"
                        value={manualSourceUrl}
                        onChange={(event) => setManualSourceUrl(event.target.value)}
                        placeholder="https://www.basquetcatala.cat/competicions/resultats/20855/0"
                        style={styles.input}
                        disabled={isBusy || Boolean(generatedSourceUrl) || isAllPhasesSelection}
                    />
                </div>
                <div style={styles.builderHint}>
                    La URL manual solo se usa cuando no hay una fase seleccionada en los desplegables.
                </div>
            </div>

            <div style={styles.controls}>
                <input
                    type="text"
                    value={isAllPhasesSelection ? generatedSelectionSummary : effectiveSourceUrl}
                    placeholder="La fuente activa aparecerá aquí"
                    style={{...styles.input, ...styles.readOnlyInput}}
                    readOnly
                />
            </div>

            <div style={styles.savedSourcesSection}>
                <div style={styles.savedSourcesHeader}>
                    <div style={styles.savedSourcesHeaderRow}>
                        <h3 style={styles.savedSourcesTitle}>Fases guardadas</h3>
                        <button
                            type="button"
                            style={!savedSources?.length || isBusy
                                ? {...styles.inlineTextButton, ...styles.mutedButton}
                                : styles.inlineTextButton}
                            disabled={!savedSources?.length || isBusy}
                            onClick={() => void handleStartAllSavedSources()}
                        >
                            {isBusy ? "Sincronizando..." : "Sincronizar todo"}
                        </button>
                    </div>
                    <div style={styles.savedSourcesHelper}>
                        Aquí quedan registradas las URLs de resultados ya usadas para que puedas repetir la sincronización sin volver a pegarlas. `Sincronizar todo` reutiliza la caché y solo descarga lo que falte o cambie.
                    </div>
                </div>

                {savedSourcesLoading ? (
                    <div style={styles.savedSourcesEmpty}>Cargando fases guardadas...</div>
                ) : savedSourcesError ? (
                    <div style={styles.error}>{savedSourcesError}</div>
                ) : savedSources?.length ? (
                    <div style={styles.savedSourcesTableShell}>
                        <table style={styles.savedSourcesTable}>
                            <thead>
                            <tr>
                                <th style={styles.savedSourcesHeaderCell}>Categoría</th>
                                <th style={styles.savedSourcesHeaderCell}>Referencia</th>
                                <th style={styles.savedSourcesHeaderCell}>Última sincronización</th>
                                <th style={styles.savedSourcesHeaderCell}>Acción</th>
                            </tr>
                            </thead>
                            <tbody>
                            {savedSources.map((source) => (
                                <tr key={source.sourceUrl}>
                                    <td style={styles.savedSourcesBodyCell}>
                                        {source.categoryName || "Sin categoría"}
                                    </td>
                                    <td style={styles.savedSourcesBodyCell}>
                                        <div style={styles.savedSourcePrimary}>{formatSourceReference(source)}</div>
                                        <div style={styles.savedSourceSecondary}>{source.sourceUrl}</div>
                                    </td>
                                    <td style={styles.savedSourcesBodyCell}>
                                        {formatLastSync(source.lastSyncedAtUtc)}
                                    </td>
                                    <td style={styles.savedSourcesBodyCell}>
                                        <div style={styles.inlineActions}>
                                            <button
                                                type="button"
                                                style={isBusy ? {...styles.inlineButton, ...styles.mutedButton} : styles.inlineButton}
                                                disabled={isBusy}
                                                onClick={() => void handleStartSavedSource(source.sourceUrl)}
                                                aria-label={`Sincronizar ${formatSourceReference(source)}`}
                                                title="Sincronizar"
                                            >
                                                <SyncActionIcon/>
                                            </button>
                                            <button
                                                type="button"
                                                style={isBusy || !source.phaseId
                                                    ? {...styles.inlineButton, ...styles.inlineDangerButton, ...styles.mutedButton}
                                                    : {...styles.inlineButton, ...styles.inlineDangerButton}}
                                                disabled={isBusy || !source.phaseId}
                                                onClick={() => void handleDeleteSavedSource(source)}
                                                aria-label={`Borrar ${formatSourceReference(source)}`}
                                                title={deletingPhaseId === source.phaseId ? "Borrando..." : "Borrar"}
                                            >
                                                <TrashActionIcon/>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div style={styles.savedSourcesEmpty}>
                        Todavía no hay fases guardadas. Cuando sincronices una URL de resultados, aparecerá aquí.
                    </div>
                )}
            </div>

            {job ? (
                <div style={styles.metaGrid}>
                    <div style={styles.metaCard}>
                        <div style={styles.metaLabel}>Ámbito</div>
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
