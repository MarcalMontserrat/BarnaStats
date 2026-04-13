import {useState} from "react";
import StatCard from "./components/StatCard.jsx";
import PlayerEvolutionSection from "./components/PlayerEvolutionSection.jsx";
import MatchListSection from "./components/MatchListSection.jsx";
import PrettySelect from "./components/PrettySelect.jsx";
import SyncPanel from "./components/SyncPanel.jsx";
import {useAnalysisData} from "./hooks/useAnalysisData.js";
import {useSyncJob} from "./hooks/useSyncJob.js";
import {
    buildPlayersArray,
    getChartData,
    getMvp,
    getPlayersList,
    getTeamAverage,
    getTopScorer,
    getVisibleMatches,
    groupPlayersByMatch,
    sortMatches,
    sortPlayers
} from "./utils/playerStats.js";

const appStyles = {
    page: {
        background: "#f5f6fa",
        minHeight: "100vh",
        padding: 30,
        fontFamily: "Arial, sans-serif"
    },
    container: {
        maxWidth: 1200,
        margin: "0 auto"
    },
    header: {
        display: "grid",
        gap: 16,
        marginBottom: 30
    },
    intro: {
        display: "grid",
        gap: 8
    },
    helper: {
        color: "#666",
        margin: 0
    },
    cardsGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 20,
        marginBottom: 30
    },
    emptyState: {
        background: "#fff",
        padding: 24,
        borderRadius: 12,
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
    }
};

function App() {
    const [analysisVersion, setAnalysisVersion] = useState(() => Date.now());
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
    const teams = analysis?.teams ?? [];
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

    const [selectedTeamKey, setSelectedTeamKey] = useState("");
    const [selectedPhase, setSelectedPhase] = useState("");
    const [selectedPlayer, setSelectedPlayer] = useState("");
    const [selectedMatch, setSelectedMatch] = useState("");
    const [openMatches, setOpenMatches] = useState({});

    const effectiveTeamKey = teams.some((team) => team.teamKey === selectedTeamKey)
        ? selectedTeamKey
        : (defaultTeam?.teamKey ?? "");
    const selectedTeam = teams.find((team) => team.teamKey === effectiveTeamKey) ?? defaultTeam ?? null;
    const teamPlayers = selectedTeam?.matchPlayers ?? [];
    const teamMatchSummaries = selectedTeam?.matchSummaries ?? [];
    const availablePhases = [...new Set(teamMatchSummaries.map((match) => match.phaseNumber))]
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
    const topScorer = getTopScorer(playersArray);
    const mvp = getMvp(playersArray);
    const teamAvg = getTeamAverage(players);

    const handleToggleMatch = (matchWebId) => {
        setOpenMatches((prev) => ({
            ...prev,
            [matchWebId]: !prev[matchWebId]
        }));
    };

    const handleTeamChange = (event) => {
        setSelectedTeamKey(event.target.value);
        setSelectedPhase("");
        setSelectedPlayer("");
        setSelectedMatch("");
        setOpenMatches({});
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

    if (loading) {
        return (
            <div style={appStyles.page}>
                <div style={appStyles.container}>
                    <div style={appStyles.emptyState}>Cargando análisis...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={appStyles.page}>
                <div style={appStyles.container}>
                    <div style={appStyles.emptyState}>{error}</div>
                </div>
            </div>
        );
    }

    if (!selectedTeam) {
        return (
            <div style={appStyles.page}>
                <div style={appStyles.container}>
                    <div style={appStyles.emptyState}>No hay equipos disponibles en el análisis.</div>
                </div>
            </div>
        );
    }

    const summaryText = selectedPhaseValue === null
        ? `${analysis?.totalMatches ?? 0} partidos analizados · ${teams.length} equipos disponibles`
        : `Fase ${selectedPhaseValue} · ${sortedMatches.length} partidos`;

    return (
        <div style={appStyles.page}>
            <div style={appStyles.container}>
                <div style={appStyles.header}>
                    <div style={appStyles.intro}>
                        <h1 style={{marginBottom: 0}}>{selectedTeam.teamName}</h1>
                        <p style={appStyles.helper}>
                            {summaryText}
                        </p>
                    </div>

                    <SyncPanel
                        apiAvailable={apiAvailable}
                        job={job}
                        starting={syncStarting}
                        error={syncError}
                        onStartSync={startSync}
                    />

                    <div style={{display: "flex", gap: 16, flexWrap: "wrap"}}>
                        <PrettySelect
                            label="Equipo"
                            value={effectiveTeamKey}
                            onChange={handleTeamChange}
                            ariaLabel="Selecciona equipo"
                            minWidth="380px"
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
                        >
                            <option value="">Temporada completa</option>
                            {availablePhases.map((phase) => (
                                <option key={phase} value={phase}>
                                    Fase {phase}
                                </option>
                            ))}
                        </PrettySelect>
                    </div>
                </div>

                <div style={appStyles.cardsGrid}>
                    <StatCard
                        title="👑 MVP"
                        value={mvp?.name ?? "-"}
                        subtitle={mvp ? `${mvp.valuation} val` : undefined}
                    />

                    <StatCard
                        title="🔥 Top scorer"
                        value={topScorer?.name ?? "-"}
                        subtitle={topScorer ? `${topScorer.points} pts` : undefined}
                    />

                    <StatCard
                        title="📈 Media equipo"
                        value={teamAvg.toFixed(1)}
                        subtitle="pts / partido"
                    />

                    <StatCard
                        title="🏀 Jugadoras"
                        value={playersArray.length}
                        subtitle={`${sortedMatches.length} partidos`}
                    />
                </div>

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
                />
            </div>
        </div>
    );
}

export default App;
