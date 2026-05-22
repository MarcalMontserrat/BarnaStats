import {useMemo, useState} from "react";
import AutocompleteField from "../components/AutocompleteField.jsx";
import DeferredArchivePrompt from "../components/DeferredArchivePrompt.jsx";
import TeamBadge from "../components/TeamBadge.jsx";
import {useAnalysisData} from "../hooks/useAnalysisData.js";
import {buildPlayersRoute, parseHash} from "../utils/appRoutes.js";
import {buildTeamRoute} from "../utils/analysisDerived.js";
import {navigateToHash} from "../utils/navigation.js";
import {sortFilterOptions} from "../utils/filterOptions.js";
import {formatDecimal} from "../utils/formatters.js";
import appStyles from "../styles/appStyles.js";

const EMPTY_LIST = [];

function PlayersPage({analysisVersion, totalPublishedSeasons}) {
    const initialHashState = parseHash(window.location.hash);
    const [historicalArchiveRequested, setHistoricalArchiveRequested] = useState(false);
    const [playerDirectoryQuery, setPlayerDirectoryQuery] = useState("");
    const [selectedHistoricalPlayerKey, setSelectedHistoricalPlayerKey] = useState(
        () => initialHashState.route === "players" ? (initialHashState.playerKey ?? "") : ""
    );

    const shouldLoadHistoricalArchive = historicalArchiveRequested || !!selectedHistoricalPlayerKey;

    const {
        analysis: historicalPlayersDirectory,
        loading: historicalPlayersLoading,
        error: historicalPlayersError
    } = useAnalysisData(
        shouldLoadHistoricalArchive
            ? `data/archive/players.json?v=${analysisVersion}`
            : null
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

    const handleHistoricalArchiveRequest = () => {
        setHistoricalArchiveRequested(true);
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

    const handleTeamNavigate = (teamKey) => {
        if (!teamKey) {
            return;
        }

        navigateToHash(buildTeamRoute(teamKey));
    };

    const playersArchiveLoading = shouldLoadHistoricalArchive && historicalPlayersLoading;
    const playersArchiveError = shouldLoadHistoricalArchive ? historicalPlayersError : "";

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

                            {(() => {
                                const latestSeason = [...(selectedHistoricalPlayer.seasonSummaries ?? [])]
                                    .sort((a, b) => (b.seasonStartYear ?? 0) - (a.seasonStartYear ?? 0))[0];
                                return latestSeason?.primaryTeamKey ? (
                                    <div style={appStyles.heroActions}>
                                        <button
                                            type="button"
                                            style={appStyles.secondaryLink}
                                            onClick={() => handleTeamNavigate(latestSeason.primaryTeamKey)}
                                        >
                                            Ver equipo
                                        </button>
                                    </div>
                                ) : null;
                            })()}
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
                                            {seasonSummary.primaryTeamKey ? (
                                                <button
                                                    type="button"
                                                    style={appStyles.playerTeamButton}
                                                    onClick={() => handleTeamNavigate(seasonSummary.primaryTeamKey)}
                                                >
                                                    {seasonSummary.teamNames.join(" · ") || "Equipo no disponible"}
                                                </button>
                                            ) : (
                                                <p style={appStyles.seasonCardMeta}>
                                                    {seasonSummary.teamNames.join(" · ") || "Equipo no disponible"}
                                                </p>
                                            )}
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
}

export default PlayersPage;
