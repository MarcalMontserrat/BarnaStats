import {lazy, Suspense, useEffect, useMemo, useRef, useState} from "react";
import PrettySelect from "../components/PrettySelect.jsx";
import TeamBadge from "../components/TeamBadge.jsx";
import {useAnalysisData} from "../hooks/useAnalysisData.js";
import {
    aggregateStandingRows,
    buildCategoryOptionsFromRows,
    buildCompetitionPhaseLabel,
    buildGenderOptions,
    buildLatestTeamContextByKey,
    buildLevelOptionsFromRows,
    buildPhaseScopeKey,
    buildPhaseSummaries,
    buildPhaseComparison,
    buildTeamPhaseOptions,
    buildTeamRecord,
    buildTeamRoute,
    filterRowsByCategory,
    filterRowsByGender,
    filterRowsByPhaseOption,
    getCategoryGender,
    getLongestWinStreak
} from "../utils/analysisDerived.js";
import {
    buildPlayersArray,
    getChartData,
    getMvp,
    getPlayersList,
    getSelectedPlayerSummary,
    getTeamAverage,
    getTopTeamPlayers,
    getTopScorer,
    getVisibleMatches,
    groupPlayersByMatch,
    sortMatches,
    sortPlayers
} from "../utils/playerStats.js";
import {
    buildClubRoute,
    buildCompetitionRoute,
    parseHash
} from "../utils/appRoutes.js";
import {navigateToHash} from "../utils/navigation.js";
import appStyles from "../styles/appStyles.js";
import SectionFallback from "../components/SectionFallback.jsx";

const PhaseComparisonSection = lazy(() => import("../components/PhaseComparisonSection.jsx"));
const TeamLeadersSection = lazy(() => import("../components/TeamLeadersSection.jsx"));
const TeamSnapshotSection = lazy(() => import("../components/TeamSnapshotSection.jsx"));
const PlayerEvolutionSection = lazy(() => import("../components/PlayerEvolutionSection.jsx"));
const MatchListSection = lazy(() => import("../components/MatchListSection.jsx"));

const EMPTY_LIST = [];

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

function TeamPage({analysisVersion, matchReportOnDemandEnabled}) {
    const initialHashState = parseHash(window.location.hash);
    const [selectedTeamKey] = useState(() => initialHashState.teamKey ?? "");
    const [selectedTeamGender, setSelectedTeamGender] = useState("all");
    const [selectedTeamLevel, setSelectedTeamLevel] = useState("all");
    const [selectedTeamCategory, setSelectedTeamCategory] = useState("all");
    const [selectedPhase, setSelectedPhase] = useState("");
    const [selectedPlayer, setSelectedPlayer] = useState("");
    const [selectedMatch, setSelectedMatch] = useState("");
    const [openMatches, setOpenMatches] = useState({});
    const [selectedTeamTab, setSelectedTeamTab] = useState("snapshot");
    const pendingScrollRestoreFrame = useRef(0);
    const teamTabsRef = useRef(null);

    const {
        analysis: analysisIndex,
        loading: analysisIndexLoading,
        error: analysisIndexError
    } = useAnalysisData(`data/analysis.json?v=${analysisVersion}`);
    const {
        analysis: competitionStandingsDataset,
        error: competitionStandingsError
    } = useAnalysisData(`data/competition-standings.json?v=${analysisVersion}`);

    const teams = analysisIndex?.teams ?? EMPTY_LIST;
    const currentSeasonLabel = analysisIndex?.seasonLabel ?? "";
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
    const effectiveTeamKey = dashboardTeams.some((team) => team.teamKey === selectedTeamKey)
        ? selectedTeamKey
        : (dashboardDefaultTeam?.teamKey ?? selectedTeamKeyFromAll);
    const selectedTeamSummary = teams.find((team) => team.teamKey === effectiveTeamKey) ?? globalDefaultTeam ?? null;
    const selectedTeamPhases = selectedTeamSummary?.phases ?? EMPTY_LIST;
    const competitionStandingScopes = competitionStandingsDataset?.scopes ?? EMPTY_LIST;
    const shouldLoadTeamMatches = !!selectedTeamSummary?.matchesFile;
    const shouldLoadTeamPlayers = !!selectedTeamSummary?.playersFile;
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

    useEffect(() => {
        if (!effectiveTeamKey || effectiveTeamKey === selectedTeamKey) {
            return;
        }

        navigateToHash(buildTeamRoute(effectiveTeamKey));
    }, [effectiveTeamKey, selectedTeamKey]);

    useEffect(() => () => {
        if (pendingScrollRestoreFrame.current) {
            window.cancelAnimationFrame(pendingScrollRestoreFrame.current);
        }
    }, []);

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

    const handlePlayerChange = (value) => {
        setSelectedPlayer(value);
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
                        <a href={buildClubRoute()} style={appStyles.secondaryLink}>
                            Ver club
                        </a>
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
                                matchReportApiAvailable={false}
                            />
                        </Suspense>
                    ) : null}
                </>
            ) : null}
        </>
    );
}

export default TeamPage;
