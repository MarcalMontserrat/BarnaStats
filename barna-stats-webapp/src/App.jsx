import {useEffect, useMemo, useState} from "react";
import {useAnalysisData} from "./hooks/useAnalysisData.js";
import {
    buildClubRoute,
    buildCompareRoute,
    buildCompetitionRoute,
    buildDashboardRoute,
    buildDefaultRoute,
    buildHistoryRoute,
    buildPlayersRoute,
    getPageMetadata,
    getSeasonScopedRouteBase,
    isSeasonScopedRoute,
    parseHash,
    resolveSeasonFromHash,
    SYNC_ROUTE
} from "./utils/appRoutes.js";
import {navigateToHash} from "./utils/navigation.js";
import appStyles from "./styles/appStyles.js";
import Footer from "./components/Footer.jsx";
import PrettySelect from "./components/PrettySelect.jsx";
import SyncPage from "./pages/SyncPage.jsx";
import TeamPage from "./pages/TeamPage.jsx";
import CompetitionPage from "./pages/CompetitionPage.jsx";
import ClubPage from "./pages/ClubPage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";
import PlayersPage from "./pages/PlayersPage.jsx";
import ComparePage from "./pages/ComparePage.jsx";

const EMPTY_LIST = [];
const SEASON_STORAGE_KEY = "barnastats:season";

function readStoredSeason() {
    try {
        return window.sessionStorage.getItem(SEASON_STORAGE_KEY) ?? "";
    } catch {
        return "";
    }
}

function storeSeason(seasonLabel) {
    try {
        window.sessionStorage.setItem(SEASON_STORAGE_KEY, seasonLabel);
    } catch {
        // Sin almacenamiento disponible: la temporada solo vive en memoria.
    }
}


