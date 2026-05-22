import {useEffect, useState} from "react";
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
    parseHash,
    SYNC_ROUTE
} from "./utils/appRoutes.js";
import {navigateToHash} from "./utils/navigation.js";
import appStyles from "./styles/appStyles.js";
import SyncPage from "./pages/SyncPage.jsx";
import TeamPage from "./pages/TeamPage.jsx";
import CompetitionPage from "./pages/CompetitionPage.jsx";
import ClubPage from "./pages/ClubPage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";
import PlayersPage from "./pages/PlayersPage.jsx";
import ComparePage from "./pages/ComparePage.jsx";

const EMPTY_LIST = [];


function App() {
    const syncUiEnabled = import.meta.env.VITE_ENABLE_SYNC_UI !== "false";
    const matchReportOnDemandEnabled = syncUiEnabled;
    const [analysisVersion, setAnalysisVersion] = useState(() => Date.now());
    const [route, setRoute] = useState(() => parseHash(window.location.hash).route);
    const {
        analysis: seasonsIndex,
    } = useAnalysisData(`data/seasons/index.json?v=${analysisVersion}`);
    const seasonOptions = seasonsIndex?.seasons ?? EMPTY_LIST;
    const defaultSeasonLabel = seasonsIndex?.defaultSeasonLabel || seasonOptions[0]?.seasonLabel || "";
    const currentSeasonLabel = seasonsIndex ? (seasonsIndex.defaultSeasonLabel || defaultSeasonLabel) : defaultSeasonLabel;
    const totalPublishedSeasons = seasonOptions.length;
    const pageMeta = getPageMetadata(route, currentSeasonLabel);

    useEffect(() => {
        if (!window.location.hash) {
            navigateToHash(buildDefaultRoute());
        }

        const handleHashChange = () => {
            const nextState = parseHash(window.location.hash);
            setRoute(nextState.route);
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
                                ? ` Temporada actual: ${pageMeta.seasonLabel}.`
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
                    </div>
                </div>

                {route === "sync" && syncUiEnabled
                    ? <SyncPage syncUiEnabled={syncUiEnabled} onAnalysisVersionChange={setAnalysisVersion} />
                    : route === "competition"
                        ? <CompetitionPage key="competition" analysisVersion={analysisVersion} matchReportOnDemandEnabled={matchReportOnDemandEnabled} />
                        : route === "club"
                            ? <ClubPage key="club" analysisVersion={analysisVersion} />
                        : route === "history"
                            ? <HistoryPage key="history" analysisVersion={analysisVersion} totalPublishedSeasons={totalPublishedSeasons} />
                        : route === "players"
                            ? <PlayersPage key="players" analysisVersion={analysisVersion} totalPublishedSeasons={totalPublishedSeasons} />
                        : route === "compare"
                            ? <ComparePage key="compare" analysisVersion={analysisVersion} />
                            : <TeamPage key="dashboard" analysisVersion={analysisVersion} matchReportOnDemandEnabled={matchReportOnDemandEnabled} />}
            </div>
        </div>
    );
}

export default App;
