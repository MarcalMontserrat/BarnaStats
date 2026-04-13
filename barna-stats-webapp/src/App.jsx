import {useEffect, useState} from "react";
import GlobalLeadersSection from "./components/GlobalLeadersSection.jsx";
import PhaseComparisonSection from "./components/PhaseComparisonSection.jsx";
import StandingsSection from "./components/StandingsSection.jsx";
import TeamLeadersSection from "./components/TeamLeadersSection.jsx";
import StatCard from "./components/StatCard.jsx";
import PlayerEvolutionSection from "./components/PlayerEvolutionSection.jsx";
import MatchListSection from "./components/MatchListSection.jsx";
import PrettySelect from "./components/PrettySelect.jsx";
import SyncPanel from "./components/SyncPanel.jsx";
import {useAnalysisData} from "./hooks/useAnalysisData.js";
import {useSyncJob} from "./hooks/useSyncJob.js";
import {
    buildPhaseComparison,
    buildPhaseSummaries,
    buildStandings,
    buildTeamRoute
} from "./utils/analysisDerived.js";
import {
    buildPlayersArray,
    getChartData,
    getMvp,
    getPlayersList,
    getTeamAverage,
    getTopGlobalPlayers,
    getTopTeamPlayers,
    getTopScorer,
    getVisibleMatches,
    groupPlayersByMatch,
    sortMatches,
    sortPlayers
} from "./utils/playerStats.js";

const DASHBOARD_ROUTE = "#/";
const SYNC_ROUTE = "#/sync";
const COMPETITION_ROUTE = "#/competition";
const TEAM_ROUTE_PREFIX = "#/team/";

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
    heroActions: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        gap: 16,
        flexWrap: "wrap"
    },
    cardsGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 18,
        animation: "fade-up 820ms ease both"
    },
    emptyState: {
        background: "linear-gradient(180deg, rgba(255, 252, 247, 0.92) 0%, rgba(252, 246, 239, 0.88) 100%)",
        padding: 28,
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-md)",
        border: "1px solid var(--border)",
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

