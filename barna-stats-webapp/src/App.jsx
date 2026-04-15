import {lazy, Suspense, useEffect, useRef, useState} from "react";
import PrettySelect from "./components/PrettySelect.jsx";
import {useAnalysisData} from "./hooks/useAnalysisData.js";
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

const GlobalLeadersSection = lazy(() => import("./components/GlobalLeadersSection.jsx"));
const PhaseComparisonSection = lazy(() => import("./components/PhaseComparisonSection.jsx"));
const StandingsSection = lazy(() => import("./components/StandingsSection.jsx"));
const CompetitionResultsSection = lazy(() => import("./components/CompetitionResultsSection.jsx"));
const TeamLeadersSection = lazy(() => import("./components/TeamLeadersSection.jsx"));
const TeamSnapshotSection = lazy(() => import("./components/TeamSnapshotSection.jsx"));
const PlayerEvolutionSection = lazy(() => import("./components/PlayerEvolutionSection.jsx"));
const MatchListSection = lazy(() => import("./components/MatchListSection.jsx"));
const SyncPanel = lazy(() => import("./components/SyncPanel.jsx"));

const DASHBOARD_ROUTE = "#/";
const SYNC_ROUTE = "#/sync";
const COMPETITION_ROUTE = "#/competition";
const TEAM_ROUTE_PREFIX = "#/team/";
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
        justifyContent: "space-between",
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
        backdropFilter: "blur(10px)",
        marginLeft: "auto"
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

function parseHash(hash) {
    if (hash === SYNC_ROUTE) {
        return {route: "sync", teamKey: null};
    }

    if (hash === COMPETITION_ROUTE || hash === "#/rankings" || hash === "#/global") {
        return {route: "competition", teamKey: null};
    }

    if (hash.startsWith(TEAM_ROUTE_PREFIX)) {
        const encodedTeamKey = hash.slice(TEAM_ROUTE_PREFIX.length);

        return {
            route: "dashboard",
            teamKey: encodedTeamKey ? decodeURIComponent(encodedTeamKey) : null
        };
    }

    return {route: "dashboard", teamKey: null};
}

function navigateToHash(hash) {
    window.location.assign(hash);
}

