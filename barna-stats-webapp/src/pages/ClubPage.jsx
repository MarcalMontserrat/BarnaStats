import {lazy, Suspense, useEffect, useMemo, useState} from "react";
import AutocompleteField from "../components/AutocompleteField.jsx";
import TeamBadge from "../components/TeamBadge.jsx";
import {useAnalysisData} from "../hooks/useAnalysisData.js";
import {
    buildClubRoute,
    buildCompetitionRoute,
    parseHash
} from "../utils/appRoutes.js";
import {buildTeamRoute} from "../utils/analysisDerived.js";
import {navigateToHash} from "../utils/navigation.js";
import {sortFilterOptions} from "../utils/filterOptions.js";
import appStyles from "../styles/appStyles.js";
import SectionFallback from "../components/SectionFallback.jsx";

const ClubOverviewSection = lazy(() => import("../components/ClubOverviewSection.jsx"));

const EMPTY_LIST = [];

function ClubPage({analysisVersion}) {
    const initialHashState = parseHash(window.location.hash);
    const [selectedClubKey, setSelectedClubKey] = useState(() => initialHashState.clubKey ?? "");
    const [clubQuery, setClubQuery] = useState("");

    const {
        analysis: analysisIndex,
        loading: analysisIndexLoading,
        error: analysisIndexError
    } = useAnalysisData(`data/analysis-light.json?v=${analysisVersion}`);
    const {
        analysis: currentClubDirectory,
        loading: currentClubDirectoryLoading,
        error: currentClubDirectoryError
    } = useAnalysisData(`data/clubs.json?v=${analysisVersion}`);

    const teams = analysisIndex?.teams ?? EMPTY_LIST;
    const currentClubEntities = Array.isArray(currentClubDirectory) ? currentClubDirectory : EMPTY_LIST;
    const clubOptions = useMemo(() => sortFilterOptions(currentClubEntities.map((club) => ({
        value: club.key,
        label: club.label,
        meta: club.meta,
        searchText: `${club.searchText} ${club.meta}`
    }))), [currentClubEntities]);

    const fallbackClubKey = currentClubEntities[0]?.key ?? "";
    const effectiveClubKey = currentClubEntities.some((club) => club.key === selectedClubKey)
        ? selectedClubKey
        : fallbackClubKey;
    const selectedClub = currentClubEntities.find((club) => club.key === effectiveClubKey) ?? null;

    useEffect(() => {
        if (!effectiveClubKey || effectiveClubKey === selectedClubKey) {
            return;
        }

        navigateToHash(buildClubRoute(effectiveClubKey));
    }, [effectiveClubKey, selectedClubKey]);

    const handleClubNavigate = (clubKey) => {
        if (!clubKey) {
            return;
        }

        setSelectedClubKey(clubKey);
        navigateToHash(buildClubRoute(clubKey));
    };

    const handleClubQueryChange = (value) => {
        setClubQuery(value);
    };

    const handleClubSelect = (option) => {
        setClubQuery(option.label);
        handleClubNavigate(option.value);
    };

    const handleTeamNavigate = (teamKey) => {
        if (!teamKey) {
            return;
        }

        navigateToHash(buildTeamRoute(teamKey));
    };

    const handleCompetitionScopeNavigate = (team) => {
        if (!team?.teamKey) {
            return;
        }

        navigateToHash(buildCompetitionRoute({
            teamKey: team.teamKey,
            tab: "standings",
            category: team.categoryName || "",
            level: team.levelKey || "",
            phase: team.latestPhaseOptionValue || ""
        }));
    };

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
                                <span style={appStyles.metaChip}>{selectedClub.totalTeams} equipos</span>
                                <span style={appStyles.metaChip}>{selectedClub.categoriesCount} categorias</span>
                                <span style={appStyles.metaChip}>{selectedClub.totalPlayers} jugadoras registradas</span>
                            </div>

                            <div style={appStyles.heroActions}>
                                <a href={buildCompetitionRoute()} style={appStyles.secondaryLink}>
                                    Ver competicion
                                </a>
                            </div>
                        </div>
                    </section>

                    <Suspense fallback={<SectionFallback message="Cargando vista de club..." />}>
                        <ClubOverviewSection
                            club={selectedClub}
                            onTeamNavigate={(teamKey) => handleTeamNavigate(teamKey)}
                            onCompetitionNavigate={handleCompetitionScopeNavigate}
                        />
                    </Suspense>
                </>
            )}
        </div>
    );
}

export default ClubPage;
