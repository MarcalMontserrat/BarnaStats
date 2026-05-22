import {useMemo, useState} from "react";
import AutocompleteField from "../components/AutocompleteField.jsx";
import DeferredArchivePrompt from "../components/DeferredArchivePrompt.jsx";
import TeamBadge from "../components/TeamBadge.jsx";
import {useAnalysisData} from "../hooks/useAnalysisData.js";
import {buildHistoryRoute, parseHash} from "../utils/appRoutes.js";
import {navigateToHash} from "../utils/navigation.js";
import {sortFilterOptions} from "../utils/filterOptions.js";
import {formatDecimal, formatRecordLine, formatSignedNumber} from "../utils/formatters.js";
import appStyles from "../styles/appStyles.js";

const EMPTY_LIST = [];

function HistoryPage({analysisVersion, totalPublishedSeasons}) {
    const initialHashState = parseHash(window.location.hash);
    const [historicalArchiveRequested, setHistoricalArchiveRequested] = useState(false);
    const [historyTeamQuery, setHistoryTeamQuery] = useState("");
    const [selectedHistoryTeamKey, setSelectedHistoryTeamKey] = useState(
        () => initialHashState.route === "history" ? (initialHashState.teamKey ?? "") : ""
    );

    const shouldLoadHistoricalArchive = historicalArchiveRequested || !!selectedHistoryTeamKey;

    const {
        analysis: historicalTeamsDirectory,
        loading: historicalTeamsLoading,
        error: historicalTeamsError
    } = useAnalysisData(
        shouldLoadHistoricalArchive
            ? `data/archive/teams.json?v=${analysisVersion}`
            : null
    );

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

    const handleHistoricalArchiveRequest = () => {
        setHistoricalArchiveRequested(true);
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

    if (historicalTeamsLoading) {
        return <div style={appStyles.emptyState}>Cargando archivo histórico...</div>;
    }

    if (historicalTeamsError) {
        return <div style={appStyles.emptyState}>{historicalTeamsError}</div>;
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
}

export default HistoryPage;
