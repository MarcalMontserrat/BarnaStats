import {lazy, Suspense, useEffect, useMemo, useRef, useState} from "react";
import AutocompleteField from "./components/AutocompleteField.jsx";
import DeferredArchivePrompt from "./components/DeferredArchivePrompt.jsx";
import PrettySelect from "./components/PrettySelect.jsx";
import TeamBadge from "./components/TeamBadge.jsx";
import {useAnalysisData} from "./hooks/useAnalysisData.js";
import {useResultsSources} from "./hooks/useResultsSources.js";
import {useSyncJob} from "./hooks/useSyncJob.js";
import {
    aggregateStandingRows,
    buildCategoryOptionsFromRows,
    buildCompetitionPhaseLabel,
    buildCompetitionPhaseOptions,
    buildGenderOptions,
    buildPhaseScopeKey,
    buildStandingsFromScopes,
    buildTeamRecord,
    buildTeamPhaseOptions,
    buildPhaseComparison,
    buildPhaseSummaries,
    buildTeamRoute,
    buildLatestTeamContextByKey,
    buildLevelOptionsFromRows,
    filterRowsByCategory,
    filterRowsByGender,
    filterRowsByLevel,
    filterRowsByPhaseOption,
    getCategoryGender,
    getLongestWinStreak
} from "./utils/analysisDerived.js";
import {
    buildPlayersArray,
    getChartData,
    getMvp,
    getPlayersList,
    getSelectedPlayerSummary,
    getTeamAverage,
    getTopGlobalPlayers,
    getTopTeamPlayers,
    getTopScorer,
    getVisibleMatches,
    groupPlayersByMatch,
    sortMatches,
    sortPlayers
} from "./utils/playerStats.js";
import {
    buildClubRoute,
    buildCompareRoute,
    buildCompetitionRoute,
    buildDashboardRoute,
    buildDefaultRoute,
    buildHistoryRoute,
    buildPlayersRoute,
    getPageMetadata,
    parseHash,
    SYNC_ROUTE
} from "./utils/appRoutes.js";
import {getClubBrandingForTeam} from "./utils/clubBranding.js";
import {sortFilterOptions} from "./utils/filterOptions.js";

const GlobalLeadersSection = lazy(() => import("./components/GlobalLeadersSection.jsx"));
const PhaseComparisonSection = lazy(() => import("./components/PhaseComparisonSection.jsx"));
const StandingsSection = lazy(() => import("./components/StandingsSection.jsx"));
const CompetitionResultsSection = lazy(() => import("./components/CompetitionResultsSection.jsx"));
const TeamLeadersSection = lazy(() => import("./components/TeamLeadersSection.jsx"));
const TeamSnapshotSection = lazy(() => import("./components/TeamSnapshotSection.jsx"));
const PlayerEvolutionSection = lazy(() => import("./components/PlayerEvolutionSection.jsx"));
const MatchListSection = lazy(() => import("./components/MatchListSection.jsx"));
const SyncPanel = lazy(() => import("./components/SyncPanel.jsx"));
const ClubOverviewSection = lazy(() => import("./components/ClubOverviewSection.jsx"));
const TeamCompareSection = lazy(() => import("./components/TeamCompareSection.jsx"));
const PlayerCompareSection = lazy(() => import("./components/PlayerCompareSection.jsx"));
const EMPTY_LIST = [];

const COMPETITION_TABS = [
    {
        id: "standings",
        label: "Clasificación",
        description: "Tabla general o por fase para situar a cada equipo."
    },
    {
        id: "matches",
        label: "Partidos",
        description: "Listado de resultados de la competición."
    },
    {
        id: "leaders",
        label: "Jugadoras destacadas",
        description: "Ranking global de valoración media y anotación."
    }
];
const TEAM_TABS = [
    {
        id: "snapshot",
        label: "Resumen",
        description: "Balance, posición, racha y quién está marcando diferencias en el tramo visible."
    },
    {
        id: "leaders",
        label: "Líderes",
        description: "Las jugadoras más determinantes del equipo por valoración y anotación."
    },
    {
        id: "phases",
        label: "Fases",
        description: "Comparativa entre fases o tramos para ver si el equipo mejora o cae."
    },
    {
        id: "evolution",
        label: "Evolución",
        description: "Curva partido a partido de cada jugadora en puntos y valoración."
    },
    {
        id: "matches",
        label: "Partidos",
        description: "Listado de encuentros con marcador, detalle individual y resumen si existe."
    }
];

const appStyles = {
    page: {
        position: "relative",
        minHeight: "100vh",
        overflow: "hidden",
        padding: "clamp(18px, 3vw, 34px)"
    },
    glowPrimary: {
        position: "absolute",
        top: -120,
        left: -80,
        width: 340,
        height: 340,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(188, 63, 43, 0.22) 0%, rgba(188, 63, 43, 0) 72%)",
        filter: "blur(8px)",
        animation: "float-glow 8s ease-in-out infinite alternate",
        pointerEvents: "none"
    },
    glowSecondary: {
        position: "absolute",
        right: -100,
        top: 80,
        width: 360,
        height: 360,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(26, 53, 87, 0.18) 0%, rgba(26, 53, 87, 0) 72%)",
        filter: "blur(10px)",
        animation: "float-glow 10s ease-in-out infinite alternate-reverse",
        pointerEvents: "none"
    },
    container: {
        position: "relative",
        zIndex: 1,
        maxWidth: 1280,
        margin: "0 auto",
        display: "grid",
        gap: 24
    },
    topBar: {
        display: "grid",
        gap: 18,
        animation: "fade-up 650ms ease both"
    },
    topBarActions: {
        display: "grid",
        justifyItems: "start"
    },
    brand: {
        display: "grid",
        gap: 6
    },
    eyebrow: {
        color: "var(--accent)",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        margin: 0
    },
    brandTitle: {
        fontSize: "clamp(2rem, 4vw, 3.3rem)",
        lineHeight: 0.95
    },
    brandNote: {
        color: "var(--muted)",
        maxWidth: 540,
        fontSize: 15
    },
    nav: {
        display: "flex",
        gap: 10,
        flexWrap: "wrap"
    },
    navLink: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 44,
        padding: "0 18px",
        borderRadius: 999,
        textDecoration: "none",
        fontWeight: 800,
        border: "1px solid rgba(26, 53, 87, 0.14)",
        color: "var(--navy)",
        background: "rgba(255, 251, 245, 0.78)",
        boxShadow: "var(--shadow-sm)",
        backdropFilter: "blur(10px)"
    },
    navLinkActive: {
        background: "linear-gradient(135deg, #1a3557 0%, #2d567b 100%)",
        borderColor: "transparent",
        color: "#fff"
    },
    hero: {
        display: "grid",
        gap: 22,
        padding: "clamp(20px, 4vw, 34px)",
        borderRadius: "var(--radius-xl)",
        background: "linear-gradient(135deg, rgba(19, 32, 51, 0.96) 0%, rgba(53, 28, 34, 0.92) 54%, rgba(143, 44, 29, 0.9) 100%)",
        color: "#fff7ef",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "0 28px 70px rgba(22, 18, 15, 0.22)",
        overflow: "hidden",
        position: "relative",
        animation: "fade-up 720ms ease both"
    },
    heroPattern: {
        position: "absolute",
        inset: 0,
        background: "linear-gradient(120deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 24%), repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 72px)",
        pointerEvents: "none"
    },
    heroContent: {
        position: "relative",
        zIndex: 1,
        display: "grid",
        gap: 20
    },
    heroHeader: {
        display: "grid",
        gap: 10
    },
    heroIdentity: {
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1fr)",
        gap: 18,
        alignItems: "center"
    },
    heroIdentityText: {
        display: "grid",
        gap: 10,
        minWidth: 0
    },
    heroKicker: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 999,
        background: "rgba(255, 248, 238, 0.12)",
        width: "fit-content",
        fontSize: 12,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        fontWeight: 800
    },
    heroTitle: {
        fontSize: "clamp(2.3rem, 4vw, 4.2rem)",
        lineHeight: 0.95,
        color: "#fff7ef"
    },
    heroSummary: {
        color: "rgba(255, 243, 227, 0.82)",
        fontSize: 16,
        maxWidth: 760
    },
    heroMetaRow: {
        display: "flex",
        gap: 10,
        flexWrap: "wrap"
    },
    metaChip: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 14px",
        borderRadius: 999,
        background: "rgba(255, 248, 238, 0.1)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        color: "#fff8f0",
        fontSize: 13,
        fontWeight: 700
    },
    filterDeck: {
        display: "flex",
        gap: 14,
        flexWrap: "wrap"
    },
    teamSelectorSection: {
        position: "relative",
        zIndex: 6,
        display: "grid",
        gap: 18,
        padding: "clamp(20px, 4vw, 30px)",
        borderRadius: "var(--radius-xl)",
        background: "linear-gradient(160deg, rgba(255, 252, 247, 0.92) 0%, rgba(247, 238, 225, 0.94) 100%)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-md)",
        animation: "fade-up 700ms ease both"
    },
    teamSelectorHeader: {
        display: "grid",
        gap: 10,
        maxWidth: 780
    },
    teamSelectorTitle: {
        fontSize: "clamp(1.9rem, 3vw, 2.8rem)"
    },
    teamSelectorBody: {
        color: "var(--muted)",
        lineHeight: 1.6
    },
    teamSelectorMetaRow: {
        display: "flex",
        gap: 10,
        flexWrap: "wrap"
    },
    teamSelectorChip: {
        display: "inline-flex",
        alignItems: "center",
        minHeight: 38,
        padding: "0 14px",
        borderRadius: 999,
        background: "rgba(255, 250, 243, 0.96)",
        border: "1px solid rgba(107, 86, 58, 0.14)",
        color: "var(--navy)",
        fontSize: 13,
        fontWeight: 700
    },
    heroActions: {
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "flex-end",
        gap: 16,
        flexWrap: "wrap"
    },
    teamScopeSection: {
        display: "grid",
        gap: 16,
        padding: "clamp(18px, 3vw, 26px)",
        borderRadius: "var(--radius-xl)",
        background: "linear-gradient(180deg, rgba(255, 251, 245, 0.9) 0%, rgba(248, 240, 229, 0.92) 100%)",
        border: "1px solid rgba(107, 86, 58, 0.14)",
        boxShadow: "var(--shadow-md)",
        animation: "fade-up 760ms ease both"
    },
    teamScopeHeader: {
        display: "grid",
        gap: 8,
        maxWidth: 760
    },
    teamScopeTitle: {
        fontSize: "clamp(1.5rem, 2.4vw, 2rem)"
    },
    teamScopeBody: {
        color: "var(--muted)",
        lineHeight: 1.6
    },
    teamScopeActions: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        gap: 16,
        flexWrap: "wrap"
    },
    teamScopeMetaRow: {
        display: "flex",
        gap: 10,
        flexWrap: "wrap"
    },
    teamScopeChip: {
        display: "inline-flex",
        alignItems: "center",
        minHeight: 38,
        padding: "0 14px",
        borderRadius: 999,
        background: "rgba(255, 251, 245, 0.94)",
        border: "1px solid rgba(107, 86, 58, 0.14)",
        color: "var(--navy)",
        fontSize: 13,
        fontWeight: 700
    },
    emptyState: {
        background: "linear-gradient(180deg, rgba(255, 252, 247, 0.92) 0%, rgba(252, 246, 239, 0.88) 100%)",
        padding: 28,
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-md)",
        border: "1px solid var(--border)",
        color: "var(--muted)"
    },
    loadingCard: {
        padding: 24,
        borderRadius: "var(--radius-lg)",
        background: "rgba(255, 251, 245, 0.86)",
        border: "1px solid rgba(107, 86, 58, 0.12)",
        boxShadow: "var(--shadow-sm)",
        color: "var(--muted)"
    },
    syncPage: {
        display: "grid",
        gap: 18,
        animation: "fade-up 720ms ease both"
    },
    syncIntro: {
        display: "grid",
        gap: 12,
        padding: "clamp(20px, 4vw, 30px)",
        borderRadius: "var(--radius-xl)",
        background: "linear-gradient(160deg, rgba(255, 252, 247, 0.9) 0%, rgba(249, 239, 226, 0.92) 100%)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-md)"
    },
    syncEyebrow: {
        color: "var(--accent)",
        fontSize: 12,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.16em"
    },
    syncTitle: {
        fontSize: "clamp(2rem, 3vw, 3.2rem)"
    },
    syncBody: {
        maxWidth: 760,
        color: "var(--muted)",
        lineHeight: 1.6
    },
    secondaryLink: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 44,
        padding: "0 18px",
        borderRadius: 999,
        textDecoration: "none",
        fontWeight: 800,
        color: "#fff8f0",
        background: "rgba(255, 248, 238, 0.12)",
        border: "1px solid rgba(255, 255, 255, 0.16)",
        backdropFilter: "blur(10px)"
    },
    pageShell: {
        display: "grid",
        gap: 18,
        animation: "fade-up 720ms ease both"
    },
    competitionTabs: {
        display: "grid",
        gap: 12
    },
    competitionTabRow: {
        display: "flex",
        gap: 10,
        flexWrap: "wrap"
    },
    competitionTab: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 44,
        padding: "0 18px",
        borderRadius: 999,
        border: "1px solid rgba(26, 53, 87, 0.12)",
        background: "rgba(255, 251, 245, 0.86)",
        color: "var(--navy)",
        fontWeight: 800,
        cursor: "pointer",
        boxShadow: "var(--shadow-sm)"
    },
    competitionTabActive: {
        background: "linear-gradient(135deg, #1a3557 0%, #2d567b 100%)",
        borderColor: "transparent",
        color: "#fff7ef"
    },
    competitionTabHint: {
        color: "var(--muted)",
        fontSize: 14,
        lineHeight: 1.6
    },
    seasonCards: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
        gap: 18
    },
    seasonCard: {
        display: "grid",
        gap: 18,
        padding: "22px 20px",
        borderRadius: "var(--radius-xl)",
        background: "linear-gradient(180deg, rgba(255, 252, 247, 0.94) 0%, rgba(248, 240, 229, 0.94) 100%)",
        border: "1px solid rgba(107, 86, 58, 0.14)",
        boxShadow: "var(--shadow-md)"
    },
    seasonCardHeader: {
        display: "grid",
        gap: 8
    },
    seasonCardIdentity: {
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1fr)",
        gap: 14,
        alignItems: "center"
    },
    seasonCardIdentityText: {
        display: "grid",
        gap: 8,
        minWidth: 0
    },
    seasonCardEyebrow: {
        color: "var(--accent)",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.12em",
        textTransform: "uppercase"
    },
    seasonCardTitle: {
        fontSize: "clamp(1.55rem, 2vw, 2rem)"
    },
    seasonCardMeta: {
        color: "var(--muted)",
        fontSize: 14,
        lineHeight: 1.6
    },
    seasonMetricsGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))",
        gap: 12
    },
    seasonMetricCard: {
        display: "grid",
        gap: 6,
        padding: "14px 16px",
        borderRadius: "var(--radius-md)",
        background: "rgba(255, 251, 245, 0.94)",
        border: "1px solid rgba(107, 86, 58, 0.1)"
    },
    seasonMetricLabel: {
        color: "var(--muted)",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase"
    },
    seasonMetricValue: {
        fontFamily: "var(--font-display)",
        fontSize: "1.65rem",
        lineHeight: 0.95
    },
    seasonMetricMeta: {
        color: "var(--muted)",
        fontSize: 13
    },
    aggregateGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
        gap: 14
    },
    pageBackLink: {
        display: "inline-flex",
        alignItems: "center",
        width: "fit-content",
        minHeight: 40,
        padding: "0 16px",
        borderRadius: 999,
        textDecoration: "none",
        color: "var(--navy)",
        background: "rgba(255, 251, 245, 0.86)",
        border: "1px solid rgba(26, 53, 87, 0.12)",
        boxShadow: "var(--shadow-sm)",
        fontWeight: 800
    }
};

