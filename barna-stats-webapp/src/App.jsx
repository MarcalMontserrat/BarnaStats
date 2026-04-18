import {lazy, Suspense, useEffect, useRef, useState} from "react";
import AutocompleteField from "./components/AutocompleteField.jsx";
import PrettySelect from "./components/PrettySelect.jsx";
import TeamBadge from "./components/TeamBadge.jsx";
import {useAnalysisData} from "./hooks/useAnalysisData.js";
import {useSeasonDirectoryData} from "./hooks/useSeasonDirectoryData.js";
import {useResultsSources} from "./hooks/useResultsSources.js";
import {useSyncJob} from "./hooks/useSyncJob.js";
import {
    buildCategoryOptions,
    buildCategoryOptionsFromRows,
    buildCompetitionPhaseLabel,
    buildCompetitionPhaseOptions,
    buildTeamRecord,
    buildTeamPhaseOptions,
    buildPhaseComparison,
    buildPhaseSummaries,
    buildStandings,
    buildTeamRoute,
    buildLatestTeamContextByKey,
    buildLevelOptionsFromRows,
    filterCompetitionMatchesByPhaseOption,
    filterRowsByCategory,
    filterRowsByLevel,
    filterRowsByPhaseOption,
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
    buildHistoricalPlayerEntities,
    buildHistoricalTeamEntities
} from "./utils/historicalDirectory.js";
import {buildCurrentClubEntities} from "./utils/clubDirectory.js";
import {getClubBrandingForTeam} from "./utils/clubBranding.js";

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

const DASHBOARD_ROUTE = "#/";
const SYNC_ROUTE = "#/sync";
const COMPETITION_ROUTE = "#/competition";
const CLUB_ROUTE = "#/club";
const HISTORY_ROUTE = "#/history";
const PLAYERS_ROUTE = "#/players";
const TEAM_ROUTE_PREFIX = "#/team/";
const CLUB_ROUTE_PREFIX = "#/club/";
const HISTORY_TEAM_ROUTE_PREFIX = "#/history/";
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
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 18,
        flexWrap: "wrap",
        animation: "fade-up 650ms ease both"
    },
    topBarActions: {
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "flex-end",
        gap: 14,
        flexWrap: "wrap"
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

function buildHash(path, params = {}) {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (!value) {
            return;
        }

        query.set(key, String(value));
    });

    const queryString = query.toString();
    return queryString ? `${path}?${queryString}` : path;
}

function buildDashboardRoute() {
    return DASHBOARD_ROUTE;
}

function buildCompetitionRoute({
    teamKey = "",
    tab = "",
    category = "",
    level = "",
    phase = ""
} = {}) {
    return buildHash(COMPETITION_ROUTE, {
        team: teamKey,
        tab,
        category,
        level,
        phase
    });
}

function buildClubRoute(clubKey = "") {
    return clubKey
        ? `${CLUB_ROUTE}/${encodeURIComponent(clubKey)}`
        : CLUB_ROUTE;
}

function buildHistoryRoute(teamKey = "", seasonLabel = "") {
    const path = teamKey
        ? `${HISTORY_ROUTE}/${encodeURIComponent(teamKey)}`
        : HISTORY_ROUTE;

    return buildHash(path, {season: seasonLabel});
}

function buildPlayersRoute(seasonLabel = "", playerKey = "") {
    return buildHash(PLAYERS_ROUTE, {
        season: seasonLabel,
        player: playerKey
    });
}