function buildPhaseScopeKey(row) {
    const sourcePhaseId = Number(row?.sourcePhaseId ?? 0);
    if (sourcePhaseId > 0) {
        return `source:${sourcePhaseId}`;
    }

    const phaseNumber = Number(row?.phaseNumber ?? 0);
    const categoryName = String(row?.categoryName ?? "").trim();
    const levelKey = String(row?.levelCode ?? "").trim() || String(row?.levelName ?? "").trim();
    const groupCode = String(row?.groupCode ?? "").trim();
    const phaseName = String(row?.phaseName ?? "").trim();

    return `phase:${phaseNumber}|${categoryName}|${levelKey}|${groupCode}|${phaseName}`;
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
    const [analysisVersion, setAnalysisVersion] = useState(() => Date.now());
    const [route, setRoute] = useState(() => parseHash(window.location.hash).route);
    const {
        analysis: analysisIndex,
        loading: analysisIndexLoading,
        error: analysisIndexError
    } = useAnalysisData(`data/analysis.json?v=${analysisVersion}`);
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
        startSyncAllSavedSources
    } = useSyncJob(syncUiEnabled, () => {
        setAnalysisVersion(Date.now());
        void refreshSavedResultsSources();
    });

    const initialHashState = parseHash(window.location.hash);
    const [selectedTeamKey, setSelectedTeamKey] = useState(() => initialHashState.teamKey ?? "");
    const [selectedTeamLevel, setSelectedTeamLevel] = useState("all");
    const [selectedTeamCategory, setSelectedTeamCategory] = useState("all");
    const [selectedPhase, setSelectedPhase] = useState("");
    const [selectedPlayer, setSelectedPlayer] = useState("");
    const [selectedMatch, setSelectedMatch] = useState("");
    const [openMatches, setOpenMatches] = useState({});
    const [selectedStandingsPhase, setSelectedStandingsPhase] = useState("all");
    const [selectedStandingsLevel, setSelectedStandingsLevel] = useState("all");
    const [selectedStandingsCategory, setSelectedStandingsCategory] = useState("all");
    const [selectedResultsPhase, setSelectedResultsPhase] = useState("all");
    const [selectedResultsLevel, setSelectedResultsLevel] = useState("all");
    const [selectedResultsCategory, setSelectedResultsCategory] = useState("all");
    const [selectedLeadersLevel, setSelectedLeadersLevel] = useState("all");
    const [selectedLeadersCategory, setSelectedLeadersCategory] = useState("all");
    const [rankingMinGames, setRankingMinGames] = useState("3");
    const [selectedCompetitionTab, setSelectedCompetitionTab] = useState("standings");
    const [selectedTeamTab, setSelectedTeamTab] = useState("snapshot");
    const pendingScrollRestoreFrame = useRef(0);
    const teamTabsRef = useRef(null);

    useEffect(() => {
        if (!window.location.hash) {
            navigateToHash(DASHBOARD_ROUTE);
        }

        const handleHashChange = () => {
            const nextState = parseHash(window.location.hash);
            setRoute(nextState.route);

            if (nextState.teamKey) {
                setSelectedTeamKey(nextState.teamKey);
                setSelectedPhase("");
                setSelectedPlayer("");
                setSelectedMatch("");
                setOpenMatches({});
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

        navigateToHash(DASHBOARD_ROUTE);
    }, [route, syncUiEnabled]);

    const teams = analysisIndex?.teams ?? [];
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
    const effectiveTeamKey = route === "dashboard"
        ? (dashboardTeams.some((team) => team.teamKey === selectedTeamKey)
            ? selectedTeamKey
            : (dashboardDefaultTeam?.teamKey ?? selectedTeamKeyFromAll))
        : selectedTeamKeyFromAll;
    const selectedTeamSummary = teams.find((team) => team.teamKey === effectiveTeamKey) ?? globalDefaultTeam ?? null;
    const shouldLoadCompetition = route !== "sync";
    const shouldLoadTeamMatches = route === "dashboard" && !!selectedTeamSummary?.matchesFile;
    const shouldLoadTeamPlayers = route === "dashboard" && !!selectedTeamSummary?.playersFile;
    const {
        analysis: competition,
        loading: competitionLoading,
        error: competitionError
    } = useAnalysisData(
        shouldLoadCompetition
            ? `data/competition.json?v=${analysisVersion}`
            : null
    );
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
    const competitionCategoryOptions = buildCategoryOptionsFromRows(competition?.phases ?? []);
    const effectiveSelectedPhase = !selectedPhase || teamPhaseOptions.some((phase) => phase.value === selectedPhase)
        ? (selectedPhase || "all")
        : "all";
    const selectedPhaseContext = effectiveSelectedPhase === "all"
        ? null
        : (filterRowsByPhaseOption(selectedTeamSummary?.phases ?? [], effectiveSelectedPhase)[0] ?? null);
    const selectedPhaseValue = selectedPhaseContext?.phaseNumber ?? null;
    const matchSummaries = filterRowsByPhaseOption(teamMatchSummaries, effectiveSelectedPhase);
    const players = filterRowsByPhaseOption(teamPlayers, effectiveSelectedPhase);
    const effectiveSelectedPlayer = selectedPlayer &&
    players.some((player) => player.playerName === selectedPlayer)
        ? selectedPlayer
        : "";

    const playersList = getPlayersList(players);
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
    const competitionPlayerLeaders = competition?.playerLeaders ?? [];
    const competitionMatches = competition?.matches ?? [];
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
            const levelKey = String(latestContext?.levelCode ?? "").trim() || String(latestContext?.levelName ?? "").trim();
            const totalValuation = teamTotalValuationByKey.get(row.teamKey) ?? 0;

            return {
                ...row,
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

    const handleTeamNavigate = (teamKey) => {
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
        navigateToHash(buildTeamRoute(teamKey));
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

    const handlePlayerChange = (value) => {
        setSelectedPlayer(value);
    };

    const handlePlayerNavigate = (playerName) => {
        if (!playerName) {
            return;
        }

        setSelectedPlayer(playerName);
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
        if (route !== "dashboard" || !effectiveTeamKey || effectiveTeamKey === selectedTeamKey) {
            return;
        }

        navigateToHash(buildTeamRoute(effectiveTeamKey));
    }, [effectiveTeamKey, route, selectedTeamKey]);

    useEffect(() => () => {
        if (pendingScrollRestoreFrame.current) {
            window.cancelAnimationFrame(pendingScrollRestoreFrame.current);
        }
    }, []);

    const renderDashboard = () => {
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
                            Categoría y nivel acotan el listado de equipos. Una vez elegido el equipo, la fase filtra
                            cómo lees su temporada.
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
                            <div style={appStyles.heroKicker}>Vista del equipo</div>
                            <h2 style={appStyles.heroTitle}>{selectedTeamSummary.teamName}</h2>
                            <p style={appStyles.heroSummary}>{teamHeroSummary}</p>
                        </div>

                        <div style={appStyles.heroMetaRow}>
                            {selectedTeamLatestContext?.categoryName ? (
                                <span style={appStyles.metaChip}>{selectedTeamLatestContext.categoryName}</span>
                            ) : null}
                            {selectedTeamLatestContext?.levelName ? (
                                <span style={appStyles.metaChip}>{selectedTeamLatestContext.levelName}</span>
                            ) : null}
                            <span style={appStyles.metaChip}>{selectedTeamSummary.matchesPlayed ?? 0} partidos totales</span>
                        </div>

                        <div style={appStyles.heroActions}>
                            <a href={COMPETITION_ROUTE} style={appStyles.secondaryLink}>
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
            <a href={selectedTeamSummary ? buildTeamRoute(selectedTeamSummary.teamKey) : DASHBOARD_ROUTE} style={appStyles.pageBackLink}>
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
                                matches={competitionMatches}
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

    const pageTitle = route === "sync"
        ? "Importar datos"
        : route === "competition"
            ? "Competición"
            : "Cuaderno de juego";
    const pageNote = route === "sync"
        ? "Carga nuevas fases desde la fuente oficial sin pasar por la terminal."
        : route === "competition"
            ? "Clasificación, resultados y líderes individuales, separados del panel de cada equipo."
            : "Sigue la temporada por equipo y por fase, con el detalle de cada partido y una lectura clara de su evolución.";

    return (
        <div style={appStyles.page}>
            <div style={appStyles.glowPrimary}/>
            <div style={appStyles.glowSecondary}/>

            <div style={appStyles.container}>
                <div style={appStyles.topBar}>
                    <div style={appStyles.brand}>
                        <p style={appStyles.eyebrow}>BarnaStats</p>
                        <h1 style={appStyles.brandTitle}>{pageTitle}</h1>
                        <p style={appStyles.brandNote}>{pageNote}</p>
                    </div>

                    <div style={appStyles.nav}>
                        <a
                            href={selectedTeamSummary ? buildTeamRoute(selectedTeamSummary.teamKey) : DASHBOARD_ROUTE}
                            style={route === "dashboard"
                                ? {...appStyles.navLink, ...appStyles.navLinkActive}
                                : appStyles.navLink}
                        >
                            Panel
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

                {route === "sync" && syncUiEnabled
                    ? renderSyncPage()
                    : route === "competition"
                        ? renderCompetitionPage()
                        : renderDashboard()}
            </div>
        </div>
    );
}

export default App;
