import {lazy, Suspense, useMemo, useState} from "react";
import {useAnalysisData} from "../hooks/useAnalysisData.js";
import {
    buildCategoryOptionsFromRows,
    buildCompetitionPhaseOptions,
    buildLatestTeamContextByKey,
    buildLevelOptionsFromRows,
    buildStandingsFromScopes,
    buildTeamRoute,
    filterRowsByCategory,
    filterRowsByLevel
} from "../utils/analysisDerived.js";
import {getTopGlobalPlayers} from "../utils/playerStats.js";
import {parseHash} from "../utils/appRoutes.js";
import {navigateToHash} from "../utils/navigation.js";
import appStyles from "../styles/appStyles.js";
import SectionFallback from "../components/SectionFallback.jsx";

const GlobalLeadersSection = lazy(() => import("../components/GlobalLeadersSection.jsx"));
const StandingsSection = lazy(() => import("../components/StandingsSection.jsx"));
const CompetitionResultsSection = lazy(() => import("../components/CompetitionResultsSection.jsx"));

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

function CompetitionPage({analysisVersion, matchReportOnDemandEnabled}) {
    const initialHashState = parseHash(window.location.hash);
    const initialCompetitionTab = initialHashState.competitionTab || "standings";
    const initialCompetitionCategory = initialHashState.competitionCategory || "all";
    const initialCompetitionLevel = initialHashState.competitionLevel || "all";
    const initialCompetitionPhase = initialHashState.competitionPhase || "all";

    const [selectedCompetitionTab, setSelectedCompetitionTab] = useState(initialCompetitionTab);
    const [selectedStandingsPhase, setSelectedStandingsPhase] = useState(initialCompetitionPhase);
    const [selectedStandingsLevel, setSelectedStandingsLevel] = useState(initialCompetitionLevel);
    const [selectedStandingsCategory, setSelectedStandingsCategory] = useState(initialCompetitionCategory);
    const [selectedResultsPhase, setSelectedResultsPhase] = useState(initialCompetitionPhase);
    const [selectedResultsLevel, setSelectedResultsLevel] = useState(initialCompetitionLevel);
    const [selectedResultsCategory, setSelectedResultsCategory] = useState(initialCompetitionCategory);
    const [selectedLeadersLevel, setSelectedLeadersLevel] = useState(initialCompetitionLevel);
    const [selectedLeadersCategory, setSelectedLeadersCategory] = useState(initialCompetitionCategory);
    const [rankingMinGames, setRankingMinGames] = useState("3");
    const [openMatches, setOpenMatches] = useState({});

    const {
        analysis: analysisIndex,
        loading: analysisIndexLoading,
        error: analysisIndexError
    } = useAnalysisData(`data/analysis-light.json?v=${analysisVersion}`);
    const {
        analysis: competitionOverview,
        loading: competitionOverviewLoading,
        error: competitionOverviewError
    } = useAnalysisData(`data/competition-overview.json?v=${analysisVersion}`);

    const categoryFiles = competitionOverview?.categoryFiles ?? EMPTY_LIST;
    const resolvedMatchesFile = selectedResultsCategory !== "all"
        ? (categoryFiles.find((cf) => cf.categoryName === selectedResultsCategory)?.matchesFile ?? "competition-matches.json")
        : "competition-matches.json";
    const resolvedLeadersFile = selectedLeadersCategory !== "all"
        ? (categoryFiles.find((cf) => cf.categoryName === selectedLeadersCategory)?.leadersFile ?? "competition-player-leaders.json")
        : "competition-player-leaders.json";
    const resolvedStandingsFile = selectedCompetitionTab === "standings"
        ? (selectedStandingsCategory !== "all"
            ? (categoryFiles.find((cf) => cf.categoryName === selectedStandingsCategory)?.standingsFile ?? "competition-standings.json")
            : "competition-standings.json")
        : null;

    const {
        analysis: competitionStandingsDataset,
        loading: competitionStandingsLoading,
        error: competitionStandingsError
    } = useAnalysisData(resolvedStandingsFile ? `data/${resolvedStandingsFile}?v=${analysisVersion}` : null);

    const {
        analysis: competitionMatchesData,
        loading: competitionMatchesLoading,
        error: competitionMatchesError
    } = useAnalysisData(
        selectedCompetitionTab === "matches"
            ? `data/${resolvedMatchesFile}?v=${analysisVersion}`
            : null
    );
    const {
        analysis: competitionPlayerLeadersData,
        loading: competitionPlayerLeadersLoading,
        error: competitionPlayerLeadersError
    } = useAnalysisData(
        selectedCompetitionTab === "leaders"
            ? `data/${resolvedLeadersFile}?v=${analysisVersion}`
            : null
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
    const competitionCategoryOptions = useMemo(
        () => buildCategoryOptionsFromRows(competitionOverview?.phases ?? []),
        [competitionOverview]
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
    const competitionBaseLoading = competitionOverviewLoading || analysisIndexLoading;
    const competitionBaseError = competitionOverviewError || competitionStandingsError || analysisIndexError;

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

        navigateToHash(buildTeamRoute(teamKey));
    };

    const handleCompetitionPlayerNavigate = (teamKey) => {
        if (!teamKey) {
            return;
        }

        navigateToHash(buildTeamRoute(teamKey));
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

    const handleStandingsPhaseChange = (phase) => {
        setSelectedStandingsPhase(String(phase || "all"));
    };

    const handleCompetitionTabChange = (tabId) => {
        if (tabId === selectedCompetitionTab) {
            return;
        }

        setSelectedCompetitionTab(tabId);
    };

    const effectiveTeamKey = initialHashState.teamKey ?? "";

    return (
        <div style={appStyles.pageShell}>
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
                        competitionStandingsLoading ? (
                            <SectionFallback message="Cargando clasificación..." />
                        ) : competitionStandingsError ? (
                            <div style={appStyles.emptyState}>{competitionStandingsError}</div>
                        ) : (
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
                        )
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
                                    matchReportApiAvailable={false}
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
}

export default CompetitionPage;