function parseHash(hash) {
    const [path, queryString = ""] = String(hash ?? "").split("?");
    const params = new URLSearchParams(queryString);
    const seasonLabel = params.get("season") ?? "";
    const playerKey = params.get("player") ?? "";
    const teamKey = params.get("team") ?? "";
    const clubKey = params.get("club") ?? "";
    const competitionTab = params.get("tab") ?? "";
    const competitionCategory = params.get("category") ?? "";
    const competitionLevel = params.get("level") ?? "";
    const competitionPhase = params.get("phase") ?? "";

    if (path === SYNC_ROUTE) {
        return {
            route: "sync",
            teamKey: null,
            clubKey: "",
            seasonLabel,
            playerKey: "",
            competitionTab: "",
            competitionCategory: "",
            competitionLevel: "",
            competitionPhase: ""
        };
    }

    if (path === COMPETITION_ROUTE || path === "#/rankings" || path === "#/global") {
        return {
            route: "competition",
            teamKey: teamKey || null,
            clubKey: "",
            seasonLabel: "",
            playerKey: "",
            competitionTab,
            competitionCategory,
            competitionLevel,
            competitionPhase
        };
    }

    if (path === CLUB_ROUTE) {
        return {
            route: "club",
            teamKey: teamKey || null,
            clubKey: clubKey || null,
            seasonLabel: "",
            playerKey: "",
            competitionTab: "",
            competitionCategory: "",
            competitionLevel: "",
            competitionPhase: ""
        };
    }

    if (path === PLAYERS_ROUTE) {
        return {
            route: "players",
            teamKey: null,
            clubKey: "",
            seasonLabel,
            playerKey,
            competitionTab: "",
            competitionCategory: "",
            competitionLevel: "",
            competitionPhase: ""
        };
    }

    if (path === HISTORY_ROUTE) {
        return {
            route: "history",
            teamKey: null,
            clubKey: "",
            seasonLabel,
            playerKey: "",
            competitionTab: "",
            competitionCategory: "",
            competitionLevel: "",
            competitionPhase: ""
        };
    }

    if (path.startsWith(HISTORY_TEAM_ROUTE_PREFIX)) {
        const encodedTeamKey = path.slice(HISTORY_TEAM_ROUTE_PREFIX.length);

        return {
            route: "history",
            teamKey: encodedTeamKey ? decodeURIComponent(encodedTeamKey) : null,
            clubKey: "",
            seasonLabel,
            playerKey: "",
            competitionTab: "",
            competitionCategory: "",
            competitionLevel: "",
            competitionPhase: ""
        };
    }

    if (path.startsWith(CLUB_ROUTE_PREFIX)) {
        const encodedClubKey = path.slice(CLUB_ROUTE_PREFIX.length);

        return {
            route: "club",
            teamKey: teamKey || null,
            clubKey: encodedClubKey ? decodeURIComponent(encodedClubKey) : null,
            seasonLabel: "",
            playerKey: "",
            competitionTab: "",
            competitionCategory: "",
            competitionLevel: "",
            competitionPhase: ""
        };
    }

    if (path.startsWith(TEAM_ROUTE_PREFIX)) {
        const encodedTeamKey = path.slice(TEAM_ROUTE_PREFIX.length);

        return {
            route: "dashboard",
            teamKey: encodedTeamKey ? decodeURIComponent(encodedTeamKey) : null,
            clubKey: "",
            seasonLabel: "",
            playerKey: "",
            competitionTab: "",
            competitionCategory: "",
            competitionLevel: "",
            competitionPhase: ""
        };
    }

    return {
        route: "dashboard",
        teamKey: null,
        clubKey: "",
        seasonLabel: "",
        playerKey: "",
        competitionTab: "",
        competitionCategory: "",
        competitionLevel: "",
        competitionPhase: ""
    };
}

function navigateToHash(hash) {
    window.location.assign(hash);
}

function buildPhaseScopeKey(row) {
    const sourcePhaseId = Number(row?.sourcePhaseId ?? 0);
    const seasonLabel = String(row?.seasonLabel ?? "").trim();
    if (sourcePhaseId > 0) {
        return `source:${seasonLabel}:${sourcePhaseId}`;
    }

    const phaseNumber = Number(row?.phaseNumber ?? 0);
    const categoryName = String(row?.categoryName ?? "").trim();
    const levelKey = String(row?.levelCode ?? "").trim() || String(row?.levelName ?? "").trim();
    const groupCode = String(row?.groupCode ?? "").trim();
    const phaseName = String(row?.phaseName ?? "").trim();

    return `phase:${seasonLabel}|${phaseNumber}|${categoryName}|${levelKey}|${groupCode}|${phaseName}`;
}

function filterMatchesByPhaseScopes(matches, phases, fallbackCategoryName = "") {
    const scopeKeys = new Set((phases ?? []).map((phase) => buildPhaseScopeKey(phase)));
    if (scopeKeys.size > 0) {
        return (matches ?? []).filter((match) => scopeKeys.has(buildPhaseScopeKey(match)));
    }

    return filterRowsByCategory(matches ?? [], fallbackCategoryName);
}