function SectionFallback({message}) {
    return (
        <div style={appStyles.loadingCard}>
            {message}
        </div>
    );
}

function formatDecimal(value, digits = 1) {
    return Number(value ?? 0).toLocaleString("es-ES", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    });
}

function formatSignedNumber(value, digits = 0) {
    const number = Number(value ?? 0);
    const prefix = number > 0 ? "+" : "";

    return `${prefix}${number.toLocaleString("es-ES", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    })}`;
}

function formatRecordLine(record) {
    if ((record?.ties ?? 0) > 0) {
        return `${record?.wins ?? 0}-${record?.losses ?? 0}-${record?.ties ?? 0}`;
    }

    return `${record?.wins ?? 0}-${record?.losses ?? 0}`;
}

function navigateToHash(hash) {
    window.location.assign(hash);
}

function App() {
    const syncUiEnabled = import.meta.env.VITE_ENABLE_SYNC_UI !== "false";
    const matchReportOnDemandEnabled = syncUiEnabled;
    const initialHashState = parseHash(window.location.hash);
    const [analysisVersion, setAnalysisVersion] = useState(() => Date.now());
    const [route, setRoute] = useState(() => initialHashState.route);
    const {
        analysis: seasonsIndex,
    } = useAnalysisData(`data/seasons/index.json?v=${analysisVersion}`);
    const seasonOptions = seasonsIndex?.seasons ?? EMPTY_LIST;
    const defaultSeasonLabel = seasonsIndex?.defaultSeasonLabel || seasonOptions[0]?.seasonLabel || "";
    const initialCompetitionTab = initialHashState.competitionTab || "standings";
    const initialCompetitionCategory = initialHashState.competitionCategory || "all";
    const initialCompetitionLevel = initialHashState.competitionLevel || "all";
    const initialCompetitionPhase = initialHashState.competitionPhase || "all";
    const isHistoryRoute = route === "history";
    const isPlayersRoute = route === "players";
    const isClubRoute = route === "club";
    const isTeamRoute = route === "dashboard";
    const isCompareRoute = route === "compare";
    const isCurrentSeasonRoute = route === "dashboard" || route === "competition" || route === "club" || route === "compare";
    const [selectedTeamKey, setSelectedTeamKey] = useState(() => initialHashState.teamKey ?? "");
    const [selectedClubKey, setSelectedClubKey] = useState(() => initialHashState.clubKey ?? "");
    const [selectedTeamGender, setSelectedTeamGender] = useState("all");
    const [selectedTeamLevel, setSelectedTeamLevel] = useState("all");
    const [selectedTeamCategory, setSelectedTeamCategory] = useState("all");
    const [selectedPhase, setSelectedPhase] = useState("");
    const [selectedPlayer, setSelectedPlayer] = useState("");
    const [selectedMatch, setSelectedMatch] = useState("");
    const [openMatches, setOpenMatches] = useState({});
    const [selectedStandingsPhase, setSelectedStandingsPhase] = useState(initialCompetitionPhase);
    const [selectedStandingsLevel, setSelectedStandingsLevel] = useState(initialCompetitionLevel);
    const [selectedStandingsCategory, setSelectedStandingsCategory] = useState(initialCompetitionCategory);
    const [selectedResultsPhase, setSelectedResultsPhase] = useState(initialCompetitionPhase);
    const [selectedResultsLevel, setSelectedResultsLevel] = useState(initialCompetitionLevel);
    const [selectedResultsCategory, setSelectedResultsCategory] = useState(initialCompetitionCategory);
    const [selectedLeadersLevel, setSelectedLeadersLevel] = useState(initialCompetitionLevel);
    const [selectedLeadersCategory, setSelectedLeadersCategory] = useState(initialCompetitionCategory);
    const [rankingMinGames, setRankingMinGames] = useState("3");
    const [selectedCompetitionTab, setSelectedCompetitionTab] = useState(initialCompetitionTab);
    const [selectedTeamTab, setSelectedTeamTab] = useState("snapshot");
    const [historyTeamQuery, setHistoryTeamQuery] = useState("");
    const [selectedHistoryTeamKey, setSelectedHistoryTeamKey] = useState(
        () => initialHashState.route === "history" ? (initialHashState.teamKey ?? "") : ""
    );
    const [playerDirectoryQuery, setPlayerDirectoryQuery] = useState("");
    const [selectedHistoricalPlayerKey, setSelectedHistoricalPlayerKey] = useState(
        () => initialHashState.route === "players" ? (initialHashState.playerKey ?? "") : ""
    );
    const [clubQuery, setClubQuery] = useState("");
    const [historicalArchiveRequested, setHistoricalArchiveRequested] = useState(false);
    // Compare route state
    const [compareTab, setCompareTab] = useState(
        () => initialHashState.route === "compare" ? (initialHashState.compareTab || "teams") : "teams"
    );
    const [compareTeamKey1, setCompareTeamKey1] = useState(
        () => initialHashState.route === "compare" ? (initialHashState.compareTeam1 ?? "") : ""
    );
    const [compareTeamKey2, setCompareTeamKey2] = useState(
        () => initialHashState.route === "compare" ? (initialHashState.compareTeam2 ?? "") : ""
    );
    const [compareTeamQuery1, setCompareTeamQuery1] = useState("");
    const [compareTeamQuery2, setCompareTeamQuery2] = useState("");
    const [comparePlayerKey1, setComparePlayerKey1] = useState(
        () => initialHashState.route === "compare" ? (initialHashState.comparePlayer1 ?? "") : ""
    );
    const [comparePlayerKey2, setComparePlayerKey2] = useState(
        () => initialHashState.route === "compare" ? (initialHashState.comparePlayer2 ?? "") : ""
    );
    const [comparePlayerQuery1, setComparePlayerQuery1] = useState("");
    const [comparePlayerQuery2, setComparePlayerQuery2] = useState("");
    const pendingScrollRestoreFrame = useRef(0);
    const teamTabsRef = useRef(null);
    const shouldLoadHistoricalArchive = historicalArchiveRequested
        || (isHistoryRoute && !!selectedHistoryTeamKey)
        || (isPlayersRoute && !!selectedHistoricalPlayerKey)
        || isCompareRoute;
    const {
        analysis: analysisIndex,
        loading: analysisIndexLoading,
        error: analysisIndexError
    } = useAnalysisData(
        isCurrentSeasonRoute
            ? `data/analysis.json?v=${analysisVersion}`
            : null
    );
    const {
        analysis: competitionOverview,
        loading: competitionOverviewLoading,
        error: competitionOverviewError
    } = useAnalysisData(
        route === "competition"
            ? `data/competition-overview.json?v=${analysisVersion}`
            : null
    );
    const {
        sources: savedResultsSources,
        loading: savedResultsSourcesLoading,
        error: savedResultsSourcesError,
        deletingPhaseIds: deletingSavedPhaseIds,
        deleteSource: deleteSavedResultsSource,
        deleteSources: deleteSavedResultsSources,
        refreshSources: refreshSavedResultsSources
    } = useResultsSources(syncUiEnabled);
    const {
        apiAvailable,
        starting: syncStarting,
        error: syncError,
        job,
        startSync,
        startSyncBatch,
        startSyncAllSavedSources
    } = useSyncJob(syncUiEnabled, () => {
        setAnalysisVersion(Date.now());
        void refreshSavedResultsSources();
    });
    const {
        analysis: competitionStandingsDataset,
        loading: competitionStandingsLoading,
        error: competitionStandingsError
    } = useAnalysisData(
        route === "competition" || isTeamRoute
            ? `data/competition-standings.json?v=${analysisVersion}`
            : null
    );
    const {
        analysis: competitionMatchesData,
        loading: competitionMatchesLoading,
        error: competitionMatchesError
    } = useAnalysisData(
        route === "competition" && selectedCompetitionTab === "matches"
            ? `data/competition-matches.json?v=${analysisVersion}`
            : null
    );
    const {
        analysis: competitionPlayerLeadersData,
        loading: competitionPlayerLeadersLoading,
        error: competitionPlayerLeadersError
    } = useAnalysisData(
        route === "competition" && selectedCompetitionTab === "leaders"
            ? `data/competition-player-leaders.json?v=${analysisVersion}`
            : null
    );
    const {
        analysis: currentClubDirectory,
        loading: currentClubDirectoryLoading,
        error: currentClubDirectoryError
    } = useAnalysisData(
        isClubRoute
            ? `data/clubs.json?v=${analysisVersion}`
            : null
    );
    const {
        analysis: historicalTeamsDirectory,
        loading: historicalTeamsLoading,
        error: historicalTeamsError
    } = useAnalysisData(
        isHistoryRoute && shouldLoadHistoricalArchive
            ? `data/archive/teams.json?v=${analysisVersion}`
            : null
    );
    const {
        analysis: historicalPlayersDirectory,
        loading: historicalPlayersLoading,
        error: historicalPlayersError
    } = useAnalysisData(
        (isPlayersRoute || isCompareRoute) && shouldLoadHistoricalArchive
            ? `data/archive/players.json?v=${analysisVersion}`
            : null
    );

    // Load match/player data for both compare teams (always called, pass null when not needed)
    const compareTeam1SummaryFromIndex = useMemo(
        () => isCompareRoute && compareTeamKey1
            ? (analysisIndex?.teams ?? []).find((t) => t.teamKey === compareTeamKey1) ?? null
            : null,
        [analysisIndex, compareTeamKey1, isCompareRoute]
    );
    const compareTeam2SummaryFromIndex = useMemo(
        () => isCompareRoute && compareTeamKey2
            ? (analysisIndex?.teams ?? []).find((t) => t.teamKey === compareTeamKey2) ?? null
            : null,
        [analysisIndex, compareTeamKey2, isCompareRoute]
    );
    const {
        analysis: compareTeam1Matches,
        loading: compareTeam1MatchesLoading,
        error: compareTeam1MatchesError
    } = useAnalysisData(
        isCompareRoute && compareTeam1SummaryFromIndex?.matchesFile
            ? `data/${compareTeam1SummaryFromIndex.matchesFile}?v=${analysisVersion}`
            : null
    );
    const {
        analysis: compareTeam1Players,
        loading: compareTeam1PlayersLoading,
        error: compareTeam1PlayersError
    } = useAnalysisData(
        isCompareRoute && compareTeam1SummaryFromIndex?.playersFile
            ? `data/${compareTeam1SummaryFromIndex.playersFile}?v=${analysisVersion}`
            : null
    );
    const {
        analysis: compareTeam2Matches,
        loading: compareTeam2MatchesLoading,
        error: compareTeam2MatchesError
    } = useAnalysisData(
        isCompareRoute && compareTeam2SummaryFromIndex?.matchesFile
            ? `data/${compareTeam2SummaryFromIndex.matchesFile}?v=${analysisVersion}`
            : null
    );
    const {
        analysis: compareTeam2Players,
        loading: compareTeam2PlayersLoading,
        error: compareTeam2PlayersError
    } = useAnalysisData(
        isCompareRoute && compareTeam2SummaryFromIndex?.playersFile
            ? `data/${compareTeam2SummaryFromIndex.playersFile}?v=${analysisVersion}`
            : null
    );

    useEffect(() => {
        if (!window.location.hash) {
            navigateToHash(buildDefaultRoute());
        }

        const handleHashChange = () => {
            const nextState = parseHash(window.location.hash);
            setRoute(nextState.route);
            setSelectedTeamKey(nextState.teamKey ?? "");
            setSelectedClubKey(nextState.clubKey ?? "");
            setSelectedPhase("");
            setSelectedPlayer("");
            setSelectedMatch("");
            setOpenMatches({});
            setSelectedHistoryTeamKey(nextState.route === "history" ? (nextState.teamKey ?? "") : "");
            setSelectedHistoricalPlayerKey(nextState.route === "players" ? (nextState.playerKey ?? "") : "");
            setSelectedCompetitionTab(nextState.competitionTab || "standings");
            setSelectedStandingsCategory(nextState.competitionCategory || "all");
            setSelectedStandingsLevel(nextState.competitionLevel || "all");
            setSelectedStandingsPhase(nextState.competitionPhase || "all");
            setSelectedResultsCategory(nextState.competitionCategory || "all");
            setSelectedResultsLevel(nextState.competitionLevel || "all");
            setSelectedResultsPhase(nextState.competitionPhase || "all");
            setSelectedLeadersCategory(nextState.competitionCategory || "all");
            setSelectedLeadersLevel(nextState.competitionLevel || "all");
            if (nextState.route === "compare") {
                setCompareTab(nextState.compareTab || "teams");
                setCompareTeamKey1(nextState.compareTeam1 ?? "");
                setCompareTeamKey2(nextState.compareTeam2 ?? "");
                setComparePlayerKey1(nextState.comparePlayer1 ?? "");
                setComparePlayerKey2(nextState.comparePlayer2 ?? "");
                setCompareTeamQuery1("");
                setCompareTeamQuery2("");
                setComparePlayerQuery1("");
                setComparePlayerQuery2("");
            }
        };

        window.addEventListener("hashchange", handleHashChange);
        return () => {
            window.removeEventListener("hashchange", handleHashChange);
        };
    }, []);

    useEffect(() => {
        if (syncUiEnabled || route !== "sync") {
            return;
        }

        navigateToHash(buildDefaultRoute());
    }, [route, syncUiEnabled]);

    const currentSeasonLabel = analysisIndex?.seasonLabel || defaultSeasonLabel;
    const totalPublishedSeasons = seasonOptions.length;
    const historicalTeamEntities = historicalTeamsDirectory?.teams ?? EMPTY_LIST;
    const historicalTeamOptions = useMemo(
        () => sortFilterOptions(historicalTeamEntities.map((entity) => ({
            value: entity.key,
            label: entity.label,
            meta: entity.meta,
            searchText: entity.searchText
        }))),
        [historicalTeamEntities]
    );
    const selectedHistoricalTeam = useMemo(
        () => historicalTeamEntities.find((entity) => entity.key === selectedHistoryTeamKey) ?? null,
        [historicalTeamEntities, selectedHistoryTeamKey]
    );
    const historicalPlayerEntities = historicalPlayersDirectory?.players ?? EMPTY_LIST;
    const historicalPlayerOptions = useMemo(() => sortFilterOptions(historicalPlayerEntities.map((entity) => ({
        value: entity.key,
        label: entity.label,
        meta: entity.meta,
        searchText: entity.searchText
    }))), [historicalPlayerEntities]);
    const selectedHistoricalPlayer = useMemo(
        () => historicalPlayerEntities.find((entity) => entity.key === selectedHistoricalPlayerKey) ?? null,
        [historicalPlayerEntities, selectedHistoricalPlayerKey]
    );
    const teams = analysisIndex?.teams ?? EMPTY_LIST;
    const competitionTeams = competitionOverview?.teams ?? EMPTY_LIST;
    const teamDirectoryByKey = useMemo(() => [...teams, ...competitionTeams].reduce((map, team) => {
        if (!team?.teamKey) {
            return map;
        }

        const current = map.get(team.teamKey) ?? {};
        map.set(team.teamKey, {
            teamName: team.teamName ?? current.teamName ?? "",
            teamIdExtern: Number(team.teamIdExtern ?? current.teamIdExtern ?? 0),
            matchesFile: team.matchesFile ?? current.matchesFile ?? "",
            playersFile: team.playersFile ?? current.playersFile ?? ""
        });
        return map;
    }, new Map()), [teams, competitionTeams]);
    const latestTeamContexts = useMemo(() => buildLatestTeamContextByKey(teams), [teams]);
    const latestTeamContextRows = useMemo(() => [...latestTeamContexts.values()], [latestTeamContexts]);
    const dashboardGenderOptions = useMemo(
        () => buildGenderOptions(latestTeamContextRows),
        [latestTeamContextRows]
    );
    const genderFilteredTeamContextRows = useMemo(
        () => filterRowsByGender(latestTeamContextRows, selectedTeamGender),
        [latestTeamContextRows, selectedTeamGender]
    );
    const dashboardCategoryOptions = useMemo(
        () => buildCategoryOptionsFromRows(genderFilteredTeamContextRows),
        [genderFilteredTeamContextRows]
    );
    const sortedTeams = useMemo(
        () => [...teams].sort((a, b) => a.teamName.localeCompare(b.teamName, "es")),
        [teams]
    );
    const globalDefaultTeam = useMemo(() => teams.reduce((best, team) => {
        if (!best) {
            return team;
        }

        if (team.matchesPlayed > best.matchesPlayed) {
            return team;
        }

        if (team.matchesPlayed === best.matchesPlayed &&
            team.teamName.localeCompare(best.teamName, "es") < 0) {
            return team;
        }

        return best;
    }, null), [teams]);
    const selectedTeamContext = latestTeamContexts.get(selectedTeamKey)
        ?? latestTeamContexts.get(globalDefaultTeam?.teamKey ?? "")
        ?? null;
    const fallbackTeamCategory = String(selectedTeamContext?.categoryName ?? "").trim();
    const effectiveTeamCategory = dashboardCategoryOptions.some((option) => option.value === selectedTeamCategory)
        ? selectedTeamCategory
        : (dashboardCategoryOptions.some((option) => option.value === fallbackTeamCategory)
            ? fallbackTeamCategory
            : (dashboardCategoryOptions[0]?.value ?? "all"));
    const dashboardLevelOptions = useMemo(
        () => buildLevelOptionsFromRows(
            filterRowsByCategory(genderFilteredTeamContextRows, effectiveTeamCategory)
        ),
        [effectiveTeamCategory, genderFilteredTeamContextRows]
    );
    const effectiveTeamLevel = dashboardLevelOptions.some((option) => option.value === selectedTeamLevel)
        ? selectedTeamLevel
        : "all";
    const effectiveTeamLevelLabel = effectiveTeamLevel === "all"
        ? ""
        : (dashboardLevelOptions.find((option) => option.value === effectiveTeamLevel)?.label ?? effectiveTeamLevel);
    const dashboardTeams = useMemo(() => sortedTeams.filter((team) => {
        const teamContext = latestTeamContexts.get(team.teamKey);

        if (selectedTeamGender !== "all") {
            const gender = getCategoryGender(teamContext?.categoryName);
            if (gender !== selectedTeamGender) {
                return false;
            }
        }

        if (effectiveTeamLevel !== "all") {
            const levelKey = String(teamContext?.levelCode ?? "").trim() || String(teamContext?.levelName ?? "").trim();
            if (levelKey !== effectiveTeamLevel) {
                return false;
            }
        }

        if (effectiveTeamCategory !== "all") {
            const cat = String(teamContext?.categoryName ?? "").trim();
            if (cat !== effectiveTeamCategory) {
                return false;
            }
        }

        return true;
    }), [effectiveTeamCategory, effectiveTeamLevel, latestTeamContexts, selectedTeamGender, sortedTeams]);
    const dashboardDefaultTeam = useMemo(() => dashboardTeams.reduce((best, team) => {
        if (!best) {
            return team;
        }

        if (team.matchesPlayed > best.matchesPlayed) {
            return team;
        }

        if (team.matchesPlayed === best.matchesPlayed &&
            team.teamName.localeCompare(best.teamName, "es") < 0) {
            return team;
        }

        return best;
    }, null), [dashboardTeams]);
    const selectedTeamKeyFromAll = teams.some((team) => team.teamKey === selectedTeamKey)
        ? selectedTeamKey
        : (globalDefaultTeam?.teamKey ?? "");
    const effectiveTeamKey = isTeamRoute
        ? (dashboardTeams.some((team) => team.teamKey === selectedTeamKey)
            ? selectedTeamKey
            : (dashboardDefaultTeam?.teamKey ?? selectedTeamKeyFromAll))
        : selectedTeamKeyFromAll;
    const selectedTeamSummary = teams.find((team) => team.teamKey === effectiveTeamKey) ?? globalDefaultTeam ?? null;
    const selectedTeamPhases = selectedTeamSummary?.phases ?? EMPTY_LIST;
    const competitionStandingScopes = competitionStandingsDataset?.scopes ?? EMPTY_LIST;
    const competitionPlayerLeaders = Array.isArray(competitionPlayerLeadersData) ? competitionPlayerLeadersData : EMPTY_LIST;
    const competitionMatches = Array.isArray(competitionMatchesData) ? competitionMatchesData : EMPTY_LIST;
    const competitionOverviewTeamsByKey = useMemo(() => competitionTeams.reduce((map, team) => {
        if (team?.teamKey) {
            map.set(team.teamKey, team);
        }

        return map;
    }, new Map()), [competitionTeams]);
    const competitionMatchesWithBranding = useMemo(() => competitionMatches.map((match) => ({
        ...match,
        homeTeamIdExtern: Number(teamDirectoryByKey.get(match.homeTeamKey)?.teamIdExtern ?? 0),
        awayTeamIdExtern: Number(teamDirectoryByKey.get(match.awayTeamKey)?.teamIdExtern ?? 0)
    })), [competitionMatches, teamDirectoryByKey]);
    const currentClubEntities = Array.isArray(currentClubDirectory) ? currentClubDirectory : EMPTY_LIST;
    const clubOptions = useMemo(() => sortFilterOptions(currentClubEntities.map((club) => ({
        value: club.key,
        label: club.label,
        meta: club.meta,
        searchText: `${club.searchText} ${club.meta}`
    }))), [currentClubEntities]);
    const clubKeyByTeamIdentity = useMemo(() => {
        const nextMap = new Map();

        currentClubEntities.forEach((club) => {
            club?.categories?.forEach((category) => {
                category?.levels?.forEach((level) => {
                    level?.teams?.forEach((team) => {
                        if (team?.teamKey) {
                            nextMap.set(`key:${team.teamKey}`, club.key);
                        }

                        if (team?.teamIdExtern) {
                            nextMap.set(`id:${team.teamIdExtern}`, club.key);
                        }
                    });
                });
            });
        });

        return nextMap;
    }, [currentClubEntities]);
    const selectedTeamBranding = selectedTeamSummary
        ? getClubBrandingForTeam(selectedTeamSummary.teamIdExtern, selectedTeamSummary.teamName)
        : null;
    const selectedTeamClubKey = selectedTeamSummary
        ? (clubKeyByTeamIdentity.get(`key:${selectedTeamSummary.teamKey}`)
            ?? clubKeyByTeamIdentity.get(`id:${selectedTeamSummary.teamIdExtern}`)
            ?? selectedTeamBranding?.clubKey
            ?? "")
        : "";
    const fallbackClubKey = currentClubEntities.some((club) => club.key === selectedTeamClubKey)
        ? selectedTeamClubKey
        : (currentClubEntities[0]?.key ?? "");
    const effectiveClubKey = currentClubEntities.some((club) => club.key === selectedClubKey)
        ? selectedClubKey
        : fallbackClubKey;
    const selectedClub = currentClubEntities.find((club) => club.key === effectiveClubKey) ?? null;
    const competitionCategoryOptions = useMemo(
        () => buildCategoryOptionsFromRows(competitionOverview?.phases ?? []),
        [competitionOverview]
    );
    const shouldLoadTeamMatches = isTeamRoute && !!selectedTeamSummary?.matchesFile;
    const shouldLoadTeamPlayers = isTeamRoute && !!selectedTeamSummary?.playersFile;
    const {
        analysis: selectedTeamMatchSummaries,
        loading: selectedTeamMatchesLoading,
        error: selectedTeamMatchesError
    } = useAnalysisData(
        shouldLoadTeamMatches
            ? `data/${selectedTeamSummary.matchesFile}?v=${analysisVersion}`
            : null
    );
    const {
        analysis: selectedTeamPlayers,
        loading: selectedTeamPlayersLoading,
        error: selectedTeamPlayersError
    } = useAnalysisData(
        shouldLoadTeamPlayers
            ? `data/${selectedTeamSummary.playersFile}?v=${analysisVersion}`
            : null
    );
    const teamPlayers = useMemo(
        () => Array.isArray(selectedTeamPlayers) ? selectedTeamPlayers : EMPTY_LIST,
        [selectedTeamPlayers]
    );
    const teamMatchSummaries = useMemo(
        () => Array.isArray(selectedTeamMatchSummaries) ? selectedTeamMatchSummaries : EMPTY_LIST,
        [selectedTeamMatchSummaries]
    );
    const teamPhaseOptions = buildTeamPhaseOptions(selectedTeamPhases);
    const effectiveSelectedPhase = !selectedPhase || teamPhaseOptions.some((phase) => phase.value === selectedPhase)
        ? (selectedPhase || "all")
        : "all";
    const selectedPhaseContext = effectiveSelectedPhase === "all"
        ? null
        : (filterRowsByPhaseOption(selectedTeamPhases, effectiveSelectedPhase)[0] ?? null);
    const selectedPhaseValue = selectedPhaseContext?.phaseNumber ?? null;
    const matchSummaries = useMemo(
        () => filterRowsByPhaseOption(teamMatchSummaries, effectiveSelectedPhase),
        [effectiveSelectedPhase, teamMatchSummaries]
    );
    const players = useMemo(
        () => filterRowsByPhaseOption(teamPlayers, effectiveSelectedPhase),
        [effectiveSelectedPhase, teamPlayers]
    );
    const playersList = useMemo(() => getPlayersList(players), [players]);
    const effectiveSelectedPlayer = selectedPlayer &&
    playersList.some((player) => player.value === selectedPlayer)
        ? selectedPlayer
        : "";
    const chartData = getChartData(players, effectiveSelectedPlayer, selectedPhaseValue);
    const selectedPlayerSummary = useMemo(
        () => getSelectedPlayerSummary(players, effectiveSelectedPlayer),
        [effectiveSelectedPlayer, players]
    );
    const sortedPlayers = useMemo(() => sortPlayers(players), [players]);
    const sortedMatches = useMemo(() => sortMatches(
        groupPlayersByMatch(sortedPlayers, matchSummaries)
    ), [matchSummaries, sortedPlayers]);
    const visibleMatches = useMemo(
        () => getVisibleMatches(sortedMatches, selectedMatch),
        [selectedMatch, sortedMatches]
    );
    const playersArray = useMemo(() => buildPlayersArray(players), [players]);
    const phaseSummaries = useMemo(
        () => buildPhaseSummaries(teamMatchSummaries, teamPlayers),
        [teamMatchSummaries, teamPlayers]
    );
    const phaseComparison = useMemo(() => buildPhaseComparison(phaseSummaries), [phaseSummaries]);
    const teamLeadersByAvgValuation = useMemo(
        () => getTopTeamPlayers(playersArray, "avgValuation", 8),
        [playersArray]
    );
    const teamLeadersByPoints = useMemo(
        () => getTopTeamPlayers(playersArray, "points", 8),
        [playersArray]
    );
    const rankingMinGamesValue = Number(rankingMinGames || 1);
    const effectiveLeadersCategory = competitionCategoryOptions.some((option) => option.value === selectedLeadersCategory)
        ? selectedLeadersCategory
        : (competitionCategoryOptions[0]?.value ?? "all");
    const leadersLevelOptions = useMemo(() => buildLevelOptionsFromRows(
        filterRowsByCategory(competitionOverview?.phases ?? [], effectiveLeadersCategory)
    ), [competitionOverview, effectiveLeadersCategory]);
    const effectiveLeadersLevel = leadersLevelOptions.some((option) => option.value === selectedLeadersLevel)
        ? selectedLeadersLevel
        : "all";
    const filteredCompetitionPlayers = useMemo(() => competitionPlayerLeaders
        .filter((player) => player.games >= rankingMinGamesValue)
        .filter((player) => {
            if (effectiveLeadersLevel === "all") {
                return true;
            }

            const teamContext = latestTeamContexts.get(player.teamKey);
            const levelKey = String(teamContext?.levelCode ?? "").trim() || String(teamContext?.levelName ?? "").trim();
            return levelKey === effectiveLeadersLevel;
        })
        .filter((player) => {
            if (effectiveLeadersCategory === "all") {
                return true;
            }

            const teamContext = latestTeamContexts.get(player.teamKey);
            return String(teamContext?.categoryName ?? "").trim() === effectiveLeadersCategory;
        }), [
        competitionPlayerLeaders,
        effectiveLeadersCategory,
        effectiveLeadersLevel,
        latestTeamContexts,
        rankingMinGamesValue
    ]);
    const globalLeadersByAvgValuation = useMemo(
        () => getTopGlobalPlayers(filteredCompetitionPlayers, "avgValuation", 8),
        [filteredCompetitionPlayers]
    );
    const globalLeadersByPoints = useMemo(
        () => getTopGlobalPlayers(filteredCompetitionPlayers, "points", 8),
        [filteredCompetitionPlayers]
    );
    const effectiveStandingsCategory = competitionCategoryOptions.some((option) => option.value === selectedStandingsCategory)
        ? selectedStandingsCategory
        : (competitionCategoryOptions[0]?.value ?? "all");
    const standingsLevelOptions = useMemo(() => buildLevelOptionsFromRows(
        filterRowsByCategory(competitionOverview?.phases ?? [], effectiveStandingsCategory)
    ), [competitionOverview, effectiveStandingsCategory]);
    const effectiveStandingsLevel = standingsLevelOptions.some((option) => option.value === selectedStandingsLevel)
        ? selectedStandingsLevel
        : "all";
    const standingsPhaseOptions = useMemo(() => buildCompetitionPhaseOptions(
        filterRowsByCategory(
            filterRowsByLevel(competitionOverview?.phases ?? [], effectiveStandingsLevel),
            effectiveStandingsCategory
        )
    ), [competitionOverview, effectiveStandingsCategory, effectiveStandingsLevel]);
    const effectiveCompetitionPhase = selectedStandingsPhase === "all" ||
    standingsPhaseOptions.some((phase) => phase.value === selectedStandingsPhase)
        ? selectedStandingsPhase
        : "all";
    const competitionStandingsRows = useMemo(() => buildStandingsFromScopes(
        competitionStandingScopes,
        effectiveCompetitionPhase,
        effectiveStandingsLevel,
        effectiveStandingsCategory
    )
        .map((row) => {
            const latestContext = latestTeamContexts.get(row.teamKey);
            const teamDirectoryEntry = teamDirectoryByKey.get(row.teamKey);
            const teamOverview = competitionOverviewTeamsByKey.get(row.teamKey);
            const levelKey = String(latestContext?.levelCode ?? "").trim() || String(latestContext?.levelName ?? "").trim();
            const totalValuation = Number(teamOverview?.totalValuation ?? 0);

            return {
                ...row,
                teamIdExtern: Number(teamDirectoryEntry?.teamIdExtern ?? 0),
                levelKey,
                levelLabel: latestContext?.levelName ?? "",
                avgValuation: row.played > 0 ? totalValuation / row.played : 0
            };
        })
        .map((row, index) => ({
            ...row,
            position: index + 1
        })), [
        competitionOverviewTeamsByKey,
        competitionStandingScopes,
        effectiveCompetitionPhase,
        effectiveStandingsCategory,
        effectiveStandingsLevel,
        latestTeamContexts,
        teamDirectoryByKey
    ]);
    const effectiveResultsCategory = competitionCategoryOptions.some((option) => option.value === selectedResultsCategory)
        ? selectedResultsCategory
        : (competitionCategoryOptions[0]?.value ?? "all");
    const resultsLevelOptions = useMemo(() => buildLevelOptionsFromRows(
        filterRowsByCategory(competitionOverview?.phases ?? [], effectiveResultsCategory)
    ), [competitionOverview, effectiveResultsCategory]);
    const effectiveResultsLevel = resultsLevelOptions.some((option) => option.value === selectedResultsLevel)
        ? selectedResultsLevel
        : "all";
    const resultsPhaseOptions = useMemo(() => buildCompetitionPhaseOptions(
        filterRowsByCategory(
            filterRowsByLevel(competitionOverview?.phases ?? [], effectiveResultsLevel),
            effectiveResultsCategory
        )
    ), [competitionOverview, effectiveResultsCategory, effectiveResultsLevel]);
    const effectiveResultsPhase = selectedResultsPhase === "all" ||
    resultsPhaseOptions.some((phase) => phase.value === selectedResultsPhase)
        ? selectedResultsPhase
        : "all";
    const activeCompetitionTab = COMPETITION_TABS.find((tab) => tab.id === selectedCompetitionTab) ?? COMPETITION_TABS[0];
    const activeTeamTab = TEAM_TABS.find((tab) => tab.id === selectedTeamTab) ?? TEAM_TABS[0];
    const selectedTeamLatestContext = latestTeamContexts.get(effectiveTeamKey) ?? null;
    const selectedTeamScopePhases = effectiveSelectedPhase === "all"
        ? selectedTeamPhases
        : filterRowsByPhaseOption(selectedTeamPhases, effectiveSelectedPhase);
    const selectedTeamCategoryName = String(
        selectedPhaseContext?.categoryName
        ?? selectedTeamLatestContext?.categoryName
        ?? ""
    ).trim();
    const teamStandingsRows = (() => {
        const scopeKeys = new Set((selectedTeamScopePhases ?? []).map((phase) => buildPhaseScopeKey(phase)));
        const relevantScopes = scopeKeys.size > 0
            ? competitionStandingScopes.filter((scope) => scopeKeys.has(scope.key))
            : competitionStandingScopes.filter((scope) => String(scope?.categoryName ?? "").trim() === selectedTeamCategoryName);

        return aggregateStandingRows(relevantScopes.flatMap((scope) => scope?.rows ?? []));
    })();
    const selectedTeamStanding = teamStandingsRows.find((row) => row.teamKey === effectiveTeamKey) ?? null;
    const teamRecord = useMemo(() => buildTeamRecord(matchSummaries), [matchSummaries]);
    const bestWinStreak = useMemo(() => getLongestWinStreak(matchSummaries), [matchSummaries]);
    const topScorer = useMemo(() => getTopScorer(playersArray), [playersArray]);
    const mvp = useMemo(() => getMvp(playersArray), [playersArray]);
    const teamAvg = useMemo(() => getTeamAverage(players), [players]);
    const seasonLabel = selectedPhaseContext === null
        ? "Temporada completa"
        : buildCompetitionPhaseLabel(selectedPhaseContext);
    const standingLabel = selectedPhaseContext === null
        ? "Clasificación acumulada"
        : `Clasificación de ${buildCompetitionPhaseLabel(selectedPhaseContext)}`;
    const teamHeroSummary = `${selectedTeamSummary?.matchesPlayed ?? 0} partidos en total · ${selectedTeamSummary?.playersCount ?? 0} jugadoras registradas`;
    const competitionBaseLoading = competitionOverviewLoading || competitionStandingsLoading;
    const competitionBaseError = competitionOverviewError || competitionStandingsError;
    const historyArchiveLoading = shouldLoadHistoricalArchive && historicalTeamsLoading;
    const historyArchiveError = shouldLoadHistoricalArchive ? historicalTeamsError : "";
    const playersArchiveLoading = shouldLoadHistoricalArchive && historicalPlayersLoading;
    const playersArchiveError = shouldLoadHistoricalArchive ? historicalPlayersError : "";

    // Compare page derived data
    const compareTeam1Summaries = useMemo(
        () => Array.isArray(compareTeam1Matches) ? compareTeam1Matches : EMPTY_LIST,
        [compareTeam1Matches]
    );
    const compareTeam2Summaries = useMemo(
        () => Array.isArray(compareTeam2Matches) ? compareTeam2Matches : EMPTY_LIST,
        [compareTeam2Matches]
    );
    const compareTeam1PlayersArr = useMemo(
        () => Array.isArray(compareTeam1Players) ? compareTeam1Players : EMPTY_LIST,
        [compareTeam1Players]
    );
    const compareTeam2PlayersArr = useMemo(
        () => Array.isArray(compareTeam2Players) ? compareTeam2Players : EMPTY_LIST,
        [compareTeam2Players]
    );
    const compareTeam1Record = useMemo(() => buildTeamRecord(compareTeam1Summaries), [compareTeam1Summaries]);
    const compareTeam2Record = useMemo(() => buildTeamRecord(compareTeam2Summaries), [compareTeam2Summaries]);
    const compareTeam1WinStreak = useMemo(() => getLongestWinStreak(compareTeam1Summaries), [compareTeam1Summaries]);
    const compareTeam2WinStreak = useMemo(() => getLongestWinStreak(compareTeam2Summaries), [compareTeam2Summaries]);
    const compareTeam1PlayersArray = useMemo(() => buildPlayersArray(compareTeam1PlayersArr), [compareTeam1PlayersArr]);
    const compareTeam2PlayersArray = useMemo(() => buildPlayersArray(compareTeam2PlayersArr), [compareTeam2PlayersArr]);
    const compareTeam1TopScorer = useMemo(() => getTopScorer(compareTeam1PlayersArray), [compareTeam1PlayersArray]);
    const compareTeam2TopScorer = useMemo(() => getTopScorer(compareTeam2PlayersArray), [compareTeam2PlayersArray]);
    const compareTeam1Mvp = useMemo(() => getMvp(compareTeam1PlayersArray), [compareTeam1PlayersArray]);
    const compareTeam2Mvp = useMemo(() => getMvp(compareTeam2PlayersArray), [compareTeam2PlayersArray]);
    const compareTeam1Avg = useMemo(() => getTeamAverage(compareTeam1PlayersArr), [compareTeam1PlayersArr]);
    const compareTeam2Avg = useMemo(() => getTeamAverage(compareTeam2PlayersArr), [compareTeam2PlayersArr]);
    const compareTeam1CategoryName = String(compareTeam1SummaryFromIndex
        ? (latestTeamContexts.get(compareTeamKey1)?.categoryName ?? "")
        : ""
    ).trim();
    const compareTeam2CategoryName = String(compareTeam2SummaryFromIndex
        ? (latestTeamContexts.get(compareTeamKey2)?.categoryName ?? "")
        : ""
    ).trim();
    const compareTeam1StandingRow = useMemo(() => {
        if (!compareTeamKey1 || !compareTeam1CategoryName) {
            return null;
        }

        const rows = aggregateStandingRows(
            competitionStandingScopes
                .filter((scope) => String(scope?.categoryName ?? "").trim() === compareTeam1CategoryName)
                .flatMap((scope) => scope?.rows ?? [])
        );
        return rows.find((row) => row.teamKey === compareTeamKey1) ?? null;
    }, [compareTeam1CategoryName, compareTeamKey1, competitionStandingScopes]);
    const compareTeam2StandingRow = useMemo(() => {
        if (!compareTeamKey2 || !compareTeam2CategoryName) {
            return null;
        }

        const rows = aggregateStandingRows(
            competitionStandingScopes
                .filter((scope) => String(scope?.categoryName ?? "").trim() === compareTeam2CategoryName)
                .flatMap((scope) => scope?.rows ?? [])
        );
        return rows.find((row) => row.teamKey === compareTeamKey2) ?? null;
    }, [compareTeam2CategoryName, compareTeamKey2, competitionStandingScopes]);
    const compareTeamOptions = useMemo(
        () => sortFilterOptions(sortedTeams.map((team) => {
            const latestContext = latestTeamContexts.get(team.teamKey);
            const metaParts = [
                latestContext?.categoryName,
                latestContext?.levelName,
                latestContext?.phaseName
            ].filter(Boolean);

            return {
                value: team.teamKey,
                label: team.teamName,
                meta: metaParts.join(" · "),
                searchText: [
                    team.teamName,
                    latestContext?.categoryName,
                    latestContext?.levelName,
                    latestContext?.phaseName,
                    latestContext?.groupCode
                ].filter(Boolean).join(" ")
            };
        })),
        [latestTeamContexts, sortedTeams]
    );
    const compareHistoricalPlayerEntities = historicalPlayersDirectory?.players ?? EMPTY_LIST;
    const comparePlayerOptions = useMemo(
        () => sortFilterOptions(compareHistoricalPlayerEntities.map((entity) => ({
            value: entity.key,
            label: entity.label,
            meta: entity.meta,
            searchText: entity.searchText
        }))),
        [compareHistoricalPlayerEntities]
    );
    const compareSelectedPlayer1 = useMemo(
        () => compareHistoricalPlayerEntities.find((entity) => entity.key === comparePlayerKey1) ?? null,
        [compareHistoricalPlayerEntities, comparePlayerKey1]
    );
    const compareSelectedPlayer2 = useMemo(
        () => compareHistoricalPlayerEntities.find((entity) => entity.key === comparePlayerKey2) ?? null,
        [compareHistoricalPlayerEntities, comparePlayerKey2]
    );

    const handleToggleMatch = (matchWebId) => {
        setOpenMatches((prev) => ({
            ...prev,
            [matchWebId]: !prev[matchWebId]
        }));
    };

    const handleTeamNavigate = (teamKey, targetRoute = "dashboard") => {
        if (!teamKey) {
            return;
        }

        const teamContext = latestTeamContexts.get(teamKey);
        const categoryName = String(teamContext?.categoryName ?? "").trim();
        const levelKey = String(teamContext?.levelCode ?? "").trim() || String(teamContext?.levelName ?? "").trim();
        const gender = getCategoryGender(categoryName) || "all";
        setSelectedTeamKey(teamKey);
        setSelectedTeamGender(gender);
        setSelectedTeamCategory(categoryName || selectedTeamCategory);
        setSelectedTeamLevel(levelKey || "all");
        setSelectedPhase("");
        setSelectedPlayer("");
        setSelectedMatch("");
        setOpenMatches({});
        navigateToHash(
            targetRoute === "history"
                ? buildHistoryRoute(teamKey)
                : buildTeamRoute(teamKey)
        );
    };

    const handleClubNavigate = (clubKey) => {
        if (!clubKey) {
            return;
        }

        setSelectedClubKey(clubKey);
        navigateToHash(buildClubRoute(clubKey));
    };

    const handleCompetitionScopeNavigate = (team) => {
        if (!team?.teamKey) {
            return;
        }

        setSelectedTeamKey(team.teamKey);
        setSelectedCompetitionTab("standings");
        setSelectedStandingsCategory(team.categoryName || "all");
        setSelectedStandingsLevel(team.levelKey || "all");
        setSelectedStandingsPhase(team.latestPhaseOptionValue || "all");
        setSelectedResultsCategory(team.categoryName || "all");
        setSelectedResultsLevel(team.levelKey || "all");
        setSelectedResultsPhase(team.latestPhaseOptionValue || "all");
        setSelectedLeadersCategory(team.categoryName || "all");
        setSelectedLeadersLevel(team.levelKey || "all");
        navigateToHash(buildCompetitionRoute({
            teamKey: team.teamKey,
            tab: "standings",
            category: team.categoryName || "",
            level: team.levelKey || "",
            phase: team.latestPhaseOptionValue || ""
        }));
    };

    const handleTeamChange = (event) => {
        handleTeamNavigate(event.target.value);
    };

    const handlePhaseChange = (event) => {
        setSelectedPhase(event.target.value);
        setSelectedPlayer("");
        setSelectedMatch("");
        setOpenMatches({});
    };

    const handleTeamLevelChange = (event) => {
        setSelectedTeamLevel(event.target.value);
        setSelectedPhase("");
        setSelectedPlayer("");
        setSelectedMatch("");
        setOpenMatches({});
    };

    const handleTeamCategoryChange = (event) => {
        setSelectedTeamCategory(event.target.value);
        setSelectedTeamLevel("all");
        setSelectedPhase("");
        setSelectedPlayer("");
        setSelectedMatch("");
        setOpenMatches({});
    };

    const handleTeamGenderChange = (event) => {
        setSelectedTeamGender(event.target.value);
        setSelectedTeamCategory("all");
        setSelectedTeamLevel("all");
        setSelectedPhase("");
        setSelectedPlayer("");
        setSelectedMatch("");
        setOpenMatches({});
    };

    const handleStandingsCategoryChange = (value) => {
        setSelectedStandingsCategory(value);
        setSelectedStandingsLevel("all");
        setSelectedStandingsPhase("all");
    };

    const handleResultsCategoryChange = (value) => {
        setSelectedResultsCategory(value);
        setSelectedResultsLevel("all");
        setSelectedResultsPhase("all");
    };

    const handleLeadersCategoryChange = (value) => {
        setSelectedLeadersCategory(value);
        setSelectedLeadersLevel("all");
    };

    const handlePlayerChange = (value) => {
        setSelectedPlayer(value);
    };

    const handleHistoryTeamQueryChange = (value) => {
        setHistoryTeamQuery(value);

        if (!String(value ?? "").trim()) {
            setSelectedHistoryTeamKey("");
            navigateToHash(buildHistoryRoute());
        }
    };

    const handleHistoryTeamSelect = (option) => {
        setSelectedHistoryTeamKey(option.value);
        setHistoryTeamQuery(option.label);
        navigateToHash(buildHistoryRoute(option.value));
    };

    const handleHistoricalPlayerQueryChange = (value) => {
        setPlayerDirectoryQuery(value);

        if (!String(value ?? "").trim()) {
            setSelectedHistoricalPlayerKey("");
            navigateToHash(buildPlayersRoute());
        }
    };

    const handleHistoricalPlayerSelect = (option) => {
        setSelectedHistoricalPlayerKey(option.value);
        setPlayerDirectoryQuery(option.label);
        navigateToHash(buildPlayersRoute(option.value));
    };

    const handleClubQueryChange = (value) => {
        setClubQuery(value);
    };

    const handleClubSelect = (option) => {
        setClubQuery(option.label);
        handleClubNavigate(option.value);
    };

    const handlePlayerNavigate = (playerIdentityKey) => {
        if (!playerIdentityKey) {
            return;
        }

        setSelectedPlayer(playerIdentityKey);
        setSelectedTeamTab("evolution");

        window.requestAnimationFrame(() => {
            teamTabsRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        });
    };

    const handleCompetitionPlayerNavigate = (teamKey, playerIdentityKey) => {
        if (!teamKey || !playerIdentityKey) {
            return;
        }

        const teamContext = latestTeamContexts.get(teamKey);
        const categoryName = String(teamContext?.categoryName ?? "").trim();
        const levelKey = String(teamContext?.levelCode ?? "").trim() || String(teamContext?.levelName ?? "").trim();
        const gender = getCategoryGender(categoryName) || "all";

        setSelectedTeamKey(teamKey);
        setSelectedTeamGender(gender);
        setSelectedTeamCategory(categoryName || selectedTeamCategory);
        setSelectedTeamLevel(levelKey || "all");
        setSelectedPhase("");
        setSelectedMatch("");
        setSelectedPlayer(playerIdentityKey);
        setSelectedTeamTab("evolution");
        setOpenMatches({});
        navigateToHash(buildTeamRoute(teamKey));
    };

    const handleStandingsPhaseChange = (phase) => {
        setSelectedStandingsPhase(String(phase || "all"));
    };

    const preserveScrollOnNextPaint = () => {
        if (pendingScrollRestoreFrame.current) {
            window.cancelAnimationFrame(pendingScrollRestoreFrame.current);
        }

        const scrollX = window.scrollX;
        const scrollY = window.scrollY;

        pendingScrollRestoreFrame.current = window.requestAnimationFrame(() => {
            pendingScrollRestoreFrame.current = window.requestAnimationFrame(() => {
                const maxScrollY = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);
                window.scrollTo({
                    left: scrollX,
                    top: Math.min(scrollY, maxScrollY)
                });
                pendingScrollRestoreFrame.current = 0;
            });
        });
    };

    const handleTeamTabChange = (tabId) => {
        if (tabId === selectedTeamTab) {
            return;
        }

        preserveScrollOnNextPaint();
        setSelectedTeamTab(tabId);
    };

    const handleCompetitionTabChange = (tabId) => {
        if (tabId === selectedCompetitionTab) {
            return;
        }

        preserveScrollOnNextPaint();
        setSelectedCompetitionTab(tabId);
    };

    const handleHistoricalArchiveRequest = () => {
        setHistoricalArchiveRequested(true);
    };

    useEffect(() => {
        if (!isTeamRoute || !effectiveTeamKey || effectiveTeamKey === selectedTeamKey) {
            return;
        }

        navigateToHash(buildTeamRoute(effectiveTeamKey));
    }, [effectiveTeamKey, isTeamRoute, selectedTeamKey]);

    useEffect(() => {
        if (!isClubRoute || !effectiveClubKey || effectiveClubKey === selectedClubKey) {
            return;
        }

        navigateToHash(buildClubRoute(effectiveClubKey));
    }, [effectiveClubKey, isClubRoute, selectedClubKey]);

    useEffect(() => () => {
        if (pendingScrollRestoreFrame.current) {
            window.cancelAnimationFrame(pendingScrollRestoreFrame.current);
        }
    }, []);

    const renderTeamPage = () => {
        if (analysisIndexLoading) {
            return <div style={appStyles.emptyState}>Cargando análisis...</div>;
        }

        if (analysisIndexError) {
            return <div style={appStyles.emptyState}>{analysisIndexError}</div>;
        }

        if (!selectedTeamSummary) {
            return <div style={appStyles.emptyState}>No hay equipos disponibles en el análisis.</div>;
        }

        return (
            <>
                <section style={appStyles.teamSelectorSection}>
                    <div style={appStyles.teamSelectorHeader}>
                        <div style={appStyles.syncEyebrow}>Selector global</div>
                        <h2 style={appStyles.teamSelectorTitle}>Elige el equipo que quieres analizar</h2>
                        <p style={appStyles.teamSelectorBody}>
                            Sexo, categoría y nivel acotan el listado de equipos. Una vez elegido el equipo, la fase filtra
                            cómo lees su temporada.
                        </p>
                    </div>

                    <div style={appStyles.filterDeck}>
                        {dashboardGenderOptions.length > 1 ? (
                            <PrettySelect
                                label="Sexo"
                                value={selectedTeamGender}
                                onChange={handleTeamGenderChange}
                                ariaLabel="Filtra equipos por sexo"
                                minWidth="180px"
                            >
                                <option value="all">Todos</option>
                                {dashboardGenderOptions.map((g) => (
                                    <option key={g.value} value={g.value}>
                                        {g.label}
                                    </option>
                                ))}
                            </PrettySelect>
                        ) : null}

                        {dashboardCategoryOptions.length > 0 ? (
                            <PrettySelect
                                label="Categoría"
                                value={effectiveTeamCategory}
                                onChange={handleTeamCategoryChange}
                                ariaLabel="Filtra equipos por categoría"
                                minWidth="220px"
                            >
                                {dashboardCategoryOptions.map((cat) => (
                                    <option key={cat.value} value={cat.value}>
                                        {cat.label}
                                    </option>
                                ))}
                            </PrettySelect>
                        ) : null}

                        {dashboardLevelOptions.length > 0 ? (
                            <PrettySelect
                                label="Nivel"
                                value={effectiveTeamLevel}
                                onChange={handleTeamLevelChange}
                                ariaLabel="Filtra equipos por nivel actual"
                                minWidth="220px"
                            >
                                <option value="all">Todos los niveles</option>
                                {dashboardLevelOptions.map((level) => (
                                    <option key={level.value} value={level.value}>
                                        {level.label}
                                    </option>
                                ))}
                            </PrettySelect>
                        ) : null}

                        <PrettySelect
                            label="Equipo"
                            value={effectiveTeamKey}
                            onChange={handleTeamChange}
                            ariaLabel="Selecciona equipo"
                            minWidth="360px"
                        >
                            {dashboardTeams.map((team) => (
                                <option key={team.teamKey} value={team.teamKey}>
                                    {team.teamName}
                                </option>
                            ))}
                        </PrettySelect>
                    </div>

                    <div style={appStyles.teamSelectorMetaRow}>
                        <span style={appStyles.teamSelectorChip}>{dashboardTeams.length} equipos visibles</span>
                        {selectedTeamGender !== "all" ? (
                            <span style={appStyles.teamSelectorChip}>
                                {dashboardGenderOptions.find((g) => g.value === selectedTeamGender)?.label ?? selectedTeamGender}
                            </span>
                        ) : null}
                        {effectiveTeamCategory !== "all" ? (
                            <span style={appStyles.teamSelectorChip}>{effectiveTeamCategory}</span>
                        ) : null}
                        {effectiveTeamLevel !== "all" ? (
                            <span style={appStyles.teamSelectorChip}>{effectiveTeamLevelLabel}</span>
                        ) : null}
                    </div>
                </section>

                <section style={appStyles.hero}>
                    <div style={appStyles.heroPattern}/>
                    <div style={appStyles.heroContent}>
                        <div style={appStyles.heroHeader}>
                            <div style={appStyles.heroIdentity}>
                                <TeamBadge
                                    size="xl"
                                    teamIdExtern={selectedTeamSummary.teamIdExtern}
                                    teamName={selectedTeamSummary.teamName}
                                />
                                <div style={appStyles.heroIdentityText}>
                                    <div style={appStyles.heroKicker}>Vista del equipo</div>
                                    <h2 style={appStyles.heroTitle}>{selectedTeamSummary.teamName}</h2>
                                    <p style={appStyles.heroSummary}>{teamHeroSummary}</p>
                                </div>
                            </div>
                        </div>

                        <div style={appStyles.heroMetaRow}>
                            {currentSeasonLabel ? (
                                <span style={appStyles.metaChip}>{currentSeasonLabel}</span>
                            ) : null}
                            {selectedTeamLatestContext?.categoryName ? (
                                <span style={appStyles.metaChip}>{selectedTeamLatestContext.categoryName}</span>
                            ) : null}
                            {selectedTeamLatestContext?.levelName ? (
                                <span style={appStyles.metaChip}>{selectedTeamLatestContext.levelName}</span>
                            ) : null}
                            <span style={appStyles.metaChip}>{selectedTeamSummary.matchesPlayed ?? 0} partidos totales</span>
                        </div>

                        <div style={appStyles.heroActions}>
                            {selectedTeamClubKey ? (
                                <a href={buildClubRoute(selectedTeamClubKey)} style={appStyles.secondaryLink}>
                                    Ver club
                                </a>
                            ) : null}
                            <a href={buildCompetitionRoute()} style={appStyles.secondaryLink}>
                                Ver competición
                            </a>
                        </div>
                    </div>
                </section>

                {selectedTeamMatchesLoading || selectedTeamPlayersLoading ? (
                    <SectionFallback message="Cargando detalle del equipo..." />
                ) : null}

                {!selectedTeamMatchesLoading && !selectedTeamPlayersLoading && (selectedTeamMatchesError || selectedTeamPlayersError) ? (
                    <div style={appStyles.emptyState}>{selectedTeamMatchesError || selectedTeamPlayersError}</div>
                ) : null}

                {!selectedTeamMatchesLoading && !selectedTeamPlayersLoading && !selectedTeamMatchesError && !selectedTeamPlayersError && competitionStandingsError ? (
                    <div style={appStyles.emptyState}>
                        {competitionStandingsError}
                    </div>
                ) : null}

                {!selectedTeamMatchesLoading && !selectedTeamPlayersLoading && !selectedTeamMatchesError && !selectedTeamPlayersError ? (
                    <>
                        <section ref={teamTabsRef} style={appStyles.teamScopeSection}>
                            <div style={appStyles.teamScopeHeader}>
                                <div style={appStyles.syncEyebrow}>Filtro global</div>
                                <h3 style={appStyles.teamScopeTitle}>Qué tramo quieres leer</h3>
                                <p style={appStyles.teamScopeBody}>
                                    La fase modifica todo el panel del equipo: resumen, líderes, comparativa, evolución y
                                    partidos.
                                </p>
                            </div>

                            <div style={appStyles.teamScopeActions}>
                                <PrettySelect
                                    label="Fase"
                                    value={effectiveSelectedPhase === "all" ? "" : effectiveSelectedPhase}
                                    onChange={handlePhaseChange}
                                    ariaLabel="Selecciona fase"
                                    minWidth="260px"
                                >
                                    <option value="">Temporada completa</option>
                                    {teamPhaseOptions.map((phase) => (
                                        <option key={phase.value} value={phase.value}>
                                            {phase.label}
                                        </option>
                                    ))}
                                </PrettySelect>

                                <div style={appStyles.teamScopeMetaRow}>
                                    <span style={appStyles.teamScopeChip}>{seasonLabel}</span>
                                    <span style={appStyles.teamScopeChip}>{sortedMatches.length} partidos visibles</span>
                                    <span style={appStyles.teamScopeChip}>{playersArray.length} jugadoras</span>
                                </div>
                            </div>
                        </section>

                        <section style={appStyles.competitionTabs}>
                            <div style={appStyles.competitionTabRow}>
                                {TEAM_TABS.map((tab) => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        style={tab.id === activeTeamTab.id
                                            ? {...appStyles.competitionTab, ...appStyles.competitionTabActive}
                                            : appStyles.competitionTab}
                                        onClick={() => handleTeamTabChange(tab.id)}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            <p style={appStyles.competitionTabHint}>
                                {activeTeamTab.description}
                            </p>
                        </section>

                        {activeTeamTab.id === "snapshot" ? (
                            <Suspense fallback={<SectionFallback message="Cargando el resumen del equipo..." />}>
                                <TeamSnapshotSection
                                    seasonLabel={seasonLabel}
                                    currentLevelLabel={selectedPhaseContext === null
                                        ? (selectedTeamLatestContext?.levelName ?? "")
                                        : (selectedPhaseContext?.levelName ?? "")}
                                    record={teamRecord}
                                    standingRow={selectedTeamStanding}
                                    standingLabel={standingLabel}
                                    bestWinStreak={bestWinStreak}
                                    teamAveragePoints={teamAvg}
                                    topScorer={topScorer}
                                    mvp={mvp}
                                />
                            </Suspense>
                        ) : null}

                        {activeTeamTab.id === "leaders" ? (
                            <Suspense fallback={<SectionFallback message="Cargando líderes del equipo..." />}>
                                <TeamLeadersSection
                                    teamName={selectedTeamSummary.teamName}
                                    seasonLabel={seasonLabel}
                                    matchesCount={sortedMatches.length}
                                    playersCount={playersArray.length}
                                    leadersByAvgValuation={teamLeadersByAvgValuation}
                                    leadersByPoints={teamLeadersByPoints}
                                />
                            </Suspense>
                        ) : null}

                        {activeTeamTab.id === "phases" ? (
                            <Suspense fallback={<SectionFallback message="Cargando comparativa por fases..." />}>
                                <PhaseComparisonSection
                                    phaseSummaries={phaseSummaries}
                                    comparison={phaseComparison}
                                />
                            </Suspense>
                        ) : null}

                        {activeTeamTab.id === "evolution" ? (
                            <Suspense fallback={<SectionFallback message="Cargando evolución por jugadora..." />}>
                                <PlayerEvolutionSection
                                    playersList={playersList}
                                    selectedPlayer={effectiveSelectedPlayer}
                                    onSelectedPlayerChange={handlePlayerChange}
                                    chartData={chartData}
                                    selectedPlayerSummary={selectedPlayerSummary}
                                />
                            </Suspense>
                        ) : null}

                        {activeTeamTab.id === "matches" ? (
                            <Suspense fallback={<SectionFallback message="Cargando detalle de partidos..." />}>
                                <MatchListSection
                                    sortedMatches={sortedMatches}
                                    visibleMatches={visibleMatches}
                                    selectedMatch={selectedMatch}
                                    onSelectedMatchChange={setSelectedMatch}
                                    selectedPhase={selectedPhaseValue}
                                    openMatches={openMatches}
                                    onToggleMatch={handleToggleMatch}
                                    onTeamNavigate={handleTeamNavigate}
                                    onPlayerNavigate={handlePlayerNavigate}
                                    enableMatchReportOnDemand={matchReportOnDemandEnabled}
                                />
                            </Suspense>
                        ) : null}
                    </>
                ) : null}
            </>
        );
    };

    const renderSyncPage = () => (
        <div style={appStyles.syncPage}>
            <section style={appStyles.syncIntro}>
                <div style={appStyles.syncEyebrow}>Ingesta</div>
                <h2 style={appStyles.syncTitle}>Importa una fase completa desde la fuente oficial</h2>
                <p style={appStyles.syncBody}>
                    Pega la URL de resultados y deja que el pipeline descargue los partidos y actualice la web sin pasar por la consola.
                </p>
            </section>

            <Suspense fallback={<SectionFallback message="Cargando panel de sincronización..." />}>
                <SyncPanel
                    apiAvailable={apiAvailable}
                    job={job}
                    starting={syncStarting}
                    error={syncError}
                    savedSources={savedResultsSources}
                    savedSourcesLoading={savedResultsSourcesLoading}
                    savedSourcesError={savedResultsSourcesError}
                    deletingPhaseIds={deletingSavedPhaseIds}
                    onStartSync={startSync}
                    onStartSyncBatch={startSyncBatch}
                    onStartSyncAllSavedSources={startSyncAllSavedSources}
                    onDeleteSavedSource={async (phaseId) => {
                        const result = await deleteSavedResultsSource(phaseId);
                        if (result) {
                            setAnalysisVersion(Date.now());
                        }

                        return result;
                    }}
                    onDeleteSavedSources={async (phaseIds) => {
                        const result = await deleteSavedResultsSources(phaseIds);
                        if ((result?.deletedPhaseIds?.length ?? 0) > 0) {
                            setAnalysisVersion(Date.now());
                        }

                        return result;
                    }}
                />
            </Suspense>
        </div>
    );

    const renderCompetitionPage = () => (
        <div style={appStyles.pageShell}>
            <a
                href={selectedTeamSummary ? buildTeamRoute(selectedTeamSummary.teamKey) : buildDashboardRoute()}
                style={appStyles.pageBackLink}
            >
                Volver al panel
            </a>

            <section style={appStyles.syncIntro}>
                <div style={appStyles.syncEyebrow}>Competición</div>
                <h2 style={appStyles.syncTitle}>Clasificación, resultados y líderes globales</h2>
                <p style={appStyles.syncBody}>
                    Vista global de la competición para seguir la clasificación, revisar los partidos y localizar a las jugadoras más destacadas.
                </p>
            </section>

            {competitionBaseLoading ? (
                <SectionFallback message="Cargando datos de competición..." />
            ) : null}

            {!competitionBaseLoading && competitionBaseError ? (
                <div style={appStyles.emptyState}>{competitionBaseError}</div>
            ) : null}

            {!competitionBaseLoading && !competitionBaseError ? (
                <>
                    <section style={appStyles.competitionTabs}>
                        <div style={appStyles.competitionTabRow}>
                            {COMPETITION_TABS.map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    style={tab.id === activeCompetitionTab.id
                                        ? {...appStyles.competitionTab, ...appStyles.competitionTabActive}
                                        : appStyles.competitionTab}
                                    onClick={() => handleCompetitionTabChange(tab.id)}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <p style={appStyles.competitionTabHint}>
                            {activeCompetitionTab.description}
                        </p>
                    </section>

                    {activeCompetitionTab.id === "standings" ? (
                        <Suspense fallback={<SectionFallback message="Cargando clasificación..." />}>
                            <StandingsSection
                                rows={competitionStandingsRows}
                                phaseOptions={standingsPhaseOptions}
                                selectedPhase={effectiveCompetitionPhase}
                                onSelectedPhaseChange={handleStandingsPhaseChange}
                                levelOptions={standingsLevelOptions}
                                selectedLevel={effectiveStandingsLevel}
                                onSelectedLevelChange={setSelectedStandingsLevel}
                                categoryOptions={competitionCategoryOptions}
                                selectedCategory={effectiveStandingsCategory}
                                onSelectedCategoryChange={handleStandingsCategoryChange}
                                selectedTeamKey={effectiveTeamKey}
                                onTeamNavigate={handleTeamNavigate}
                            />
                        </Suspense>
                    ) : null}

                    {activeCompetitionTab.id === "matches" ? (
                        competitionMatchesLoading ? (
                            <SectionFallback message="Cargando resultados de la competición..." />
                        ) : competitionMatchesError ? (
                            <div style={appStyles.emptyState}>{competitionMatchesError}</div>
                        ) : (
                            <Suspense fallback={<SectionFallback message="Cargando resultados de la competición..." />}>
                                <CompetitionResultsSection
                                    matches={competitionMatchesWithBranding}
                                    teamDetailsByKey={teamDirectoryByKey}
                                    analysisVersion={analysisVersion}
                                    phaseOptions={resultsPhaseOptions}
                                    selectedPhase={effectiveResultsPhase}
                                    onSelectedPhaseChange={setSelectedResultsPhase}
                                    levelOptions={resultsLevelOptions}
                                    selectedLevel={effectiveResultsLevel}
                                    onSelectedLevelChange={setSelectedResultsLevel}
                                    categoryOptions={competitionCategoryOptions}
                                    selectedCategory={effectiveResultsCategory}
                                    onSelectedCategoryChange={handleResultsCategoryChange}
                                    selectedTeamKey={effectiveTeamKey}
                                    onTeamNavigate={handleTeamNavigate}
                                    onPlayerNavigate={handleCompetitionPlayerNavigate}
                                    openMatches={openMatches}
                                    onToggleMatch={handleToggleMatch}
                                    enableMatchReportOnDemand={matchReportOnDemandEnabled}
                                />
                            </Suspense>
                        )
                    ) : null}

                    {activeCompetitionTab.id === "leaders" ? (
                        competitionPlayerLeadersLoading ? (
                            <SectionFallback message="Cargando líderes globales..." />
                        ) : competitionPlayerLeadersError ? (
                            <div style={appStyles.emptyState}>{competitionPlayerLeadersError}</div>
                        ) : (
                            <Suspense fallback={<SectionFallback message="Cargando líderes globales..." />}>
                                <GlobalLeadersSection
                                    totalPlayers={competitionPlayerLeaders.length}
                                    totalTeams={competitionOverview?.totalTeams ?? teams.length}
                                    leadersByAvgValuation={globalLeadersByAvgValuation}
                                    leadersByPoints={globalLeadersByPoints}
                                    levelOptions={leadersLevelOptions}
                                    selectedLevel={effectiveLeadersLevel}
                                    onSelectedLevelChange={setSelectedLeadersLevel}
                                    categoryOptions={competitionCategoryOptions}
                                    selectedCategory={effectiveLeadersCategory}
                                    onSelectedCategoryChange={handleLeadersCategoryChange}
                                    rankingMinGames={rankingMinGames}
                                    onRankingMinGamesChange={setRankingMinGames}
                                    onTeamNavigate={handleTeamNavigate}
                                />
                            </Suspense>
                        )
                    ) : null}
                </>
            ) : null}
        </div>
    );

    const renderClubPage = () => {
        if (analysisIndexLoading || currentClubDirectoryLoading) {
            return <div style={appStyles.emptyState}>Cargando clubes...</div>;
        }

        if (analysisIndexError || currentClubDirectoryError) {
            return <div style={appStyles.emptyState}>{analysisIndexError || currentClubDirectoryError}</div>;
        }

        if (currentClubEntities.length === 0) {
            return <div style={appStyles.emptyState}>No hay clubes resueltos en la temporada actual.</div>;
        }

        return (
            <div style={appStyles.pageShell}>
                <a
                    href={selectedTeamSummary ? buildTeamRoute(selectedTeamSummary.teamKey) : buildDashboardRoute()}
                    style={appStyles.pageBackLink}
                >
                    Volver al panel
                </a>

                <section style={appStyles.syncIntro}>
                    <div style={appStyles.syncEyebrow}>Clubes</div>
                    <h2 style={appStyles.syncTitle}>Mapa del club por categoria y nivel</h2>
                    <p style={appStyles.syncBody}>
                        Esta pantalla junta todos los equipos del mismo club para que puedas leer su presencia completa
                        en la temporada y saltar rapido a la ficha del equipo o a su clasificacion actual.
                    </p>
                </section>

                <section style={appStyles.teamSelectorSection}>
                    <div style={appStyles.teamSelectorHeader}>
                        <div style={appStyles.syncEyebrow}>Buscador</div>
                        <h2 style={appStyles.teamSelectorTitle}>Encuentra un club</h2>
                        <p style={appStyles.teamSelectorBody}>
                            El buscador usa nombre de club, equipos, categorias y niveles. Al abrir un club veras todos
                            sus equipos agrupados y podras navegar desde ahi.
                        </p>
                    </div>

                    <div style={appStyles.filterDeck}>
                        <AutocompleteField
                            label="Club"
                            value={clubQuery}
                            onValueChange={handleClubQueryChange}
                            onSelectOption={handleClubSelect}
                            options={clubOptions}
                            placeholder="Escribe el nombre del club"
                            ariaLabel="Busca un club por nombre"
                            noResultsText="No se han encontrado clubes con ese nombre"
                            minWidth="min(100%, 520px)"
                        />
                    </div>

                    <div style={appStyles.teamSelectorMetaRow}>
                        <span style={appStyles.teamSelectorChip}>{currentClubEntities.length} clubes detectados</span>
                        <span style={appStyles.teamSelectorChip}>{teams.length} equipos analizados</span>
                        {selectedClub ? (
                            <span style={appStyles.teamSelectorChip}>{selectedClub.meta}</span>
                        ) : null}
                    </div>
                </section>

                {!selectedClub ? (
                    <div style={appStyles.emptyState}>
                        Selecciona un club para ver todos sus equipos y entrar en su clasificacion actual.
                    </div>
                ) : (
                    <>
                        <section style={appStyles.hero}>
                            <div style={appStyles.heroPattern}/>
                            <div style={appStyles.heroContent}>
                                <div style={appStyles.heroHeader}>
                                    <div style={appStyles.heroIdentity}>
                                        <TeamBadge
                                            size="xl"
                                            teamIdExtern={selectedClub.primaryTeamIdExtern}
                                            teamName={selectedClub.label}
                                        />
                                        <div style={appStyles.heroIdentityText}>
                                            <div style={appStyles.heroKicker}>Vista del club</div>
                                            <h2 style={appStyles.heroTitle}>{selectedClub.label}</h2>
                                            <p style={appStyles.heroSummary}>
                                                {selectedClub.totalTeams} equipos activos, {selectedClub.categoriesCount} categorias
                                                y {selectedClub.totalMatches} partidos acumulados en la temporada actual.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div style={appStyles.heroMetaRow}>
                                    {currentSeasonLabel ? (
                                        <span style={appStyles.metaChip}>{currentSeasonLabel}</span>
                                    ) : null}
                                    <span style={appStyles.metaChip}>{selectedClub.totalTeams} equipos</span>
                                    <span style={appStyles.metaChip}>{selectedClub.categoriesCount} categorias</span>
                                    <span style={appStyles.metaChip}>{selectedClub.totalPlayers} jugadoras registradas</span>
                                </div>

                                <div style={appStyles.heroActions}>
                                    <a href={buildCompetitionRoute()} style={appStyles.secondaryLink}>
                                        Ver competicion
                                    </a>
                                    {selectedTeamClubKey === selectedClub.key && selectedTeamSummary ? (
                                        <a href={buildTeamRoute(selectedTeamSummary.teamKey)} style={appStyles.secondaryLink}>
                                            Ver equipo seleccionado
                                        </a>
                                    ) : null}
                                </div>
                            </div>
                        </section>

                        <Suspense fallback={<SectionFallback message="Cargando vista de club..." />}>
                            <ClubOverviewSection
                                club={selectedClub}
                                onTeamNavigate={(teamKey) => handleTeamNavigate(teamKey, "dashboard")}
                                onCompetitionNavigate={handleCompetitionScopeNavigate}
                            />
                        </Suspense>
                    </>
                )}
            </div>
        );
    };

    const renderHistoryPage = () => {
        if (!shouldLoadHistoricalArchive) {
            return (
                <DeferredArchivePrompt
                    styles={appStyles}
                    eyebrow="Histórico"
                    title="Busca un equipo y compáralo temporada a temporada"
                    body="El índice histórico ya está precomputado, pero no se descarga hasta que lo pides. Así evitamos reservar memoria y parsear todo el archivo en cada visita."
                    summary={`${totalPublishedSeasons} temporadas publicadas. Pulsa el botón para cargar el buscador histórico completo.`}
                    onRequest={handleHistoricalArchiveRequest}
                />
            );
        }

        if (historyArchiveLoading) {
            return <div style={appStyles.emptyState}>Cargando archivo histórico...</div>;
        }

        if (historyArchiveError) {
            return <div style={appStyles.emptyState}>{historyArchiveError}</div>;
        }

        return (
            <div style={appStyles.pageShell}>
                <section style={appStyles.syncIntro}>
                    <div style={appStyles.syncEyebrow}>Histórico</div>
                    <h2 style={appStyles.syncTitle}>Busca un equipo y compáralo temporada a temporada</h2>
                    <p style={appStyles.syncBody}>
                        Esta vista no va por fase. Busca el equipo por nombre y verás su rendimiento separado por
                        temporada, con una lectura limpia de clasificación, puntos, diferencial y valoración media.
                    </p>
                </section>

                <section style={appStyles.teamSelectorSection}>
                    <div style={appStyles.teamSelectorHeader}>
                        <div style={appStyles.syncEyebrow}>Buscador</div>
                        <h2 style={appStyles.teamSelectorTitle}>Encuentra un equipo en el archivo</h2>
                        <p style={appStyles.teamSelectorBody}>
                            Empieza a escribir y el buscador te propondrá coincidencias. Cuando eliges un equipo, debajo
                            se abre su histórico temporada a temporada.
                        </p>
                    </div>

                    <div style={appStyles.filterDeck}>
                        <AutocompleteField
                            label="Equipo"
                            value={historyTeamQuery}
                            onValueChange={handleHistoryTeamQueryChange}
                            onSelectOption={handleHistoryTeamSelect}
                            options={historicalTeamOptions}
                            placeholder="Escribe el nombre del equipo"
                            ariaLabel="Busca un equipo histórico por nombre"
                            noResultsText="No se han encontrado equipos con ese nombre"
                            minWidth="min(100%, 520px)"
                        />
                    </div>

                    <div style={appStyles.teamSelectorMetaRow}>
                        <span style={appStyles.teamSelectorChip}>{historicalTeamEntities.length} equipos indexados</span>
                        <span style={appStyles.teamSelectorChip}>{totalPublishedSeasons} temporadas publicadas</span>
                        {selectedHistoricalTeam ? (
                            <span style={appStyles.teamSelectorChip}>
                                {selectedHistoricalTeam.seasonSummaries.length} temporada{selectedHistoricalTeam.seasonSummaries.length === 1 ? "" : "s"} encontrada{selectedHistoricalTeam.seasonSummaries.length === 1 ? "" : "s"}
                            </span>
                        ) : null}
                    </div>
                </section>

                {!selectedHistoricalTeam ? (
                    <div style={appStyles.emptyState}>
                        Selecciona un equipo para ver cómo cambia su rendimiento con el paso de las temporadas.
                    </div>
                ) : (
                    <>
                        <section style={appStyles.hero}>
                            <div style={appStyles.heroPattern}/>
                            <div style={appStyles.heroContent}>
                                <div style={appStyles.heroHeader}>
                                    <div style={appStyles.heroIdentity}>
                                        <TeamBadge
                                            size="xl"
                                            teamIdExtern={selectedHistoricalTeam.latestTeamIdExtern}
                                            teamName={selectedHistoricalTeam.label}
                                        />
                                        <div style={appStyles.heroIdentityText}>
                                            <div style={appStyles.heroKicker}>Archivo del equipo</div>
                                            <h2 style={appStyles.heroTitle}>{selectedHistoricalTeam.label}</h2>
                                            <p style={appStyles.heroSummary}>
                                                {selectedHistoricalTeam.seasonSummaries.length} temporada{selectedHistoricalTeam.seasonSummaries.length === 1 ? "" : "s"} registradas en el archivo.
                                                Aquí solo miramos el rendimiento global de cada curso, sin entrar en fases.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div style={appStyles.heroMetaRow}>
                                    {selectedHistoricalTeam.seasonSummaries.map((seasonSummary) => (
                                        <span key={seasonSummary.key} style={appStyles.metaChip}>{seasonSummary.seasonLabel}</span>
                                    ))}
                                </div>
                            </div>
                        </section>

                        <section style={appStyles.seasonCards}>
                            {selectedHistoricalTeam.seasonSummaries.map((seasonSummary) => (
                                <article key={seasonSummary.key} style={appStyles.seasonCard}>
                                    <div style={appStyles.seasonCardHeader}>
                                        <div style={appStyles.seasonCardIdentity}>
                                            <TeamBadge
                                                size="lg"
                                                teamIdExtern={seasonSummary.teamIdExtern}
                                                teamName={seasonSummary.teamName}
                                            />
                                            <div style={appStyles.seasonCardIdentityText}>
                                                <div style={appStyles.seasonCardEyebrow}>{seasonSummary.seasonLabel}</div>
                                                <h3 style={appStyles.seasonCardTitle}>{seasonSummary.teamName}</h3>
                                                <p style={appStyles.seasonCardMeta}>
                                                    {seasonSummary.categoryName || "Sin categoría visible"}
                                                    {seasonSummary.levelName ? ` · ${seasonSummary.levelName}` : ""}
                                                    {` · ${seasonSummary.matchesPlayed} partidos`}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={appStyles.seasonMetricsGrid}>
                                        <div style={appStyles.seasonMetricCard}>
                                            <div style={appStyles.seasonMetricLabel}>Posición</div>
                                            <div style={appStyles.seasonMetricValue}>
                                                {seasonSummary.standingPosition ? `#${seasonSummary.standingPosition}` : "—"}
                                            </div>
                                            <div style={appStyles.seasonMetricMeta}>Clasificación acumulada</div>
                                        </div>

                                        <div style={appStyles.seasonMetricCard}>
                                            <div style={appStyles.seasonMetricLabel}>Balance</div>
                                            <div style={appStyles.seasonMetricValue}>
                                                {formatRecordLine(seasonSummary)}
                                            </div>
                                            <div style={appStyles.seasonMetricMeta}>Victorias, derrotas y empates</div>
                                        </div>

                                        <div style={appStyles.seasonMetricCard}>
                                            <div style={appStyles.seasonMetricLabel}>Puntos a favor</div>
                                            <div style={appStyles.seasonMetricValue}>{seasonSummary.pointsFor}</div>
                                            <div style={appStyles.seasonMetricMeta}>Producción total del curso</div>
                                        </div>

                                        <div style={appStyles.seasonMetricCard}>
                                            <div style={appStyles.seasonMetricLabel}>Puntos en contra</div>
                                            <div style={appStyles.seasonMetricValue}>{seasonSummary.pointsAgainst}</div>
                                            <div style={appStyles.seasonMetricMeta}>Concedidos en toda la temporada</div>
                                        </div>

                                        <div style={appStyles.seasonMetricCard}>
                                            <div style={appStyles.seasonMetricLabel}>Diferencial</div>
                                            <div style={appStyles.seasonMetricValue}>{formatSignedNumber(seasonSummary.pointDiff, 0)}</div>
                                            <div style={appStyles.seasonMetricMeta}>Puntos a favor menos puntos en contra</div>
                                        </div>

                                        <div style={appStyles.seasonMetricCard}>
                                            <div style={appStyles.seasonMetricLabel}>Val media</div>
                                            <div style={appStyles.seasonMetricValue}>{formatDecimal(seasonSummary.avgValuation, 1)}</div>
                                            <div style={appStyles.seasonMetricMeta}>Valoración media por partido</div>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </section>
                    </>
                )}
            </div>
        );
    };

    const renderPlayersPage = () => {
        if (!shouldLoadHistoricalArchive) {
            return (
                <DeferredArchivePrompt
                    styles={appStyles}
                    eyebrow="Jugadoras"
                    title="Busca una jugadora y abre su histórico"
                    body="Igual que el histórico de equipos, este índice completo se descarga solo cuando lo necesitas."
                    summary={`${totalPublishedSeasons} temporadas publicadas. Pulsa el botón para cargar el buscador histórico de jugadoras.`}
                    onRequest={handleHistoricalArchiveRequest}
                />
            );
        }

        if (playersArchiveLoading) {
            return <div style={appStyles.emptyState}>Cargando archivo de jugadoras...</div>;
        }

        if (playersArchiveError) {
            return <div style={appStyles.emptyState}>{playersArchiveError}</div>;
        }

        const playerTotals = selectedHistoricalPlayer?.totals ?? null;

        return (
            <div style={appStyles.pageShell}>
                <section style={appStyles.syncIntro}>
                    <div style={appStyles.syncEyebrow}>Jugadoras</div>
                    <h2 style={appStyles.syncTitle}>Busca una jugadora y abre su histórico</h2>
                    <p style={appStyles.syncBody}>
                        Esta pantalla ya no va por una sola temporada. Busca por nombre y verás el acumulado completo y
                        el detalle separado por temporada para seguir su evolución real.
                    </p>
                </section>

                <section style={appStyles.teamSelectorSection}>
                    <div style={appStyles.teamSelectorHeader}>
                        <div style={appStyles.syncEyebrow}>Buscador</div>
                        <h2 style={appStyles.teamSelectorTitle}>Encuentra una jugadora por nombre</h2>
                        <p style={appStyles.teamSelectorBody}>
                            El buscador autocompleta mientras escribes. Al seleccionar una jugadora se abre su resumen
                            acumulado y, debajo, la lectura temporada a temporada.
                        </p>
                    </div>

                    <div style={appStyles.filterDeck}>
                        <AutocompleteField
                            label="Jugadora"
                            value={playerDirectoryQuery}
                            onValueChange={handleHistoricalPlayerQueryChange}
                            onSelectOption={handleHistoricalPlayerSelect}
                            options={historicalPlayerOptions}
                            placeholder="Escribe el nombre de la jugadora"
                            ariaLabel="Busca una jugadora por nombre"
                            noResultsText="No se han encontrado jugadoras con ese nombre"
                            minWidth="min(100%, 520px)"
                        />
                    </div>

                    <div style={appStyles.teamSelectorMetaRow}>
                        <span style={appStyles.teamSelectorChip}>{historicalPlayerEntities.length} jugadoras indexadas</span>
                        <span style={appStyles.teamSelectorChip}>{totalPublishedSeasons} temporadas publicadas</span>
                        {selectedHistoricalPlayer ? (
                            <span style={appStyles.teamSelectorChip}>
                                {selectedHistoricalPlayer.seasonSummaries.length} temporada{selectedHistoricalPlayer.seasonSummaries.length === 1 ? "" : "s"} registrada{selectedHistoricalPlayer.seasonSummaries.length === 1 ? "" : "s"}
                            </span>
                        ) : null}
                    </div>
                </section>

                {!selectedHistoricalPlayer || !playerTotals ? (
                    <div style={appStyles.emptyState}>
                        Selecciona una jugadora para ver su producción acumulada y su desglose por temporada.
                    </div>
                ) : (
                    <>
                        <section style={appStyles.hero}>
                            <div style={appStyles.heroPattern}/>
                            <div style={appStyles.heroContent}>
                                <div style={appStyles.heroHeader}>
                                    <div style={appStyles.heroKicker}>Ficha histórica</div>
                                    <h2 style={appStyles.heroTitle}>{selectedHistoricalPlayer.label}</h2>
                                    <p style={appStyles.heroSummary}>
                                        {playerTotals.points} puntos, {playerTotals.valuation} de valoración, {playerTotals.fouls} faltas
                                        y {playerTotals.games} partidos acumulados en {playerTotals.seasons} temporada{playerTotals.seasons === 1 ? "" : "s"}.
                                    </p>
                                </div>

                                <div style={appStyles.heroMetaRow}>
                                    {selectedHistoricalPlayer.latestShirtNumber ? (
                                        <span style={appStyles.metaChip}>Dorsal actual #{selectedHistoricalPlayer.latestShirtNumber}</span>
                                    ) : null}
                                    <span style={appStyles.metaChip}>{formatDecimal(playerTotals.avgPoints, 1)} puntos por partido</span>
                                    <span style={appStyles.metaChip}>{formatDecimal(playerTotals.avgValuation, 1)} valoración media</span>
                                    <span style={appStyles.metaChip}>{formatDecimal(playerTotals.avgFouls, 1)} faltas por partido</span>
                                    <span style={appStyles.metaChip}>{playerTotals.minutes} minutos acumulados</span>
                                </div>
                            </div>
                        </section>

                        <section style={appStyles.aggregateGrid}>
                            <div style={appStyles.seasonMetricCard}>
                                <div style={appStyles.seasonMetricLabel}>Temporadas</div>
                                <div style={appStyles.seasonMetricValue}>{playerTotals.seasons}</div>
                                <div style={appStyles.seasonMetricMeta}>Cursos registrados en el archivo</div>
                            </div>

                            <div style={appStyles.seasonMetricCard}>
                                <div style={appStyles.seasonMetricLabel}>Partidos</div>
                                <div style={appStyles.seasonMetricValue}>{playerTotals.games}</div>
                                <div style={appStyles.seasonMetricMeta}>Encuentros acumulados</div>
                            </div>

                            <div style={appStyles.seasonMetricCard}>
                                <div style={appStyles.seasonMetricLabel}>Puntos</div>
                                <div style={appStyles.seasonMetricValue}>{playerTotals.points}</div>
                                <div style={appStyles.seasonMetricMeta}>Anotación total acumulada</div>
                            </div>

                            <div style={appStyles.seasonMetricCard}>
                                <div style={appStyles.seasonMetricLabel}>Valoración</div>
                                <div style={appStyles.seasonMetricValue}>{playerTotals.valuation}</div>
                                <div style={appStyles.seasonMetricMeta}>Valoración total acumulada</div>
                            </div>

                            <div style={appStyles.seasonMetricCard}>
                                <div style={appStyles.seasonMetricLabel}>Faltas</div>
                                <div style={appStyles.seasonMetricValue}>{playerTotals.fouls}</div>
                                <div style={appStyles.seasonMetricMeta}>Faltas personales acumuladas</div>
                            </div>

                            <div style={appStyles.seasonMetricCard}>
                                <div style={appStyles.seasonMetricLabel}>Val media</div>
                                <div style={appStyles.seasonMetricValue}>{formatDecimal(playerTotals.avgValuation, 1)}</div>
                                <div style={appStyles.seasonMetricMeta}>Valoración media global</div>
                            </div>

                            <div style={appStyles.seasonMetricCard}>
                                <div style={appStyles.seasonMetricLabel}>Pts/partido</div>
                                <div style={appStyles.seasonMetricValue}>{formatDecimal(playerTotals.avgPoints, 1)}</div>
                                <div style={appStyles.seasonMetricMeta}>Producción anotadora global</div>
                            </div>

                            <div style={appStyles.seasonMetricCard}>
                                <div style={appStyles.seasonMetricLabel}>Flt/partido</div>
                                <div style={appStyles.seasonMetricValue}>{formatDecimal(playerTotals.avgFouls, 1)}</div>
                                <div style={appStyles.seasonMetricMeta}>Carga de faltas global</div>
                            </div>
                        </section>

                        <section style={appStyles.seasonCards}>
                            {selectedHistoricalPlayer.seasonSummaries.map((seasonSummary) => (
                                <article key={seasonSummary.key} style={appStyles.seasonCard}>
                                    <div style={appStyles.seasonCardHeader}>
                                        <div style={appStyles.seasonCardIdentity}>
                                            <TeamBadge
                                                size="lg"
                                                teamIdExtern={seasonSummary.primaryTeamIdExtern}
                                                teamName={seasonSummary.primaryTeamName || seasonSummary.teamNames[0] || selectedHistoricalPlayer.label}
                                            />
                                            <div style={appStyles.seasonCardIdentityText}>
                                                <div style={appStyles.seasonCardEyebrow}>
                                                    {seasonSummary.seasonLabel}
                                                    {seasonSummary.shirtNumber ? ` · #${seasonSummary.shirtNumber}` : ""}
                                                </div>
                                                <h3 style={appStyles.seasonCardTitle}>{seasonSummary.playerName}</h3>
                                                <p style={appStyles.seasonCardMeta}>
                                                    {seasonSummary.teamNames.join(" · ") || "Equipo no disponible"}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={appStyles.seasonMetricsGrid}>
                                        <div style={appStyles.seasonMetricCard}>
                                            <div style={appStyles.seasonMetricLabel}>Partidos</div>
                                            <div style={appStyles.seasonMetricValue}>{seasonSummary.games}</div>
                                            <div style={appStyles.seasonMetricMeta}>Encuentros de la temporada</div>
                                        </div>

                                        <div style={appStyles.seasonMetricCard}>
                                            <div style={appStyles.seasonMetricLabel}>Puntos</div>
                                            <div style={appStyles.seasonMetricValue}>{seasonSummary.points}</div>
                                            <div style={appStyles.seasonMetricMeta}>{formatDecimal(seasonSummary.avgPoints, 1)} por partido</div>
                                        </div>

                                        <div style={appStyles.seasonMetricCard}>
                                            <div style={appStyles.seasonMetricLabel}>Valoración</div>
                                            <div style={appStyles.seasonMetricValue}>{seasonSummary.valuation}</div>
                                            <div style={appStyles.seasonMetricMeta}>{formatDecimal(seasonSummary.avgValuation, 1)} de media</div>
                                        </div>

                                        <div style={appStyles.seasonMetricCard}>
                                            <div style={appStyles.seasonMetricLabel}>Faltas</div>
                                            <div style={appStyles.seasonMetricValue}>{seasonSummary.fouls}</div>
                                            <div style={appStyles.seasonMetricMeta}>{formatDecimal(seasonSummary.avgFouls, 1)} por partido</div>
                                        </div>

                                        <div style={appStyles.seasonMetricCard}>
                                            <div style={appStyles.seasonMetricLabel}>Minutos</div>
                                            <div style={appStyles.seasonMetricValue}>{seasonSummary.minutes}</div>
                                            <div style={appStyles.seasonMetricMeta}>{formatDecimal(seasonSummary.avgMinutes, 1)} por partido</div>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </section>
                    </>
                )}
            </div>
        );
    };

    const pageMeta = getPageMetadata(route, currentSeasonLabel);

    const renderComparePage = () => {
        const COMPARE_TABS = [
            {id: "teams", label: "Equipos", description: "Compara dos equipos de la temporada actual cara a cara."},
            {id: "players", label: "Jugadoras", description: "Compara dos jugadoras con sus estadísticas históricas acumuladas."}
        ];
        const activeCompareTab = COMPARE_TABS.find((t) => t.id === compareTab) ?? COMPARE_TABS[0];

        const handleCompareTeam1Select = (option) => {
            setCompareTeamKey1(option.value);
            setCompareTeamQuery1(option.label);
            navigateToHash(buildCompareRoute({
                tab: compareTab,
                team1: option.value,
                team2: compareTeamKey2
            }));
        };

        const handleCompareTeam2Select = (option) => {
            setCompareTeamKey2(option.value);
            setCompareTeamQuery2(option.label);
            navigateToHash(buildCompareRoute({
                tab: compareTab,
                team1: compareTeamKey1,
                team2: option.value
            }));
        };

        const handleCompareTeam1QueryChange = (value) => {
            setCompareTeamQuery1(value);
            if (!String(value ?? "").trim()) {
                setCompareTeamKey1("");
            }
        };

        const handleCompareTeam2QueryChange = (value) => {
            setCompareTeamQuery2(value);
            if (!String(value ?? "").trim()) {
                setCompareTeamKey2("");
            }
        };

        const handleComparePlayer1Select = (option) => {
            setComparePlayerKey1(option.value);
            setComparePlayerQuery1(option.label);
            navigateToHash(buildCompareRoute({
                tab: compareTab,
                player1: option.value,
                player2: comparePlayerKey2
            }));
        };

        const handleComparePlayer2Select = (option) => {
            setComparePlayerKey2(option.value);
            setComparePlayerQuery2(option.label);
            navigateToHash(buildCompareRoute({
                tab: compareTab,
                player1: comparePlayerKey1,
                player2: option.value
            }));
        };

        const handleComparePlayer1QueryChange = (value) => {
            setComparePlayerQuery1(value);
            if (!String(value ?? "").trim()) {
                setComparePlayerKey1("");
            }
        };

        const handleComparePlayer2QueryChange = (value) => {
            setComparePlayerQuery2(value);
            if (!String(value ?? "").trim()) {
                setComparePlayerKey2("");
            }
        };

        const handleCompareTabChange = (tabId) => {
            if (tabId === compareTab) {
                return;
            }

            setCompareTab(tabId);
            navigateToHash(buildCompareRoute({tab: tabId}));
        };

        return (
            <div style={appStyles.pageShell}>
                <a
                    href={selectedTeamSummary ? buildTeamRoute(selectedTeamSummary.teamKey) : buildDashboardRoute()}
                    style={appStyles.pageBackLink}
                >
                    Volver al panel
                </a>

                <section style={appStyles.syncIntro}>
                    <div style={appStyles.syncEyebrow}>Comparador</div>
                    <h2 style={appStyles.syncTitle}>Compara equipos o jugadoras cara a cara</h2>
                    <p style={appStyles.syncBody}>
                        Elige dos equipos de la temporada actual para comparar su rendimiento, o busca dos jugadoras en el archivo histórico para ver su trayectoria lado a lado.
                    </p>
                </section>

                <section style={appStyles.competitionTabs}>
                    <div style={appStyles.competitionTabRow}>
                        {COMPARE_TABS.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                style={tab.id === activeCompareTab.id
                                    ? {...appStyles.competitionTab, ...appStyles.competitionTabActive}
                                    : appStyles.competitionTab}
                                onClick={() => handleCompareTabChange(tab.id)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <p style={appStyles.competitionTabHint}>{activeCompareTab.description}</p>
                </section>

                {analysisIndexLoading ? (
                    <SectionFallback message="Cargando datos de la temporada..." />
                ) : null}

                {!analysisIndexLoading && activeCompareTab.id === "teams" ? (
                    <Suspense fallback={<SectionFallback message="Cargando comparador de equipos..." />}>
                        <TeamCompareSection
                            teamOptions={compareTeamOptions}
                            teamQuery1={compareTeamQuery1 || compareTeam1SummaryFromIndex?.teamName || ""}
                            teamQuery2={compareTeamQuery2 || compareTeam2SummaryFromIndex?.teamName || ""}
                            onTeam1QueryChange={handleCompareTeam1QueryChange}
                            onTeam2QueryChange={handleCompareTeam2QueryChange}
                            onTeam1Select={handleCompareTeam1Select}
                            onTeam2Select={handleCompareTeam2Select}
                            teamData1={{
                                summary: compareTeam1SummaryFromIndex,
                                record: compareTeam1Record,
                                standingRow: compareTeam1StandingRow,
                                bestWinStreak: compareTeam1WinStreak,
                                teamAvg: compareTeam1Avg,
                                topScorer: compareTeam1TopScorer,
                                mvp: compareTeam1Mvp,
                                loading: compareTeamKey1
                                    ? (compareTeam1MatchesLoading || compareTeam1PlayersLoading)
                                    : false,
                                error: compareTeam1MatchesError || compareTeam1PlayersError
                            }}
                            teamData2={{
                                summary: compareTeam2SummaryFromIndex,
                                record: compareTeam2Record,
                                standingRow: compareTeam2StandingRow,
                                bestWinStreak: compareTeam2WinStreak,
                                teamAvg: compareTeam2Avg,
                                topScorer: compareTeam2TopScorer,
                                mvp: compareTeam2Mvp,
                                loading: compareTeamKey2
                                    ? (compareTeam2MatchesLoading || compareTeam2PlayersLoading)
                                    : false,
                                error: compareTeam2MatchesError || compareTeam2PlayersError
                            }}
                        />
                    </Suspense>
                ) : null}

                {activeCompareTab.id === "players" ? (
                    <Suspense fallback={<SectionFallback message="Cargando comparador de jugadoras..." />}>
                        <PlayerCompareSection
                            playerOptions={comparePlayerOptions}
                            playerQuery1={comparePlayerQuery1 || compareSelectedPlayer1?.label || ""}
                            playerQuery2={comparePlayerQuery2 || compareSelectedPlayer2?.label || ""}
                            onPlayer1QueryChange={handleComparePlayer1QueryChange}
                            onPlayer2QueryChange={handleComparePlayer2QueryChange}
                            onPlayer1Select={handleComparePlayer1Select}
                            onPlayer2Select={handleComparePlayer2Select}
                            selectedPlayer1={compareSelectedPlayer1}
                            selectedPlayer2={compareSelectedPlayer2}
                            loading={historicalPlayersLoading}
                        />
                    </Suspense>
                ) : null}
            </div>
        );
    };

    return (
        <div style={appStyles.page}>
            <div style={appStyles.glowPrimary}/>
            <div style={appStyles.glowSecondary}/>

            <div style={appStyles.container}>
                <div style={appStyles.topBar}>
                    <div style={appStyles.brand}>
                        <p style={appStyles.eyebrow}>BarnaStats</p>
                        <h1 style={appStyles.brandTitle}>{pageMeta.title}</h1>
                        <p style={appStyles.brandNote}>
                            {pageMeta.note}
                            {pageMeta.seasonLabel
                                ? ` Temporada actual: ${pageMeta.seasonLabel}.`
                                : ""}
                        </p>
                    </div>

                    <div style={appStyles.topBarActions}>
                        <div style={appStyles.nav}>
                            <a
                                href={buildDashboardRoute()}
                                style={route === "dashboard"
                                    ? {...appStyles.navLink, ...appStyles.navLinkActive}
                                    : appStyles.navLink}
                            >
                                Equipo
                            </a>

                            <a
                                href={buildCompetitionRoute()}
                                style={route === "competition"
                                    ? {...appStyles.navLink, ...appStyles.navLinkActive}
                                    : appStyles.navLink}
                            >
                                Competición
                            </a>

                            <a
                                href={buildClubRoute(selectedTeamClubKey)}
                                style={route === "club"
                                    ? {...appStyles.navLink, ...appStyles.navLinkActive}
                                    : appStyles.navLink}
                            >
                                Club
                            </a>

                            <a
                                href={buildHistoryRoute()}
                                style={route === "history"
                                    ? {...appStyles.navLink, ...appStyles.navLinkActive}
                                    : appStyles.navLink}
                            >
                                Histórico
                            </a>

                            <a
                                href={buildPlayersRoute()}
                                style={route === "players"
                                    ? {...appStyles.navLink, ...appStyles.navLinkActive}
                                    : appStyles.navLink}
                            >
                                Jugadoras
                            </a>

                            <a
                                href={buildCompareRoute()}
                                style={route === "compare"
                                    ? {...appStyles.navLink, ...appStyles.navLinkActive}
                                    : appStyles.navLink}
                            >
                                Comparar
                            </a>

                            {syncUiEnabled ? (
                                <a
                                    href={SYNC_ROUTE}
                                    style={route === "sync"
                                        ? {...appStyles.navLink, ...appStyles.navLinkActive}
                                        : appStyles.navLink}
                                >
                                    Cargar fase
                                </a>
                            ) : null}
                        </div>
                    </div>
                </div>

                {route === "sync" && syncUiEnabled
                    ? renderSyncPage()
                    : route === "competition"
                        ? renderCompetitionPage()
                        : route === "club"
                            ? renderClubPage()
                        : route === "history"
                            ? renderHistoryPage()
                        : route === "players"
                            ? renderPlayersPage()
                        : route === "compare"
                            ? renderComparePage()
                            : renderTeamPage()}
            </div>
        </div>
    );
}

export default App;
