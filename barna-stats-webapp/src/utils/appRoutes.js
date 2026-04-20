export const ROOT_ROUTE = "#/";
export const DASHBOARD_ROUTE = "#/team";
export const SYNC_ROUTE = "#/sync";
export const COMPETITION_ROUTE = "#/competition";
export const CLUB_ROUTE = "#/club";
export const HISTORY_ROUTE = "#/history";
export const PLAYERS_ROUTE = "#/players";

const TEAM_ROUTE_PREFIX = `${DASHBOARD_ROUTE}/`;
const CLUB_ROUTE_PREFIX = `${CLUB_ROUTE}/`;
const HISTORY_TEAM_ROUTE_PREFIX = `${HISTORY_ROUTE}/`;

function buildHash(path, params = {}) {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (!value) {
            return;
        }

        query.set(key, String(value));
    });

    const queryString = query.toString();
    return queryString ? `${path}?${queryString}` : path;
}

export function buildDefaultRoute() {
    return ROOT_ROUTE;
}

export function buildDashboardRoute() {
    return DASHBOARD_ROUTE;
}

export function buildCompetitionRoute({
    teamKey = "",
    tab = "",
    category = "",
    level = "",
    phase = ""
} = {}) {
    return buildHash(COMPETITION_ROUTE, {
        team: teamKey,
        tab,
        category,
        level,
        phase
    });
}

export function buildClubRoute(clubKey = "") {
    return clubKey
        ? `${CLUB_ROUTE}/${encodeURIComponent(clubKey)}`
        : CLUB_ROUTE;
}

export function buildHistoryRoute(teamKey = "") {
    return teamKey
        ? `${HISTORY_ROUTE}/${encodeURIComponent(teamKey)}`
        : HISTORY_ROUTE;
}

export function buildPlayersRoute(playerKey = "") {
    return buildHash(PLAYERS_ROUTE, {player: playerKey});
}

export function parseHash(hash) {
    const [path, queryString = ""] = String(hash ?? "").split("?");
    const params = new URLSearchParams(queryString);
    const playerKey = params.get("player") ?? "";
    const teamKey = params.get("team") ?? "";
    const clubKey = params.get("club") ?? "";
    const competitionTab = params.get("tab") ?? "";
    const competitionCategory = params.get("category") ?? "";
    const competitionLevel = params.get("level") ?? "";
    const competitionPhase = params.get("phase") ?? "";

    if (path === SYNC_ROUTE) {
        return {
            route: "sync",
            teamKey: null,
            clubKey: "",
            playerKey: "",
            competitionTab: "",
            competitionCategory: "",
            competitionLevel: "",
            competitionPhase: ""
        };
    }

    if (path === COMPETITION_ROUTE || path === "#/rankings" || path === "#/global") {
        return {
            route: "competition",
            teamKey: teamKey || null,
            clubKey: "",
            playerKey: "",
            competitionTab,
            competitionCategory,
            competitionLevel,
            competitionPhase
        };
    }

    if (path === ROOT_ROUTE || path === CLUB_ROUTE || path === "") {
        return {
            route: "club",
            teamKey: teamKey || null,
            clubKey: clubKey || null,
            playerKey: "",
            competitionTab: "",
            competitionCategory: "",
            competitionLevel: "",
            competitionPhase: ""
        };
    }

    if (path === DASHBOARD_ROUTE) {
        return {
            route: "dashboard",
            teamKey: teamKey || null,
            clubKey: "",
            playerKey: "",
            competitionTab: "",
            competitionCategory: "",
            competitionLevel: "",
            competitionPhase: ""
        };
    }

    if (path === PLAYERS_ROUTE) {
        return {
            route: "players",
            teamKey: null,
            clubKey: "",
            playerKey,
            competitionTab: "",
            competitionCategory: "",
            competitionLevel: "",
            competitionPhase: ""
        };
    }

    if (path === HISTORY_ROUTE) {
        return {
            route: "history",
            teamKey: null,
            clubKey: "",
            playerKey: "",
            competitionTab: "",
            competitionCategory: "",
            competitionLevel: "",
            competitionPhase: ""
        };
    }

    if (path.startsWith(HISTORY_TEAM_ROUTE_PREFIX)) {
        const encodedTeamKey = path.slice(HISTORY_TEAM_ROUTE_PREFIX.length);

        return {
            route: "history",
            teamKey: encodedTeamKey ? decodeURIComponent(encodedTeamKey) : null,
            clubKey: "",
            playerKey: "",
            competitionTab: "",
            competitionCategory: "",
            competitionLevel: "",
            competitionPhase: ""
        };
    }

    if (path.startsWith(CLUB_ROUTE_PREFIX)) {
        const encodedClubKey = path.slice(CLUB_ROUTE_PREFIX.length);

        return {
            route: "club",
            teamKey: teamKey || null,
            clubKey: encodedClubKey ? decodeURIComponent(encodedClubKey) : null,
            playerKey: "",
            competitionTab: "",
            competitionCategory: "",
            competitionLevel: "",
            competitionPhase: ""
        };
    }

    if (path.startsWith(TEAM_ROUTE_PREFIX)) {
        const encodedTeamKey = path.slice(TEAM_ROUTE_PREFIX.length);

        return {
            route: "dashboard",
            teamKey: encodedTeamKey ? decodeURIComponent(encodedTeamKey) : null,
            clubKey: "",
            playerKey: "",
            competitionTab: "",
            competitionCategory: "",
            competitionLevel: "",
            competitionPhase: ""
        };
    }

    return {
        route: "club",
        teamKey: null,
        clubKey: "",
        playerKey: "",
        competitionTab: "",
        competitionCategory: "",
        competitionLevel: "",
        competitionPhase: ""
    };
}

export function getPageMetadata(route, currentSeasonLabel = "") {
    if (route === "sync") {
        return {
            title: "Importar datos",
            note: "Carga nuevas fases desde la fuente oficial sin pasar por la terminal.",
            seasonLabel: ""
        };
    }

    if (route === "competition") {
        return {
            title: "Competición",
            note: "Clasificación, resultados y líderes individuales, separados del panel de cada equipo.",
            seasonLabel: currentSeasonLabel
        };
    }

    if (route === "club") {
        return {
            title: "Clubes",
            note: "Vista transversal del club para reunir todos sus equipos por categoria y nivel actual.",
            seasonLabel: currentSeasonLabel
        };
    }

    if (route === "history") {
        return {
            title: "Archivo de equipos",
            note: "Buscador histórico de equipos con el rendimiento separado por temporada.",
            seasonLabel: ""
        };
    }

    if (route === "players") {
        return {
            title: "Jugadoras",
            note: "Buscador histórico de jugadoras con acumulado global y detalle temporada a temporada.",
            seasonLabel: ""
        };
    }

    return {
        title: "Cuaderno de juego",
        note: "Sigue la temporada actual por equipo y por fase, con el detalle de cada partido y una lectura clara de su evolución.",
        seasonLabel: currentSeasonLabel
    };
}