function App() {
    const syncUiEnabled = import.meta.env.VITE_ENABLE_SYNC_UI !== "false";
    const initialHashState = parseHash(window.location.hash);
    const [analysisVersion, setAnalysisVersion] = useState(() => Date.now());
    const [route, setRoute] = useState(() => initialHashState.route);
    const [selectedSeasonLabel, setSelectedSeasonLabel] = useState(() => initialHashState.seasonLabel ?? "");
    const {
        analysis: seasonsIndex,
        loading: seasonsIndexLoading,
        error: seasonsIndexError
    } = useAnalysisData(`data/seasons/index.json?v=${analysisVersion}`);
    const seasonOptions = seasonsIndex?.seasons ?? [];
    const defaultSeasonLabel = seasonsIndex?.defaultSeasonLabel
        || seasonOptions[0]?.seasonLabel
        || "";
    const effectiveExplorerSeasonLabel = seasonOptions.some((season) => season.seasonLabel === selectedSeasonLabel)
        ? selectedSeasonLabel
        : defaultSeasonLabel;
    const selectedSeasonEntry = seasonOptions.find((season) => season.seasonLabel === effectiveExplorerSeasonLabel)
        ?? seasonOptions[0]
        ?? null;
    const initialCompetitionTab = initialHashState.competitionTab || "standings";
    const initialCompetitionCategory = initialHashState.competitionCategory || "all";
    const initialCompetitionLevel = initialHashState.competitionLevel || "all";
    const initialCompetitionPhase = initialHashState.competitionPhase || "all";
    const isHistoryRoute = route === "history";
    const isPlayersRoute = route === "players";
    const isClubRoute = route === "club";
    const isTeamRoute = route === "dashboard";
    const isCurrentSeasonRoute = route === "dashboard" || route === "competition" || route === "club";
    const {
        analysis: currentAnalysisIndex,
        loading: currentAnalysisIndexLoading,
        error: currentAnalysisIndexError
    } = useAnalysisData(
        isCurrentSeasonRoute
            ? `data/analysis.json?v=${analysisVersion}`
            : null
    );
    const {
        analysis: explorerAnalysisIndex,
        loading: explorerAnalysisIndexLoading,
        error: explorerAnalysisIndexError
    } = useAnalysisData(
        (isHistoryRoute || isPlayersRoute) && selectedSeasonEntry
            ? `data/${selectedSeasonEntry.analysisFile}?v=${analysisVersion}`
            : null
    );
    const {
        sources: savedResultsSources,
        loading: savedResultsSourcesLoading,
        error: savedResultsSourcesError,
        deletingPhaseId: deletingSavedPhaseId,
        deleteSource: deleteSavedResultsSource,
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
        analysis: currentCompetition,
        loading: currentCompetitionLoading,
        error: currentCompetitionError
    } = useAnalysisData(
        isCurrentSeasonRoute
            ? `data/competition.json?v=${analysisVersion}`
            : null
    );
    const {
        analysis: explorerCompetition,
        loading: explorerCompetitionLoading,
        error: explorerCompetitionError
    } = useAnalysisData(
        (isHistoryRoute || isPlayersRoute) && selectedSeasonEntry
            ? `data/${selectedSeasonEntry.competitionFile}?v=${analysisVersion}`
            : null
    );
    const {
        index: historicalDirectoryIndex,
        seasons: historicalSeasonDatasets,
        loading: historicalDirectoryLoading,
        error: historicalDirectoryError
    } = useSeasonDirectoryData(isHistoryRoute || isPlayersRoute, analysisVersion);

    const [selectedTeamKey, setSelectedTeamKey] = useState(() => initialHashState.teamKey ?? "");
    const [selectedClubKey, setSelectedClubKey] = useState(() => initialHashState.clubKey ?? "");
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
    const [selectedHistoryTeamKey, setSelectedHistoryTeamKey] = useState("");
    const [playerDirectoryQuery, setPlayerDirectoryQuery] = useState("");
    const [selectedHistoricalPlayerKey, setSelectedHistoricalPlayerKey] = useState("");
    const [clubQuery, setClubQuery] = useState("");
    const pendingScrollRestoreFrame = useRef(0);
    const teamTabsRef = useRef(null);

    useEffect(() => {
        if (!window.location.hash) {
            navigateToHash(buildDashboardRoute());
        }

        const handleHashChange = () => {
            const nextState = parseHash(window.location.hash);
            setRoute(nextState.route);
            setSelectedSeasonLabel(nextState.seasonLabel ?? "");
            setSelectedTeamKey(nextState.teamKey ?? "");
            setSelectedClubKey(nextState.clubKey ?? "");
            setSelectedPhase("");
            setSelectedPlayer("");
            setSelectedMatch("");
            setOpenMatches({});
            setSelectedCompetitionTab(nextState.competitionTab || "standings");
            setSelectedStandingsCategory(nextState.competitionCategory || "all");
            setSelectedStandingsLevel(nextState.competitionLevel || "all");
            setSelectedStandingsPhase(nextState.competitionPhase || "all");
            setSelectedResultsCategory(nextState.competitionCategory || "all");
            setSelectedResultsLevel(nextState.competitionLevel || "all");
            setSelectedResultsPhase(nextState.competitionPhase || "all");
            setSelectedLeadersCategory(nextState.competitionCategory || "all");
            setSelectedLeadersLevel(nextState.competitionLevel || "all");
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

        navigateToHash(buildDashboardRoute());
    }, [route, syncUiEnabled]);

    const analysisIndex = (isHistoryRoute || isPlayersRoute)
        ? explorerAnalysisIndex
        : currentAnalysisIndex;
    const analysisIndexLoading = (isHistoryRoute || isPlayersRoute)
        ? explorerAnalysisIndexLoading
        : currentAnalysisIndexLoading;
    const analysisIndexError = (isHistoryRoute || isPlayersRoute)
        ? explorerAnalysisIndexError
        : currentAnalysisIndexError;
    const competition = (isHistoryRoute || isPlayersRoute)
        ? explorerCompetition
        : currentCompetition;
    const competitionLoading = (isHistoryRoute || isPlayersRoute)
        ? explorerCompetitionLoading
        : currentCompetitionLoading;
    const competitionError = (isHistoryRoute || isPlayersRoute)
        ? explorerCompetitionError
        : currentCompetitionError;
    const currentSeasonLabel = currentAnalysisIndex?.seasonLabel
        || currentCompetition?.seasonLabel
        || defaultSeasonLabel;
    const activeBrowseSeasonLabel = (isHistoryRoute || isPlayersRoute)
        ? effectiveExplorerSeasonLabel
        : currentSeasonLabel;
    const historicalTeamEntities = buildHistoricalTeamEntities(historicalSeasonDatasets);
    const historicalTeamOptions = historicalTeamEntities.map((entity) => ({
        value: entity.key,
        label: entity.label,
        meta: entity.meta,
        searchText: entity.searchText
    }));
    const selectedHistoricalTeam = historicalTeamEntities.find((entity) => entity.key === selectedHistoryTeamKey) ?? null;
    const historicalPlayerEntities = buildHistoricalPlayerEntities(historicalSeasonDatasets);
    const historicalPlayerOptions = historicalPlayerEntities.map((entity) => ({
        value: entity.key,
        label: entity.label,
        meta: entity.meta,
        searchText: entity.searchText
    }));
    const selectedHistoricalPlayer = historicalPlayerEntities.find((entity) => entity.key === selectedHistoricalPlayerKey) ?? null;
    const teams = analysisIndex?.teams ?? [];
    const competitionTeams = competition?.teams ?? [];
    const teamDirectoryByKey = [...teams, ...competitionTeams].reduce((map, team) => {
        if (!team?.teamKey) {
            return map;
        }

        const current = map.get(team.teamKey) ?? {};
        map.set(team.teamKey, {
            teamName: team.teamName ?? current.teamName ?? "",
            teamIdExtern: Number(team.teamIdExtern ?? current.teamIdExtern ?? 0)
        });
        return map;
    }, new Map());
    const latestTeamContexts = buildLatestTeamContextByKey(teams);
    const dashboardCategoryOptions = buildCategoryOptions(latestTeamContexts);
    const latestTeamContextRows = [...latestTeamContexts.values()];
    const sortedTeams = [...teams].sort((a, b) => a.teamName.localeCompare(b.teamName, "es"));
    const globalDefaultTeam = teams.reduce((best, team) => {
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
    }, null);
    const selectedTeamContext = latestTeamContexts.get(selectedTeamKey)
        ?? latestTeamContexts.get(globalDefaultTeam?.teamKey ?? "")
        ?? null;
    const fallbackTeamCategory = String(selectedTeamContext?.categoryName ?? "").trim();
    const effectiveTeamCategory = dashboardCategoryOptions.some((option) => option.value === selectedTeamCategory)
        ? selectedTeamCategory
        : (dashboardCategoryOptions.some((option) => option.value === fallbackTeamCategory)
            ? fallbackTeamCategory
            : (dashboardCategoryOptions[0]?.value ?? "all"));
    const dashboardLevelOptions = buildLevelOptionsFromRows(
        filterRowsByCategory(latestTeamContextRows, effectiveTeamCategory)
    );
    const effectiveTeamLevel = dashboardLevelOptions.some((option) => option.value === selectedTeamLevel)
        ? selectedTeamLevel
        : "all";
    const effectiveTeamLevelLabel = effectiveTeamLevel === "all"
        ? ""
        : (dashboardLevelOptions.find((option) => option.value === effectiveTeamLevel)?.label ?? effectiveTeamLevel);
    const dashboardTeams = sortedTeams.filter((team) => {
        const teamContext = latestTeamContexts.get(team.teamKey);

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
    });
    const dashboardDefaultTeam = dashboardTeams.reduce((best, team) => {
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
    }, null);
    const selectedTeamKeyFromAll = teams.some((team) => team.teamKey === selectedTeamKey)
        ? selectedTeamKey
        : (globalDefaultTeam?.teamKey ?? "");
    const effectiveTeamKey = isTeamRoute
        ? (dashboardTeams.some((team) => team.teamKey === selectedTeamKey)
            ? selectedTeamKey
            : (dashboardDefaultTeam?.teamKey ?? selectedTeamKeyFromAll))
        : selectedTeamKeyFromAll;
    const selectedTeamSummary = teams.find((team) => team.teamKey === effectiveTeamKey) ?? globalDefaultTeam ?? null;
    const competitionPlayerLeaders = competition?.playerLeaders ?? [];
    const competitionMatches = competition?.matches ?? [];
    const competitionMatchesWithBranding = competitionMatches.map((match) => ({
        ...match,
        homeTeamIdExtern: Number(teamDirectoryByKey.get(match.homeTeamKey)?.teamIdExtern ?? 0),
        awayTeamIdExtern: Number(teamDirectoryByKey.get(match.awayTeamKey)?.teamIdExtern ?? 0)
    }));
    const currentClubEntities = buildCurrentClubEntities(teams, {
        matches: competitionMatches,
        playerLeaders: competitionPlayerLeaders
    });
    const clubOptions = currentClubEntities.map((club) => ({
        value: club.key,
        label: club.label,
        meta: club.meta,
        searchText: `${club.searchText} ${club.meta}`
    }));
    const selectedTeamBranding = selectedTeamSummary
        ? getClubBrandingForTeam(selectedTeamSummary.teamIdExtern, selectedTeamSummary.teamName)
        : null;
    const selectedTeamClubKey = selectedTeamBranding?.clubKey ?? "";
    const fallbackClubKey = currentClubEntities.some((club) => club.key === selectedTeamClubKey)
        ? selectedTeamClubKey
        : (currentClubEntities[0]?.key ?? "");
    const effectiveClubKey = currentClubEntities.some((club) => club.key === selectedClubKey)
        ? selectedClubKey
        : fallbackClubKey;
    const selectedClub = currentClubEntities.find((club) => club.key === effectiveClubKey) ?? null;
    const competitionCategoryOptions = buildCategoryOptionsFromRows(competition?.phases ?? []);
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
    const teamPlayers = Array.isArray(selectedTeamPlayers) ? selectedTeamPlayers : [];
    const teamMatchSummaries = Array.isArray(selectedTeamMatchSummaries) ? selectedTeamMatchSummaries : [];
    const teamPhaseOptions = buildTeamPhaseOptions(selectedTeamSummary?.phases ?? []);
    const effectiveSelectedPhase = !selectedPhase || teamPhaseOptions.some((phase) => phase.value === selectedPhase)
        ? (selectedPhase || "all")
        : "all";
    const selectedPhaseContext = effectiveSelectedPhase === "all"
        ? null
        : (filterRowsByPhaseOption(selectedTeamSummary?.phases ?? [], effectiveSelectedPhase)[0] ?? null);
    const selectedPhaseValue = selectedPhaseContext?.phaseNumber ?? null;
    const matchSummaries = filterRowsByPhaseOption(teamMatchSummaries, effectiveSelectedPhase);
    const players = filterRowsByPhaseOption(teamPlayers, effectiveSelectedPhase);
    const playersList = getPlayersList(players);
    const effectiveSelectedPlayer = selectedPlayer &&
    playersList.some((player) => player.value === selectedPlayer)
        ? selectedPlayer
        : "";
    const chartData = getChartData(players, effectiveSelectedPlayer, selectedPhaseValue);
    const selectedPlayerSummary = getSelectedPlayerSummary(players, effectiveSelectedPlayer);
    const sortedPlayers = sortPlayers(players);
    const sortedMatches = sortMatches(
        groupPlayersByMatch(sortedPlayers, matchSummaries)
    );
    const visibleMatches = getVisibleMatches(sortedMatches, selectedMatch);
    const playersArray = buildPlayersArray(players);
    const phaseSummaries = buildPhaseSummaries(teamMatchSummaries, teamPlayers);
    const phaseComparison = buildPhaseComparison(phaseSummaries);
    const teamLeadersByAvgValuation = getTopTeamPlayers(playersArray, "avgValuation", 8);
    const teamLeadersByPoints = getTopTeamPlayers(playersArray, "points", 8);
    const rankingMinGamesValue = Number(rankingMinGames || 1);
    const effectiveLeadersCategory = competitionCategoryOptions.some((option) => option.value === selectedLeadersCategory)
        ? selectedLeadersCategory
        : (competitionCategoryOptions[0]?.value ?? "all");
    const leadersLevelOptions = buildLevelOptionsFromRows(
        filterRowsByCategory(competition?.phases ?? [], effectiveLeadersCategory)
    );
    const effectiveLeadersLevel = leadersLevelOptions.some((option) => option.value === selectedLeadersLevel)
        ? selectedLeadersLevel
        : "all";
    const filteredCompetitionPlayers = competitionPlayerLeaders
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
        });
    const globalLeadersByAvgValuation = getTopGlobalPlayers(filteredCompetitionPlayers, "avgValuation", 8);
    const globalLeadersByPoints = getTopGlobalPlayers(filteredCompetitionPlayers, "points", 8);
    const effectiveStandingsCategory = competitionCategoryOptions.some((option) => option.value === selectedStandingsCategory)
        ? selectedStandingsCategory
        : (competitionCategoryOptions[0]?.value ?? "all");
    const standingsLevelOptions = buildLevelOptionsFromRows(
        filterRowsByCategory(competition?.phases ?? [], effectiveStandingsCategory)
    );
    const effectiveStandingsLevel = standingsLevelOptions.some((option) => option.value === selectedStandingsLevel)
        ? selectedStandingsLevel
        : "all";
    const standingsPhaseOptions = buildCompetitionPhaseOptions(
        filterRowsByCategory(
            filterRowsByLevel(competition?.phases ?? [], effectiveStandingsLevel),
            effectiveStandingsCategory
        )
    );
    const effectiveCompetitionPhase = selectedStandingsPhase === "all" ||
    standingsPhaseOptions.some((phase) => phase.value === selectedStandingsPhase)
        ? selectedStandingsPhase
        : "all";
    const competitionMatchesForStandings = filterRowsByCategory(
        filterRowsByLevel(
            filterCompetitionMatchesByPhaseOption(competitionMatches, effectiveCompetitionPhase),
            effectiveStandingsLevel
        ),
        effectiveStandingsCategory
    );
    const teamTotalValuationByKey = competitionPlayerLeaders.reduce((map, player) => {
        const key = player.teamKey;
        map.set(key, (map.get(key) ?? 0) + Number(player.valuation ?? 0));
        return map;
    }, new Map());
    const competitionStandingsRows = buildStandings(competitionMatchesForStandings, null)
        .map((row) => {
            const latestContext = latestTeamContexts.get(row.teamKey);
            const teamDirectoryEntry = teamDirectoryByKey.get(row.teamKey);
            const levelKey = String(latestContext?.levelCode ?? "").trim() || String(latestContext?.levelName ?? "").trim();
            const totalValuation = teamTotalValuationByKey.get(row.teamKey) ?? 0;

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
        }));
    const effectiveResultsCategory = competitionCategoryOptions.some((option) => option.value === selectedResultsCategory)
        ? selectedResultsCategory
        : (competitionCategoryOptions[0]?.value ?? "all");
    const resultsLevelOptions = buildLevelOptionsFromRows(
        filterRowsByCategory(competition?.phases ?? [], effectiveResultsCategory)
    );
    const effectiveResultsLevel = resultsLevelOptions.some((option) => option.value === selectedResultsLevel)
        ? selectedResultsLevel
        : "all";
    const resultsPhaseOptions = buildCompetitionPhaseOptions(
        filterRowsByCategory(
            filterRowsByLevel(competition?.phases ?? [], effectiveResultsLevel),
            effectiveResultsCategory
        )
    );
    const effectiveResultsPhase = selectedResultsPhase === "all" ||
    resultsPhaseOptions.some((phase) => phase.value === selectedResultsPhase)
        ? selectedResultsPhase
        : "all";
    const activeCompetitionTab = COMPETITION_TABS.find((tab) => tab.id === selectedCompetitionTab) ?? COMPETITION_TABS[0];
    const activeTeamTab = TEAM_TABS.find((tab) => tab.id === selectedTeamTab) ?? TEAM_TABS[0];
    const selectedTeamLatestContext = latestTeamContexts.get(effectiveTeamKey) ?? null;
    const selectedTeamScopePhases = selectedPhaseContext
        ? filterRowsByPhaseOption(selectedTeamSummary?.phases ?? [], effectiveSelectedPhase)
        : (selectedTeamSummary?.phases ?? []);
    const selectedTeamCategoryName = String(
        selectedPhaseContext?.categoryName
        ?? selectedTeamLatestContext?.categoryName
        ?? ""
    ).trim();
    const teamStandingMatches = filterMatchesByPhaseScopes(
        competitionMatches,
        selectedTeamScopePhases,
        selectedTeamCategoryName
    );
    const teamStandingsRows = buildStandings(teamStandingMatches, null);
    const selectedTeamStanding = teamStandingsRows.find((row) => row.teamKey === effectiveTeamKey) ?? null;
    const teamRecord = buildTeamRecord(matchSummaries);
    const bestWinStreak = getLongestWinStreak(matchSummaries);
    const topScorer = getTopScorer(playersArray);
    const mvp = getMvp(playersArray);
    const teamAvg = getTeamAverage(players);
    const seasonLabel = selectedPhaseContext === null
        ? "Temporada completa"
        : buildCompetitionPhaseLabel(selectedPhaseContext);
    const standingLabel = selectedPhaseContext === null
        ? "Clasificación acumulada"
        : `Clasificación de ${buildCompetitionPhaseLabel(selectedPhaseContext)}`;
    const teamHeroSummary = `${selectedTeamSummary?.matchesPlayed ?? 0} partidos en total · ${selectedTeamSummary?.playersCount ?? 0} jugadoras registradas`;

    const handleToggleMatch = (matchWebId) => {
        setOpenMatches((prev) => ({
            ...prev,
            [matchWebId]: !prev[matchWebId]
        }));
    };

    const handleTeamNavigate = (teamKey, targetRoute = (isHistoryRoute || isPlayersRoute ? "history" : "dashboard")) => {
        if (!teamKey) {
            return;
        }

        const teamContext = latestTeamContexts.get(teamKey);
        const categoryName = String(teamContext?.categoryName ?? "").trim();
        const levelKey = String(teamContext?.levelCode ?? "").trim() || String(teamContext?.levelName ?? "").trim();
        setSelectedTeamKey(teamKey);
        setSelectedTeamCategory(categoryName || selectedTeamCategory);
        setSelectedTeamLevel(levelKey || "all");
        setSelectedPhase("");
        setSelectedPlayer("");
        setSelectedMatch("");
        setOpenMatches({});
        navigateToHash(
            targetRoute === "history"
                ? buildHistoryRoute(teamKey, effectiveExplorerSeasonLabel || currentSeasonLabel)
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

    const handleSeasonChange = (event) => {
        const nextSeasonLabel = event.target.value;
        if (!nextSeasonLabel || nextSeasonLabel === effectiveExplorerSeasonLabel) {
            return;
        }

        setSelectedSeasonLabel(nextSeasonLabel);
        setSelectedTeamKey("");
        setSelectedPhase("");
        setSelectedPlayer("");
        setSelectedMatch("");
        setOpenMatches({});
        setSelectedStandingsPhase("all");
        setSelectedStandingsLevel("all");
        setSelectedStandingsCategory("all");
        setSelectedResultsPhase("all");
        setSelectedResultsLevel("all");
        setSelectedResultsCategory("all");
        setSelectedLeadersLevel("all");
        setSelectedLeadersCategory("all");

        if (route === "players") {
            navigateToHash(buildPlayersRoute(nextSeasonLabel));
            return;
        }

        navigateToHash(buildHistoryRoute("", nextSeasonLabel));
    };

    const handlePlayerChange = (value) => {
        setSelectedPlayer(value);
    };

    const handleHistoryTeamQueryChange = (value) => {
        setHistoryTeamQuery(value);

        if (!String(value ?? "").trim()) {
            setSelectedHistoryTeamKey("");
        }
    };

    const handleHistoryTeamSelect = (option) => {
        setSelectedHistoryTeamKey(option.value);
        setHistoryTeamQuery(option.label);
    };

    const handleHistoricalPlayerQueryChange = (value) => {
        setPlayerDirectoryQuery(value);

        if (!String(value ?? "").trim()) {
            setSelectedHistoricalPlayerKey("");
        }
    };

    const handleHistoricalPlayerSelect = (option) => {
        setSelectedHistoricalPlayerKey(option.value);
        setPlayerDirectoryQuery(option.label);
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

    useEffect(() => {
        if (!isTeamRoute || !effectiveTeamKey || effectiveTeamKey === selectedTeamKey) {
            return;
        }

        navigateToHash(
            isHistoryRoute
                ? buildHistoryRoute(effectiveTeamKey, effectiveExplorerSeasonLabel || currentSeasonLabel)
                : buildTeamRoute(effectiveTeamKey)
        );
    }, [currentSeasonLabel, effectiveExplorerSeasonLabel, effectiveTeamKey, isHistoryRoute, isTeamRoute, selectedTeamKey]);

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
        if (isHistoryRoute && seasonsIndexLoading && !selectedSeasonEntry) {
            return <div style={appStyles.emptyState}>Cargando temporadas...</div>;
        }

        if (analysisIndexLoading) {
            return <div style={appStyles.emptyState}>Cargando análisis...</div>;
        }

        if (analysisIndexError || (isHistoryRoute && seasonsIndexError && !selectedSeasonEntry)) {
            return <div style={appStyles.emptyState}>{analysisIndexError || seasonsIndexError}</div>;
        }

        if (!selectedTeamSummary) {
            return <div style={appStyles.emptyState}>No hay equipos disponibles en el análisis.</div>;
        }

        return (
            <>
                {isHistoryRoute ? (
                    <section style={appStyles.syncIntro}>
                        <div style={appStyles.syncEyebrow}>Archivo</div>
                        <h2 style={appStyles.syncTitle}>Histórico de equipos por temporada</h2>
                        <p style={appStyles.syncBody}>
                            Esta vista sirve para entrar en cualquier temporada publicada y leer el recorrido completo
                            de un equipo sin contaminar el panel actual.
                        </p>
                    </section>
                ) : null}

                <section style={appStyles.teamSelectorSection}>
                    <div style={appStyles.teamSelectorHeader}>
                        <div style={appStyles.syncEyebrow}>{isHistoryRoute ? "Búsqueda" : "Selector global"}</div>
                        <h2 style={appStyles.teamSelectorTitle}>
                            {isHistoryRoute
                                ? "Busca un equipo dentro del archivo"
                                : "Elige el equipo que quieres analizar"}
                        </h2>
                        <p style={appStyles.teamSelectorBody}>
                            {isHistoryRoute
                                ? "La temporada se elige arriba. Categoría y nivel acotan el archivo y, una vez dentro del equipo, la fase te deja leer cada tramo con claridad."
                                : "Categoría y nivel acotan el listado de equipos. Una vez elegido el equipo, la fase filtra cómo lees su temporada."}
                        </p>
                    </div>

                    <div style={appStyles.filterDeck}>
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
                                    <div style={appStyles.heroKicker}>{isHistoryRoute ? "Archivo del equipo" : "Vista del equipo"}</div>
                                    <h2 style={appStyles.heroTitle}>{selectedTeamSummary.teamName}</h2>
                                    <p style={appStyles.heroSummary}>{teamHeroSummary}</p>
                                </div>
                            </div>
                        </div>

                        <div style={appStyles.heroMetaRow}>
                            {activeBrowseSeasonLabel ? (
                                <span style={appStyles.metaChip}>{activeBrowseSeasonLabel}</span>
                            ) : null}
                            {selectedTeamLatestContext?.categoryName ? (
                                <span style={appStyles.metaChip}>{selectedTeamLatestContext.categoryName}</span>
                            ) : null}
                            {selectedTeamLatestContext?.levelName ? (
                                <span style={appStyles.metaChip}>{selectedTeamLatestContext.levelName}</span>
                            ) : null}
                            <span style={appStyles.metaChip}>{selectedTeamSummary.matchesPlayed ?? 0} partidos totales</span>
                        </div>

                        {!isHistoryRoute ? (
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
                        ) : null}
                    </div>
                </section>

                {selectedTeamMatchesLoading || selectedTeamPlayersLoading ? (
                    <SectionFallback message="Cargando detalle del equipo..." />
                ) : null}

                {!selectedTeamMatchesLoading && !selectedTeamPlayersLoading && (selectedTeamMatchesError || selectedTeamPlayersError) ? (
                    <div style={appStyles.emptyState}>{selectedTeamMatchesError || selectedTeamPlayersError}</div>
                ) : null}

                {!selectedTeamMatchesLoading && !selectedTeamPlayersLoading && !selectedTeamMatchesError && !selectedTeamPlayersError && competitionError ? (
                    <div style={appStyles.emptyState}>
                        {competitionError}
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
                    deletingPhaseId={deletingSavedPhaseId}
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

            {competitionLoading ? (
                <SectionFallback message="Cargando datos de competición..." />
            ) : null}

            {!competitionLoading && competitionError ? (
                <div style={appStyles.emptyState}>{competitionError}</div>
            ) : null}

            {!competitionLoading && !competitionError ? (
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
                        <Suspense fallback={<SectionFallback message="Cargando resultados de la competición..." />}>
                            <CompetitionResultsSection
                                matches={competitionMatchesWithBranding}
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
                            />
                        </Suspense>
                    ) : null}

                    {activeCompetitionTab.id === "leaders" ? (
                        <Suspense fallback={<SectionFallback message="Cargando líderes globales..." />}>
                            <GlobalLeadersSection
                                totalPlayers={competitionPlayerLeaders.length}
                                totalTeams={competition?.totalTeams ?? teams.length}
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
                    ) : null}
                </>
            ) : null}
        </div>
    );

    const renderClubPage = () => {
        if (analysisIndexLoading || competitionLoading) {
            return <div style={appStyles.emptyState}>Cargando clubes...</div>;
        }

        if (analysisIndexError || competitionError) {
            return <div style={appStyles.emptyState}>{analysisIndexError || competitionError}</div>;
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
        if (historicalDirectoryLoading) {
            return <div style={appStyles.emptyState}>Cargando archivo histórico...</div>;
        }

        if (historicalDirectoryError) {
            return <div style={appStyles.emptyState}>{historicalDirectoryError}</div>;
        }

        const totalPublishedSeasons = historicalDirectoryIndex?.seasons?.length ?? historicalSeasonDatasets.length;

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
        if (historicalDirectoryLoading) {
            return <div style={appStyles.emptyState}>Cargando archivo de jugadoras...</div>;
        }

        if (historicalDirectoryError) {
            return <div style={appStyles.emptyState}>{historicalDirectoryError}</div>;
        }

        const totalPublishedSeasons = historicalDirectoryIndex?.seasons?.length ?? historicalSeasonDatasets.length;
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

    const pageTitle = route === "sync"
        ? "Importar datos"
        : route === "competition"
            ? "Competición"
            : route === "club"
                ? "Clubes"
            : route === "history"
                ? "Archivo de equipos"
                : route === "players"
                    ? "Jugadoras"
                    : "Cuaderno de juego";
    const pageNote = route === "sync"
        ? "Carga nuevas fases desde la fuente oficial sin pasar por la terminal."
        : route === "competition"
            ? "Clasificación, resultados y líderes individuales, separados del panel de cada equipo."
            : route === "club"
                ? "Vista transversal del club para reunir todos sus equipos por categoria y nivel actual."
            : route === "history"
                ? "Buscador histórico de equipos con el rendimiento separado por temporada."
                : route === "players"
                    ? "Buscador histórico de jugadoras con acumulado global y detalle temporada a temporada."
                    : "Sigue la temporada actual por equipo y por fase, con el detalle de cada partido y una lectura clara de su evolución.";
    const pageSeasonNote = route === "dashboard" || route === "competition" || route === "club"
        ? currentSeasonLabel
        : "";
    const shouldShowSeasonSelector = false;

    return (
        <div style={appStyles.page}>
            <div style={appStyles.glowPrimary}/>
            <div style={appStyles.glowSecondary}/>

            <div style={appStyles.container}>
                <div style={appStyles.topBar}>
                    <div style={appStyles.brand}>
                        <p style={appStyles.eyebrow}>BarnaStats</p>
                        <h1 style={appStyles.brandTitle}>{pageTitle}</h1>
                        <p style={appStyles.brandNote}>
                            {pageNote}
                            {pageSeasonNote
                                ? `${route === "history" || route === "players"
                                    ? " Temporada consultada"
                                    : " Temporada actual"}: ${pageSeasonNote}.`
                                : ""}
                        </p>
                    </div>

                    <div style={appStyles.topBarActions}>
                        {shouldShowSeasonSelector ? (
                            <PrettySelect
                                label="Temporada"
                                value={effectiveExplorerSeasonLabel}
                                onChange={handleSeasonChange}
                                ariaLabel="Selecciona temporada"
                                minWidth="190px"
                            >
                                {seasonOptions.map((season) => (
                                    <option key={season.seasonLabel} value={season.seasonLabel}>
                                        {season.seasonLabel}
                                    </option>
                                ))}
                            </PrettySelect>
                        ) : null}

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
                            : renderTeamPage()}
            </div>
        </div>
    );
}

export default App;
