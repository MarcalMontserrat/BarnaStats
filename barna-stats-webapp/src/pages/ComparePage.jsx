import {lazy, Suspense, useMemo, useState} from "react";
import AutocompleteField from "../components/AutocompleteField.jsx";
import {useAnalysisData} from "../hooks/useAnalysisData.js";
import {
    aggregateStandingRows,
    buildCategorySlug,
    buildLatestTeamContextByKey,
    buildTeamRecord,
    getLongestWinStreak
} from "../utils/analysisDerived.js";
import {
    buildPlayersArray,
    getTeamAverage,
    getTopScorer,
    getMvp
} from "../utils/playerStats.js";
import {buildCompareRoute, parseHash} from "../utils/appRoutes.js";
import {navigateToHash} from "../utils/navigation.js";
import {sortFilterOptions} from "../utils/filterOptions.js";
import appStyles from "../styles/appStyles.js";
import SectionFallback from "../components/SectionFallback.jsx";

const TeamCompareSection = lazy(() => import("../components/TeamCompareSection.jsx"));
const PlayerCompareSection = lazy(() => import("../components/PlayerCompareSection.jsx"));

const EMPTY_LIST = [];

const COMPARE_TABS = [
    {id: "teams", label: "Equipos", description: "Compara dos equipos de la temporada actual cara a cara."},
    {id: "players", label: "Jugadoras", description: "Compara dos jugadoras con sus estadísticas históricas acumuladas."}
];

function ComparePage({analysisVersion}) {
    const initialHashState = parseHash(window.location.hash);

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

    const {
        analysis: analysisIndex,
        loading: analysisIndexLoading
    } = useAnalysisData(`data/analysis-light.json?v=${analysisVersion}`);
    const {
        analysis: historicalPlayersDirectory,
        loading: historicalPlayersLoading
    } = useAnalysisData(`data/archive/players-index.json?v=${analysisVersion}`);

    const teams = analysisIndex?.teams ?? EMPTY_LIST;
    const latestTeamContexts = useMemo(() => buildLatestTeamContextByKey(teams), [teams]);
    const sortedTeams = useMemo(
        () => [...teams].sort((a, b) => a.teamName.localeCompare(b.teamName, "es")),
        [teams]
    );

    const compareTeam1Category = String(latestTeamContexts.get(compareTeamKey1)?.categoryName ?? "").trim();
    const compareTeam2Category = String(latestTeamContexts.get(compareTeamKey2)?.categoryName ?? "").trim();
    const {
        analysis: compareTeam1StandingsDataset
    } = useAnalysisData(
        compareTeam1Category
            ? `data/competition-standings/${buildCategorySlug(compareTeam1Category)}.json?v=${analysisVersion}`
            : null
    );
    const {
        analysis: compareTeam2StandingsDataset
    } = useAnalysisData(
        compareTeam2Category && compareTeam2Category !== compareTeam1Category
            ? `data/competition-standings/${buildCategorySlug(compareTeam2Category)}.json?v=${analysisVersion}`
            : null
    );

    const compareTeam1SummaryFromIndex = useMemo(
        () => compareTeamKey1
            ? (teams.find((t) => t.teamKey === compareTeamKey1) ?? null)
            : null,
        [teams, compareTeamKey1]
    );
    const compareTeam2SummaryFromIndex = useMemo(
        () => compareTeamKey2
            ? (teams.find((t) => t.teamKey === compareTeamKey2) ?? null)
            : null,
        [teams, compareTeamKey2]
    );
    const {
        analysis: compareTeam1Matches,
        loading: compareTeam1MatchesLoading,
        error: compareTeam1MatchesError
    } = useAnalysisData(
        compareTeam1SummaryFromIndex?.matchesFile
            ? `data/${compareTeam1SummaryFromIndex.matchesFile}?v=${analysisVersion}`
            : null
    );
    const {
        analysis: compareTeam1Players,
        loading: compareTeam1PlayersLoading,
        error: compareTeam1PlayersError
    } = useAnalysisData(
        compareTeam1SummaryFromIndex?.playersFile
            ? `data/${compareTeam1SummaryFromIndex.playersFile}?v=${analysisVersion}`
            : null
    );
    const {
        analysis: compareTeam2Matches,
        loading: compareTeam2MatchesLoading,
        error: compareTeam2MatchesError
    } = useAnalysisData(
        compareTeam2SummaryFromIndex?.matchesFile
            ? `data/${compareTeam2SummaryFromIndex.matchesFile}?v=${analysisVersion}`
            : null
    );
    const {
        analysis: compareTeam2Players,
        loading: compareTeam2PlayersLoading,
        error: compareTeam2PlayersError
    } = useAnalysisData(
        compareTeam2SummaryFromIndex?.playersFile
            ? `data/${compareTeam2SummaryFromIndex.playersFile}?v=${analysisVersion}`
            : null
    );

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
    const compareTeam1StandingRow = useMemo(() => {
        if (!compareTeamKey1) {
            return null;
        }

        const scopes = (compareTeam1StandingsDataset ?? compareTeam2StandingsDataset)?.scopes ?? EMPTY_LIST;
        const rows = aggregateStandingRows(scopes.flatMap((scope) => scope?.rows ?? []));
        return rows.find((row) => row.teamKey === compareTeamKey1) ?? null;
    }, [compareTeamKey1, compareTeam1StandingsDataset, compareTeam2StandingsDataset]);
    const compareTeam2StandingRow = useMemo(() => {
        if (!compareTeamKey2) {
            return null;
        }

        const dataset = compareTeam2StandingsDataset ?? compareTeam1StandingsDataset;
        const scopes = dataset?.scopes ?? EMPTY_LIST;
        const rows = aggregateStandingRows(scopes.flatMap((scope) => scope?.rows ?? []));
        return rows.find((row) => row.teamKey === compareTeamKey2) ?? null;
    }, [compareTeamKey2, compareTeam1StandingsDataset, compareTeam2StandingsDataset]);

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
}

export default ComparePage;