function App() {
    const [analysisVersion, setAnalysisVersion] = useState(() => Date.now());
    const [route, setRoute] = useState(() => parseHash(window.location.hash).route);
    const {analysis, loading, error} = useAnalysisData(`/data/analysis.json?v=${analysisVersion}`);
    const {
        apiAvailable,
        starting: syncStarting,
        error: syncError,
        job,
        startSync
    } = useSyncJob(() => {
        setAnalysisVersion(Date.now());
    });

    const initialHashState = parseHash(window.location.hash);
    const [selectedTeamKey, setSelectedTeamKey] = useState(() => initialHashState.teamKey ?? "");
    const [selectedPhase, setSelectedPhase] = useState("");
    const [selectedPlayer, setSelectedPlayer] = useState("");
    const [selectedMatch, setSelectedMatch] = useState("");
    const [openMatches, setOpenMatches] = useState({});
    const [selectedStandingsPhase, setSelectedStandingsPhase] = useState("all");
    const [rankingMinGames, setRankingMinGames] = useState("3");

    useEffect(() => {
        if (!window.location.hash) {
            window.location.hash = DASHBOARD_ROUTE;
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

    const teams = analysis?.teams ?? [];
    const competition = analysis?.competition ?? null;
    const sortedTeams = [...teams].sort((a, b) => a.teamName.localeCompare(b.teamName, "es"));
    const defaultTeam = teams.reduce((best, team) => {
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

    const effectiveTeamKey = teams.some((team) => team.teamKey === selectedTeamKey)
        ? selectedTeamKey
        : (defaultTeam?.teamKey ?? "");
    const selectedTeam = teams.find((team) => team.teamKey === effectiveTeamKey) ?? defaultTeam ?? null;
    const teamPlayers = selectedTeam?.matchPlayers ?? [];
    const teamMatchSummaries = selectedTeam?.matchSummaries ?? [];
    const availablePhases = [...new Set(teamMatchSummaries.map((match) => match.phaseNumber))]
        .sort((a, b) => a - b);
    const competitionPhaseNumbers = (competition?.phases ?? [])
        .map((phase) => phase.phaseNumber)
        .sort((a, b) => a - b);
    const selectedPhaseValue = selectedPhase ? Number(selectedPhase) : null;
    const matchSummaries = selectedPhaseValue === null
        ? teamMatchSummaries
        : teamMatchSummaries.filter((match) => match.phaseNumber === selectedPhaseValue);
    const players = selectedPhaseValue === null
        ? teamPlayers
        : teamPlayers.filter((player) => player.phaseNumber === selectedPhaseValue);
    const effectiveSelectedPlayer = selectedPlayer &&
    players.some((player) => player.playerName === selectedPlayer)
        ? selectedPlayer
        : "";

    const playersList = getPlayersList(players);
    const chartData = getChartData(players, effectiveSelectedPlayer, selectedPhaseValue);
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
    const filteredCompetitionPlayers = competitionPlayerLeaders
        .filter((player) => player.games >= rankingMinGamesValue);
    const globalLeadersByAvgValuation = getTopGlobalPlayers(filteredCompetitionPlayers, "avgValuation", 8);
    const globalLeadersByPoints = getTopGlobalPlayers(filteredCompetitionPlayers, "points", 8);
    const effectiveCompetitionPhase = selectedStandingsPhase || "all";
    const competitionStandingsRows = effectiveCompetitionPhase === "all"
        ? buildStandings(competitionMatches, null)
        : (competition?.standingsByPhase
            ?.find((phase) => String(phase.phaseNumber) === String(effectiveCompetitionPhase))
            ?.rows ?? []);
    const topScorer = getTopScorer(playersArray);
    const mvp = getMvp(playersArray);
    const teamAvg = getTeamAverage(players);
    const seasonLabel = selectedPhaseValue === null
        ? "Temporada completa"
        : `Fase ${selectedPhaseValue}`;
    const summaryText = selectedPhaseValue === null
        ? `${selectedTeam?.matchesPlayed ?? 0} partidos · ${selectedTeam?.playersCount ?? 0} jugadoras`
        : `Fase ${selectedPhaseValue} · ${sortedMatches.length} partidos`;

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

        setSelectedTeamKey(teamKey);
        setSelectedPhase("");
        setSelectedPlayer("");
        setSelectedMatch("");
        setOpenMatches({});
        window.location.hash = buildTeamRoute(teamKey);
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

    const handlePlayerChange = (value) => {
        setSelectedPlayer(value);
    };

    const handleStandingsPhaseChange = (phase) => {
        setSelectedStandingsPhase(String(phase || "all"));
    };

    const renderDashboard = () => {
        if (loading) {
            return <div style={appStyles.emptyState}>Cargando análisis...</div>;
        }

        if (error) {
            return <div style={appStyles.emptyState}>{error}</div>;
        }

        if (!selectedTeam) {
            return <div style={appStyles.emptyState}>No hay equipos disponibles en el análisis.</div>;
        }

        return (
            <>
                <section style={appStyles.hero}>
                    <div style={appStyles.heroPattern}/>
                    <div style={appStyles.heroContent}>
                        <div style={appStyles.heroHeader}>
                            <div style={appStyles.heroKicker}>Vista del equipo</div>
                            <h2 style={appStyles.heroTitle}>{selectedTeam.teamName}</h2>
                            <p style={appStyles.heroSummary}>{summaryText}</p>
                        </div>

                        <div style={appStyles.heroMetaRow}>
                            <span style={appStyles.metaChip}>{seasonLabel}</span>
                            <span style={appStyles.metaChip}>{sortedMatches.length} partidos visibles</span>
                            <span style={appStyles.metaChip}>{playersArray.length} jugadoras</span>
                        </div>

                        <div style={appStyles.heroActions}>
                            <div style={appStyles.filterDeck}>
                                <PrettySelect
                                    label="Equipo"
                                    value={effectiveTeamKey}
                                    onChange={handleTeamChange}
                                    ariaLabel="Selecciona equipo"
                                    minWidth="360px"
                                    labelColor="rgba(255, 247, 237, 0.82)"
                                >
                                    {sortedTeams.map((team) => (
                                        <option key={team.teamKey} value={team.teamKey}>
                                            {team.teamName}
                                        </option>
                                    ))}
                                </PrettySelect>

                                <PrettySelect
                                    label="Fase"
                                    value={selectedPhase}
                                    onChange={handlePhaseChange}
                                    ariaLabel="Selecciona fase"
                                    minWidth="220px"
                                    labelColor="rgba(255, 247, 237, 0.82)"
                                >
                                    <option value="">Temporada completa</option>
                                    {availablePhases.map((phase) => (
                                        <option key={phase} value={phase}>
                                            Fase {phase}
                                        </option>
                                    ))}
                                </PrettySelect>
                            </div>

                            <a href={COMPETITION_ROUTE} style={appStyles.secondaryLink}>
                                Ver competición
                            </a>
                        </div>
                    </div>
                </section>

                <section style={appStyles.cardsGrid}>
                    <StatCard
                        title="MVP"
                        value={mvp?.name ?? "-"}
                        subtitle={mvp ? `${mvp.valuation} val` : undefined}
                        tone="ember"
                    />

                    <StatCard
                        title="Máxima anotadora"
                        value={topScorer?.name ?? "-"}
                        subtitle={topScorer ? `${topScorer.points} pts` : undefined}
                        tone="ink"
                    />

                    <StatCard
                        title="Media del equipo"
                        value={teamAvg.toFixed(1)}
                        subtitle="pts por partido"
                        tone="gold"
                    />

                    <StatCard
                        title="Jugadoras usadas"
                        value={playersArray.length}
                        subtitle={`${sortedMatches.length} partidos`}
                        tone="mint"
                    />
                </section>

                <TeamLeadersSection
                    teamName={selectedTeam.teamName}
                    seasonLabel={seasonLabel}
                    matchesCount={sortedMatches.length}
                    playersCount={playersArray.length}
                    leadersByAvgValuation={teamLeadersByAvgValuation}
                    leadersByPoints={teamLeadersByPoints}
                />

                <PhaseComparisonSection
                    phaseSummaries={phaseSummaries}
                    comparison={phaseComparison}
                />

                <PlayerEvolutionSection
                    playersList={playersList}
                    selectedPlayer={effectiveSelectedPlayer}
                    onSelectedPlayerChange={handlePlayerChange}
                    chartData={chartData}
                />

                <MatchListSection
                    sortedMatches={sortedMatches}
                    visibleMatches={visibleMatches}
                    selectedMatch={selectedMatch}
                    onSelectedMatchChange={setSelectedMatch}
                    selectedPhase={selectedPhaseValue}
                    openMatches={openMatches}
                    onToggleMatch={handleToggleMatch}
                    onTeamNavigate={handleTeamNavigate}
                />
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

            <SyncPanel
                apiAvailable={apiAvailable}
                job={job}
                starting={syncStarting}
                error={syncError}
                onStartSync={startSync}
            />
        </div>
    );

    const renderCompetitionPage = () => (
        <div style={appStyles.pageShell}>
            <a href={selectedTeam ? buildTeamRoute(selectedTeam.teamKey) : DASHBOARD_ROUTE} style={appStyles.pageBackLink}>
                Volver al panel
            </a>

            <section style={appStyles.syncIntro}>
                <div style={appStyles.syncEyebrow}>Competición</div>
                <h2 style={appStyles.syncTitle}>Clasificación y líderes globales</h2>
                <p style={appStyles.syncBody}>
                    Aquí tienes la lectura global de la competición: la clasificación acumulada o por fase y las jugadoras que más destacan.
                </p>
            </section>

            <StandingsSection
                rows={competitionStandingsRows}
                availablePhases={competitionPhaseNumbers}
                selectedPhase={effectiveCompetitionPhase}
                onSelectedPhaseChange={handleStandingsPhaseChange}
                selectedTeamKey={effectiveTeamKey}
                onTeamNavigate={handleTeamNavigate}
            />

            <GlobalLeadersSection
                totalPlayers={competitionPlayerLeaders.length}
                totalTeams={competition?.totalTeams ?? teams.length}
                leadersByAvgValuation={globalLeadersByAvgValuation}
                leadersByPoints={globalLeadersByPoints}
                rankingMinGames={rankingMinGames}
                onRankingMinGamesChange={setRankingMinGames}
                onTeamNavigate={handleTeamNavigate}
            />
        </div>
    );

    const pageTitle = route === "sync"
        ? "Importar datos"
        : route === "competition"
            ? "Competición"
            : "Cuaderno de juego";
    const pageNote = route === "sync"
        ? "Añade nuevas fases desde la fuente oficial sin pasar por la terminal."
        : route === "competition"
            ? "Clasificación general, clasificación por fases y líderes individuales separados del análisis propio de cada equipo."
            : "Sigue la temporada por equipo y por fase, con detalle de cada partido y lectura visual de su evolución.";

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
                            href={selectedTeam ? buildTeamRoute(selectedTeam.teamKey) : DASHBOARD_ROUTE}
                            style={route === "dashboard"
                                ? {...appStyles.navLink, ...appStyles.navLinkActive}
                                : appStyles.navLink}
                        >
                            Resultados
                        </a>
                        <a
                            href={SYNC_ROUTE}
                            style={route === "sync"
                                ? {...appStyles.navLink, ...appStyles.navLinkActive}
                                : appStyles.navLink}
                        >
                            Cargar fase
                        </a>
                    </div>
                </div>

                {route === "sync"
                    ? renderSyncPage()
                    : route === "competition"
                        ? renderCompetitionPage()
                        : renderDashboard()}
            </div>
        </div>
    );
}

export default App;
