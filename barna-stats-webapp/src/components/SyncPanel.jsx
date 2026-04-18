import {useDeferredValue, useEffect, useRef, useState} from "react";
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
    bulkSection: {
        display: "grid",
        gap: 16,
        padding: 18,
        borderRadius: "var(--radius-lg)",
        background: "rgba(255, 249, 242, 0.88)",
        border: "1px solid rgba(107, 86, 58, 0.14)"
    },
    bulkSectionHeader: {
        display: "grid",
        gap: 8
    },
    bulkSectionTitle: {
        margin: 0,
        fontSize: "1.2rem"
    },
    bulkSectionBody: {
        color: "var(--muted)",
        fontSize: 14,
        lineHeight: 1.6
    },
    bulkChoiceGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: 14
    },
    bulkChoiceCard: {
        display: "grid",
        gap: 12,
        padding: 16,
        borderRadius: "var(--radius-md)",
        background: "rgba(255, 251, 245, 0.94)",
        border: "1px solid rgba(107, 86, 58, 0.1)"
    },
    bulkChoiceHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        flexWrap: "wrap"
    },
    bulkChoiceTitle: {
        color: "var(--text)",
        fontSize: 14,
        fontWeight: 800
    },
    compactActions: {
        display: "flex",
        gap: 8,
        flexWrap: "wrap"
    },
    compactButton: {
        minHeight: 34,
        padding: "0 12px",
        borderRadius: 12,
        border: "1px solid rgba(26, 53, 87, 0.12)",
        background: "rgba(255, 251, 245, 0.96)",
        color: "var(--navy)",
        fontWeight: 800,
        cursor: "pointer"
    },
    compactButtonMuted: {
        opacity: 0.7
    },
    toggleWrap: {
        display: "flex",
        gap: 10,
        flexWrap: "wrap"
    },
    toggleChip: {
        minHeight: 40,
        padding: "0 14px",
        borderRadius: 999,
        border: "1px solid rgba(26, 53, 87, 0.12)",
        background: "rgba(255, 251, 245, 0.96)",
        color: "var(--navy)",
        fontWeight: 800,
        cursor: "pointer",
        boxShadow: "var(--shadow-sm)"
    },
    toggleChipActive: {
        background: "linear-gradient(135deg, #1a3557 0%, #bc3f2b 100%)",
        borderColor: "transparent",
        color: "#fff8ef"
    },
    previewSection: {
        display: "grid",
        gap: 14
    },
    previewList: {
        display: "grid",
        gap: 8,
        maxHeight: 260,
        overflowY: "auto"
    },
    previewItem: {
        display: "grid",
        gap: 4,
        padding: "12px 14px",
        borderRadius: "var(--radius-md)",
        background: "rgba(255, 251, 245, 0.94)",
        border: "1px solid rgba(107, 86, 58, 0.1)"
    },
    previewItemTitle: {
        color: "var(--text)",
        fontSize: 14,
        fontWeight: 800
    },
    previewItemMeta: {
        color: "var(--muted)",
        fontSize: 12,
        lineHeight: 1.5
    },
    warningBox: {
        padding: "12px 14px",
        borderRadius: "var(--radius-md)",
        background: "rgba(254, 240, 203, 0.55)",
        border: "1px solid rgba(210, 160, 52, 0.24)",
        color: "#7a5700",
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
    savedSourcesToolbar: {
        display: "grid",
        gap: 12
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
    savedSourcesControls: {
        display: "flex",
        gap: 12,
        flexWrap: "wrap",
        alignItems: "flex-end"
    },
    savedSourcesSearchField: {
        display: "grid",
        gap: 6,
        flex: "1 1 360px",
        minWidth: "min(100%, 320px)"
    },
    savedSourcesSearchLabel: {
        color: "var(--muted)",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase"
    },
    savedSourcesSearchInput: {
        minHeight: 48,
        padding: "0 16px",
        borderRadius: 16,
        border: "1px solid rgba(107, 86, 58, 0.18)",
        background: "rgba(255, 252, 247, 0.94)",
        color: "var(--text)",
        fontSize: 14
    },
    savedSourcesSummaryRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap"
    },
    savedSourcesSummary: {
        color: "var(--muted)",
        fontSize: 13,
        lineHeight: 1.5
    },
    savedSourcesPagination: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
        justifyContent: "flex-end"
    },
    savedSourcesPaginationMeta: {
        color: "var(--muted)",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.06em",
        textTransform: "uppercase"
    },
    savedSourcesPaginationButton: {
        minHeight: 36,
        padding: "0 14px",
        borderRadius: 12,
        border: "1px solid rgba(26, 53, 87, 0.12)",
        background: "rgba(255, 251, 245, 0.96)",
        color: "var(--navy)",
        fontSize: 13,
        fontWeight: 800,
        cursor: "pointer"
    },
    savedSourcesPaginationButtonMuted: {
        opacity: 0.5,
        cursor: "not-allowed"
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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:5071";
const ALL_PHASES_VALUE = "__all__";
const BULK_DISCOVERY_ENDPOINT = `${API_BASE_URL}/api/basquetcatala/discover-batch`;
const DEFAULT_BULK_GENDERS = GENDER_OPTIONS.map((option) => option.value);
const DEFAULT_BULK_TERRITORIES = TERRITORY_OPTIONS.map((option) => option.value);
const SAVED_SOURCES_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function readStoredArray(key, fallback) {
    try {
        const rawValue = window.localStorage.getItem(key);
        if (!rawValue) {
            return fallback;
        }

        const parsedValue = JSON.parse(rawValue);
        if (!Array.isArray(parsedValue)) {
            return fallback;
        }

        const normalizedValues = parsedValue
            .map((value) => String(value ?? "").trim())
            .filter(Boolean);

        return normalizedValues.length > 0 ? normalizedValues : fallback;
    } catch {
        return fallback;
    }
}

function buildBulkScopeKey(genders, territories) {
    return JSON.stringify({
        genders: [...(genders ?? [])].map((value) => String(value)).sort(),
        territories: [...(territories ?? [])].map((value) => String(value)).sort((left, right) => Number(left) - Number(right))
    });
}

function pluralize(value, singular, plural) {
    return `${value} ${value === 1 ? singular : plural}`;
}

function normalizeSearchText(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

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
    const [selectedBulkGenders, setSelectedBulkGenders] = useState(() => readStoredArray("barna-sync-bulk-genders", DEFAULT_BULK_GENDERS));
    const [selectedBulkTerritories, setSelectedBulkTerritories] = useState(() => readStoredArray("barna-sync-bulk-territories", DEFAULT_BULK_TERRITORIES));
    const [bulkPreview, setBulkPreview] = useState(null);
    const [bulkPreviewLoading, setBulkPreviewLoading] = useState(false);
    const [bulkPreviewError, setBulkPreviewError] = useState("");
    const [savedSourcesQuery, setSavedSourcesQuery] = useState("");
    const [savedSourcesPage, setSavedSourcesPage] = useState(1);
    const [savedSourcesPageSize, setSavedSourcesPageSize] = useState(() => {
        const storedValue = Number(window.localStorage.getItem("barna-sync-saved-sources-page-size"));
        return SAVED_SOURCES_PAGE_SIZE_OPTIONS.includes(storedValue) ? storedValue : 25;
    });
    const bulkPreviewControllerRef = useRef(null);
    const deferredSavedSourcesQuery = useDeferredValue(savedSourcesQuery);
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
    const bulkScopeKey = buildBulkScopeKey(selectedBulkGenders, selectedBulkTerritories);
    const hasBulkSelection = selectedBulkGenders.length > 0 && selectedBulkTerritories.length > 0;
    const isBulkPreviewCurrent = bulkPreview?.scopeKey === bulkScopeKey;
    const currentBulkPreview = isBulkPreviewCurrent ? bulkPreview?.payload ?? null : null;
    const isBulkPreviewStale = bulkPreview != null && !isBulkPreviewCurrent;
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

    useEffect(() => {
        window.localStorage.setItem("barna-sync-bulk-genders", JSON.stringify(selectedBulkGenders));
    }, [selectedBulkGenders]);

    useEffect(() => {
        window.localStorage.setItem("barna-sync-bulk-territories", JSON.stringify(selectedBulkTerritories));
    }, [selectedBulkTerritories]);

    useEffect(() => {
        window.localStorage.setItem("barna-sync-saved-sources-page-size", String(savedSourcesPageSize));
    }, [savedSourcesPageSize]);

    useEffect(() => () => {
        bulkPreviewControllerRef.current?.abort();
    }, []);

    const status = job?.status ?? (apiAvailable ? "idle" : "offline");
    const isDeleting = deletingPhaseId != null;
    const isBusy = starting || status === "pending" || status === "running" || isDeleting;
    const canUseApi = apiAvailable && !isBusy;
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

    const toggleBulkGender = (genderValue) => {
        setSelectedBulkGenders((current) => current.includes(genderValue)
            ? current.filter((value) => value !== genderValue)
            : [...current, genderValue]);
    };

    const toggleBulkTerritory = (territoryValue) => {
        setSelectedBulkTerritories((current) => current.includes(territoryValue)
            ? current.filter((value) => value !== territoryValue)
            : [...current, territoryValue]);
    };

    const handleSelectAllBulkGenders = () => {
        setSelectedBulkGenders(DEFAULT_BULK_GENDERS);
    };

    const handleClearBulkGenders = () => {
        setSelectedBulkGenders([]);
    };

    const handleSelectAllBulkTerritories = () => {
        setSelectedBulkTerritories(DEFAULT_BULK_TERRITORIES);
    };

    const handleClearBulkTerritories = () => {
        setSelectedBulkTerritories([]);
    };

    const handlePreviewBulkScope = async () => {
        if (!hasBulkSelection || isBusy) {
            return;
        }

        bulkPreviewControllerRef.current?.abort();

        const controller = new AbortController();
        bulkPreviewControllerRef.current = controller;
        setBulkPreviewLoading(true);
        setBulkPreviewError("");

        try {
            const response = await fetch(BULK_DISCOVERY_ENDPOINT, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                signal: controller.signal,
                body: JSON.stringify({
                    genders: selectedBulkGenders,
                    territories: selectedBulkTerritories.map((value) => Number(value))
                })
            });

            const hasJson = response.headers
                .get("content-type")
                ?.includes("application/json");
            const payload = hasJson ? await response.json() : null;

            if (!response.ok) {
                throw new Error(payload?.detail ?? payload?.error ?? "No se pudo previsualizar la carga masiva.");
            }

            setBulkPreview({
                scopeKey: bulkScopeKey,
                payload
            });
        } catch (err) {
            if (controller.signal.aborted) {
                return;
            }

            setBulkPreviewError(String(err));
        } finally {
            if (bulkPreviewControllerRef.current === controller) {
                bulkPreviewControllerRef.current = null;
            }

            if (!controller.signal.aborted) {
                setBulkPreviewLoading(false);
            }
        }
    };

    const handleStartBulkImport = async () => {
        if (!currentBulkPreview?.sources?.length || isBusy || bulkPreviewLoading) {
            return;
        }

        const description = [
            "Carga masiva",
            pluralize(currentBulkPreview.genders?.length ?? selectedBulkGenders.length, "género", "géneros"),
            pluralize(currentBulkPreview.territories?.length ?? selectedBulkTerritories.length, "territorio", "territorios"),
            pluralize(currentBulkPreview.uniqueCategoryNamesCount ?? 0, "categoría", "categorías"),
            pluralize(currentBulkPreview.uniquePhasesCount ?? currentBulkPreview.sources.length, "fase", "fases")
        ].join(" · ");

        await onStartSyncBatch(currentBulkPreview.sources, description);
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

    const handleSavedSourcesQueryChange = (event) => {
        setSavedSourcesQuery(event.target.value);
        setSavedSourcesPage(1);
    };

    const handleSavedSourcesPageSizeChange = (event) => {
        setSavedSourcesPageSize(Number(event.target.value));
        setSavedSourcesPage(1);
    };

    function formatSourceReference(source) {
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
    }

    function formatLastSync(value) {
        if (!value) {
            return "Nunca";
        }

        return new Date(value).toLocaleString("es-ES");
    }

    const normalizedSavedSourcesQuery = normalizeSearchText(deferredSavedSourcesQuery);
    const filteredSavedSources = (savedSources ?? []).filter((source) => {
        if (!normalizedSavedSourcesQuery) {
            return true;
        }

        const searchText = normalizeSearchText([
            source.categoryName,
            formatSourceReference(source),
            source.phaseId ? `Fase ${source.phaseId}` : "",
            source.sourceUrl
        ].filter(Boolean).join(" "));

        return searchText.includes(normalizedSavedSourcesQuery);
    });
    const savedSourcesPageCount = Math.max(1, Math.ceil(filteredSavedSources.length / savedSourcesPageSize));
    const currentSavedSourcesPage = Math.min(savedSourcesPage, savedSourcesPageCount);
    const paginatedSavedSources = filteredSavedSources.slice(
        (currentSavedSourcesPage - 1) * savedSourcesPageSize,
        currentSavedSourcesPage * savedSourcesPageSize
    );
    const savedSourcesRangeStart = filteredSavedSources.length === 0
        ? 0
        : ((currentSavedSourcesPage - 1) * savedSourcesPageSize) + 1;
    const savedSourcesRangeEnd = filteredSavedSources.length === 0
        ? 0
        : savedSourcesRangeStart + paginatedSavedSources.length - 1;

    useEffect(() => {
        if (savedSourcesPage > savedSourcesPageCount) {
            setSavedSourcesPage(savedSourcesPageCount);
        }
    }, [savedSourcesPage, savedSourcesPageCount]);

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
                    Si aparece un captcha o verificación de seguridad, se abrirá el navegador auxiliar y el proceso
                    esperará sin recargar la página.
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
                        style={(!effectiveSourceUrl && !isAllPhasesSelection) || !apiAvailable || isBusy
                            ? {...styles.button, ...styles.mutedButton}
                            : styles.button}
                        disabled={(!effectiveSourceUrl && !isAllPhasesSelection) || !apiAvailable || isBusy}
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

            <div style={styles.bulkSection}>
                <div style={styles.bulkSectionHeader}>
                    <h3 style={styles.bulkSectionTitle}>Carga masiva</h3>
                    <div style={styles.bulkSectionBody}>
                        Descubre de una vez todas las fases visibles para varios géneros y territorios. El backend
                        expande categorías y fases, deduplica coincidencias y te deja revisar el alcance antes de
                        importar.
                    </div>
                </div>

                <div style={styles.bulkChoiceGrid}>
                    <div style={styles.bulkChoiceCard}>
                        <div style={styles.bulkChoiceHeader}>
                            <div style={styles.bulkChoiceTitle}>Géneros</div>
                            <div style={styles.compactActions}>
                                <button type="button" style={styles.compactButton} onClick={handleSelectAllBulkGenders}>
                                    Todo
                                </button>
                                <button type="button" style={{...styles.compactButton, ...styles.compactButtonMuted}} onClick={handleClearBulkGenders}>
                                    Ninguno
                                </button>
                            </div>
                        </div>

                        <div style={styles.toggleWrap}>
                            {GENDER_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    style={selectedBulkGenders.includes(option.value)
                                        ? {...styles.toggleChip, ...styles.toggleChipActive}
                                        : styles.toggleChip}
                                    onClick={() => toggleBulkGender(option.value)}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={styles.bulkChoiceCard}>
                        <div style={styles.bulkChoiceHeader}>
                            <div style={styles.bulkChoiceTitle}>Territorios</div>
                            <div style={styles.compactActions}>
                                <button type="button" style={styles.compactButton} onClick={handleSelectAllBulkTerritories}>
                                    Todo
                                </button>
                                <button type="button" style={{...styles.compactButton, ...styles.compactButtonMuted}} onClick={handleClearBulkTerritories}>
                                    Ninguno
                                </button>
                            </div>
                        </div>

                        <div style={styles.toggleWrap}>
                            {TERRITORY_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    style={selectedBulkTerritories.includes(option.value)
                                        ? {...styles.toggleChip, ...styles.toggleChipActive}
                                        : styles.toggleChip}
                                    onClick={() => toggleBulkTerritory(option.value)}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div style={styles.builderHint}>
                    Esta primera versión carga siempre todas las categorías y todas las fases del alcance elegido. Si un
                    territorio o categoría solapa con otro, la fase repetida se detecta y se importa una sola vez.
                </div>

                <div style={styles.controls}>
                    <button
                        type="button"
                        style={!hasBulkSelection || !apiAvailable || isBusy || bulkPreviewLoading
                            ? {...styles.button, ...styles.mutedButton}
                            : styles.button}
                        disabled={!hasBulkSelection || !apiAvailable || isBusy || bulkPreviewLoading}
                        onClick={() => void handlePreviewBulkScope()}
                    >
                        {bulkPreviewLoading ? "Previsualizando..." : "Previsualizar alcance"}
                    </button>

                    <button
                        type="button"
                        style={!currentBulkPreview?.sources?.length || !apiAvailable || isBusy || bulkPreviewLoading || isBulkPreviewStale
                            ? {...styles.button, ...styles.mutedButton}
                            : styles.button}
                        disabled={!currentBulkPreview?.sources?.length || !apiAvailable || isBusy || bulkPreviewLoading || isBulkPreviewStale}
                        onClick={() => void handleStartBulkImport()}
                    >
                        {isBusy
                            ? "Importando..."
                            : currentBulkPreview?.sources?.length
                                ? `Importar ${currentBulkPreview.sources.length} fases`
                                : "Importar alcance"}
                    </button>
                </div>

                {!hasBulkSelection ? (
                    <div style={styles.subtleError}>
                        Marca al menos un género y un territorio para construir el alcance.
                    </div>
                ) : null}

                {bulkPreviewError ? (
                    <div style={styles.subtleError}>{bulkPreviewError}</div>
                ) : null}

                {isBulkPreviewStale ? (
                    <div style={styles.warningBox}>
                        La previsualización ya no coincide con la selección actual. Revísala de nuevo antes de lanzar la
                        importación.
                    </div>
                ) : null}

                {currentBulkPreview ? (
                    <div style={styles.previewSection}>
                        <div style={styles.metaGrid}>
                            <div style={styles.metaCard}>
                                <div style={styles.metaLabel}>Géneros</div>
                                <div style={styles.metaValue}>{pluralize(currentBulkPreview.genders?.length ?? 0, "género", "géneros")}</div>
                            </div>
                            <div style={styles.metaCard}>
                                <div style={styles.metaLabel}>Territorios</div>
                                <div style={styles.metaValue}>{pluralize(currentBulkPreview.territories?.length ?? 0, "territorio", "territorios")}</div>
                            </div>
                            <div style={styles.metaCard}>
                                <div style={styles.metaLabel}>Categorías</div>
                                <div style={styles.metaValue}>
                                    {pluralize(currentBulkPreview.uniqueCategoryNamesCount ?? 0, "categoría", "categorías")}
                                    {currentBulkPreview.categoryScopesCount > 0
                                        ? ` · ${pluralize(currentBulkPreview.categoryScopesCount, "ámbito", "ámbitos")}`
                                        : ""}
                                </div>
                            </div>
                            <div style={styles.metaCard}>
                                <div style={styles.metaLabel}>Fases únicas</div>
                                <div style={styles.metaValue}>
                                    {pluralize(currentBulkPreview.uniquePhasesCount ?? currentBulkPreview.sources.length, "fase", "fases")}
                                    {currentBulkPreview.duplicatePhasesSkipped > 0
                                        ? ` · ${currentBulkPreview.duplicatePhasesSkipped} duplicadas omitidas`
                                        : ""}
                                </div>
                            </div>
                        </div>

                        <div style={styles.previewList}>
                            {(currentBulkPreview.categoryScopes ?? []).slice(0, 14).map((scope) => (
                                <div
                                    key={`${scope.gender}:${scope.territory}:${scope.categoryId}`}
                                    style={styles.previewItem}
                                >
                                    <div style={styles.previewItemTitle}>
                                        {scope.genderLabel} · {scope.territoryLabel}
                                    </div>
                                    <div style={styles.previewItemMeta}>
                                        {scope.categoryName} · {pluralize(scope.phasesCount ?? 0, "fase", "fases")}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {(currentBulkPreview.categoryScopes?.length ?? 0) > 14 ? (
                            <div style={styles.builderHint}>
                                Se muestran 14 ámbitos como muestra de un total de {currentBulkPreview.categoryScopes.length}.
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>

            <div style={styles.savedSourcesSection}>
                <div style={styles.savedSourcesHeader}>
                    <div style={styles.savedSourcesHeaderRow}>
                        <h3 style={styles.savedSourcesTitle}>Fases guardadas</h3>
                        <button
                            type="button"
                            style={!savedSources?.length || !apiAvailable || isBusy
                                ? {...styles.inlineTextButton, ...styles.mutedButton}
                                : styles.inlineTextButton}
                            disabled={!savedSources?.length || !apiAvailable || isBusy}
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
                    <div style={styles.savedSourcesToolbar}>
                        <div style={styles.savedSourcesControls}>
                            <label style={styles.savedSourcesSearchField}>
                                <span style={styles.savedSourcesSearchLabel}>Buscar fase</span>
                                <input
                                    type="search"
                                    value={savedSourcesQuery}
                                    onChange={handleSavedSourcesQueryChange}
                                    placeholder="Categoría, nivel, grupo, fase, URL o id"
                                    style={styles.savedSourcesSearchInput}
                                />
                            </label>

                            <PrettySelect
                                label="Por página"
                                value={String(savedSourcesPageSize)}
                                onChange={handleSavedSourcesPageSizeChange}
                                ariaLabel="Selecciona cuántas fases mostrar por página"
                                minWidth="160px"
                            >
                                {SAVED_SOURCES_PAGE_SIZE_OPTIONS.map((option) => (
                                    <option key={option} value={option}>
                                        {option}
                                    </option>
                                ))}
                            </PrettySelect>
                        </div>

                        <div style={styles.savedSourcesSummaryRow}>
                            <div style={styles.savedSourcesSummary}>
                                {normalizedSavedSourcesQuery
                                    ? `${pluralize(filteredSavedSources.length, "coincidencia", "coincidencias")} de ${savedSources.length} fases guardadas`
                                    : `${savedSources.length} fases guardadas`}
                                {paginatedSavedSources.length > 0
                                    ? ` · Mostrando ${savedSourcesRangeStart}-${savedSourcesRangeEnd}`
                                    : ""}
                            </div>

                            <div style={styles.savedSourcesPagination}>
                                <span style={styles.savedSourcesPaginationMeta}>
                                    Página {currentSavedSourcesPage} de {savedSourcesPageCount}
                                </span>
                                <button
                                    type="button"
                                    style={currentSavedSourcesPage <= 1
                                        ? {...styles.savedSourcesPaginationButton, ...styles.savedSourcesPaginationButtonMuted}
                                        : styles.savedSourcesPaginationButton}
                                    disabled={currentSavedSourcesPage <= 1}
                                    onClick={() => setSavedSourcesPage((current) => Math.max(1, current - 1))}
                                >
                                    Anterior
                                </button>
                                <button
                                    type="button"
                                    style={currentSavedSourcesPage >= savedSourcesPageCount
                                        ? {...styles.savedSourcesPaginationButton, ...styles.savedSourcesPaginationButtonMuted}
                                        : styles.savedSourcesPaginationButton}
                                    disabled={currentSavedSourcesPage >= savedSourcesPageCount}
                                    onClick={() => setSavedSourcesPage((current) => Math.min(savedSourcesPageCount, current + 1))}
                                >
                                    Siguiente
                                </button>
                            </div>
                        </div>

                        {paginatedSavedSources.length ? (
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
                                    {paginatedSavedSources.map((source) => (
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
                                                        style={!canUseApi ? {...styles.inlineButton, ...styles.mutedButton} : styles.inlineButton}
                                                        disabled={!canUseApi}
                                                        onClick={() => void handleStartSavedSource(source.sourceUrl)}
                                                        aria-label={`Sincronizar ${formatSourceReference(source)}`}
                                                        title="Sincronizar"
                                                    >
                                                        <SyncActionIcon/>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        style={!canUseApi || !source.phaseId
                                                            ? {...styles.inlineButton, ...styles.inlineDangerButton, ...styles.mutedButton}
                                                            : {...styles.inlineButton, ...styles.inlineDangerButton}}
                                                        disabled={!canUseApi || !source.phaseId}
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
                                No hay fases guardadas que coincidan con la búsqueda actual.
                            </div>
                        )}
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