function App() {
    const syncUiEnabled = import.meta.env.VITE_ENABLE_SYNC_UI !== "false";
    const matchReportOnDemandEnabled = syncUiEnabled;
    const [analysisVersion, setAnalysisVersion] = useState(() => Date.now());
    const [hash, setHash] = useState(() => window.location.hash);
    const [preferredSeasonLabel, setPreferredSeasonLabel] = useState(readStoredSeason);
    const route = parseHash(hash).route;
    const {
        analysis: seasonsIndex,
    } = useAnalysisData(`data/seasons/index.json?v=${analysisVersion}`);
    const seasonOptions = seasonsIndex?.seasons ?? EMPTY_LIST;
    const defaultSeasonLabel = seasonsIndex?.defaultSeasonLabel || seasonOptions[0]?.seasonLabel || "";
    const currentSeasonLabel = seasonsIndex ? (seasonsIndex.defaultSeasonLabel || defaultSeasonLabel) : defaultSeasonLabel;
    const totalPublishedSeasons = seasonOptions.length;
    const knownSeasonLabels = useMemo(
        () => seasonOptions.map((season) => season.seasonLabel),
        [seasonOptions]
    );
    const seasonFromHash = resolveSeasonFromHash(hash, knownSeasonLabels);
    const selectedSeasonLabel = [seasonFromHash, preferredSeasonLabel]
        .find((label) => label && knownSeasonLabels.includes(label)) || currentSeasonLabel;
    const selectedSeason = seasonOptions.find((season) => season.seasonLabel === selectedSeasonLabel);
    const seasonDataRoot = `data/${selectedSeason?.dataRoot ?? ""}`;
    const isViewingCurrentSeason = !selectedSeasonLabel || selectedSeasonLabel === currentSeasonLabel;
    const showSeasonSelector = seasonOptions.length > 1 && isSeasonScopedRoute(route);
    const pageMeta = getPageMetadata(route, selectedSeasonLabel);

    // Un enlace que apunta a otra temporada (p. ej. un equipo archivado) pasa a ser la preferencia,
    // para que se mantenga al navegar a otras páginas.
    if (seasonFromHash && seasonFromHash !== preferredSeasonLabel) {
        setPreferredSeasonLabel(seasonFromHash);
    }

    useEffect(() => {
        if (preferredSeasonLabel) {
            storeSeason(preferredSeasonLabel);
        }
    }, [preferredSeasonLabel]);

    const handleSeasonChange = (event) => {
        setPreferredSeasonLabel(event.target.value);

        // Equipos, categorías y fases cambian entre temporadas: se vuelve a la vista base de la página.
        navigateToHash(getSeasonScopedRouteBase(route));
    };

    useEffect(() => {
        if (!window.location.hash) {
            navigateToHash(buildDefaultRoute());
        }

        const handleHashChange = () => {
            setHash(window.location.hash);
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

        navigateToHash(buildDefaultRoute());
    }, [route, syncUiEnabled]);

    return (
        <div style={appStyles.page}>
            <div style={appStyles.glowPrimary}/>
            <div style={appStyles.glowSecondary}/>

            <div style={appStyles.container}>
                <div style={appStyles.topBar}>
                    <div style={appStyles.brand}>
                        <p style={appStyles.eyebrow}>BarnaStats</p>
                        <h1 style={appStyles.brandTitle}>{pageMeta.title}</h1>
                        <p style={appStyles.brandNote}>
                            {pageMeta.note}
                            {pageMeta.seasonLabel
                                ? isViewingCurrentSeason
                                    ? ` Temporada actual: ${pageMeta.seasonLabel}.`
                                    : ` Mostrando la temporada ${pageMeta.seasonLabel}.`
                                : ""}
                        </p>
                    </div>

                    <div style={appStyles.topBarActions}>
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
                                href={buildClubRoute()}
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

                            <a
                                href={buildCompareRoute()}
                                style={route === "compare"
                                    ? {...appStyles.navLink, ...appStyles.navLinkActive}
                                    : appStyles.navLink}
                            >
                                Comparar
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

                        {showSeasonSelector ? (
                            <PrettySelect
                                label="Temporada"
                                value={selectedSeasonLabel}
                                onChange={handleSeasonChange}
                                minWidth="180px"
                            >
                                {seasonOptions.map((season) => (
                                    <option key={season.seasonLabel} value={season.seasonLabel}>
                                        {season.seasonLabel === currentSeasonLabel
                                            ? `${season.seasonLabel} (actual)`
                                            : season.seasonLabel}
                                    </option>
                                ))}
                            </PrettySelect>
                        ) : null}
                    </div>
                </div>

                {route === "sync" && syncUiEnabled
                    ? <SyncPage syncUiEnabled={syncUiEnabled} onAnalysisVersionChange={setAnalysisVersion} />
                    : route === "competition"
                        ? <CompetitionPage key={`competition-${selectedSeasonLabel}`} analysisVersion={analysisVersion} dataRoot={seasonDataRoot} matchReportOnDemandEnabled={matchReportOnDemandEnabled} />
                        : route === "club"
                            ? <ClubPage key={`club-${selectedSeasonLabel}`} analysisVersion={analysisVersion} dataRoot={seasonDataRoot} />
                        : route === "history"
                            ? <HistoryPage key="history" analysisVersion={analysisVersion} totalPublishedSeasons={totalPublishedSeasons} />
                        : route === "players"
                            ? <PlayersPage key="players" analysisVersion={analysisVersion} totalPublishedSeasons={totalPublishedSeasons} />
                        : route === "compare"
                            ? <ComparePage key={`compare-${selectedSeasonLabel}`} analysisVersion={analysisVersion} dataRoot={seasonDataRoot} />
                            : <TeamPage key={`dashboard-${selectedSeasonLabel}`} analysisVersion={analysisVersion} dataRoot={seasonDataRoot} matchReportOnDemandEnabled={matchReportOnDemandEnabled} />}

                <Footer />
            </div>
        </div>
    );
}

export default App;
