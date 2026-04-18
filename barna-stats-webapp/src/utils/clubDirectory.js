import {buildCompetitionPhaseLabel, buildStandings, normalizeTeamName} from "./analysisDerived.js";
import {getClubBrandingForTeam} from "./clubBranding.js";

function buildPhaseScopeKey(row) {
    const sourcePhaseId = Number(row?.sourcePhaseId ?? 0);
    const seasonLabel = String(row?.seasonLabel ?? "").trim();
    if (sourcePhaseId > 0) {
        return `source:${seasonLabel}:${sourcePhaseId}`;
    }

    const phaseNumber = Number(row?.phaseNumber ?? 0);
    const categoryName = String(row?.categoryName ?? "").trim();
    const levelKey = String(row?.levelCode ?? "").trim() || String(row?.levelName ?? "").trim();
    const groupCode = String(row?.groupCode ?? "").trim();
    const phaseName = String(row?.phaseName ?? "").trim();

    return `phase:${seasonLabel}|${phaseNumber}|${categoryName}|${levelKey}|${groupCode}|${phaseName}`;
}

function filterMatchesByPhaseScopes(matches, phases, fallbackCategoryName = "") {
    const scopeKeys = new Set((phases ?? []).map((phase) => buildPhaseScopeKey(phase)));
    if (scopeKeys.size > 0) {
        return (matches ?? []).filter((match) => scopeKeys.has(buildPhaseScopeKey(match)));
    }

    return (matches ?? []).filter((match) => {
        if (!fallbackCategoryName) {
            return true;
        }

        return String(match?.categoryName ?? "").trim() === fallbackCategoryName;
    });
}

function buildTeamRecord(matches, teamKey) {
    return (matches ?? []).reduce((record, match) => {
        const isHome = match.homeTeamKey === teamKey;
        const teamScore = isHome ? Number(match.homeScore ?? 0) : Number(match.awayScore ?? 0);
        const rivalScore = isHome ? Number(match.awayScore ?? 0) : Number(match.homeScore ?? 0);

        if (teamScore > rivalScore) {
            record.wins += 1;
        } else if (teamScore < rivalScore) {
            record.losses += 1;
        } else {
            record.ties += 1;
        }

        record.pointsFor += teamScore;
        record.pointsAgainst += rivalScore;
        return record;
    }, {
        wins: 0,
        losses: 0,
        ties: 0,
        pointsFor: 0,
        pointsAgainst: 0
    });
}

function compareLevels(left, right) {
    const leftKey = String(left ?? "").replace(/^nivell\s+/i, "").trim();
    const rightKey = String(right ?? "").replace(/^nivell\s+/i, "").trim();

    if (!leftKey && !rightKey) {
        return 0;
    }

    if (!leftKey) {
        return 1;
    }

    if (!rightKey) {
        return -1;
    }

    return leftKey.localeCompare(rightKey, "es", {numeric: true, sensitivity: "base"});
}

function compareCategoryGroups(left, right) {
    return String(left?.categoryName ?? "").localeCompare(String(right?.categoryName ?? ""), "es");
}

function compareTeamEntries(left, right) {
    const categoryDelta = String(left?.categoryName ?? "").localeCompare(String(right?.categoryName ?? ""), "es");
    if (categoryDelta !== 0) {
        return categoryDelta;
    }

    const levelDelta = compareLevels(left?.levelName || left?.levelKey, right?.levelName || right?.levelKey);
    if (levelDelta !== 0) {
        return levelDelta;
    }

    const groupDelta = String(left?.groupCode ?? "").localeCompare(String(right?.groupCode ?? ""), "es", {
        numeric: true,
        sensitivity: "base"
    });
    if (groupDelta !== 0) {
        return groupDelta;
    }

    return String(left?.teamName ?? "").localeCompare(String(right?.teamName ?? ""), "es");
}

function finalizeCategoryGroups(teamEntries) {
    const groups = new Map();

    for (const team of teamEntries) {
        const categoryName = String(team.categoryName ?? "").trim() || "Sin categoria visible";
        const levelKey = String(team.levelKey ?? "").trim() || "__no-level__";

        if (!groups.has(categoryName)) {
            groups.set(categoryName, {
                categoryName,
                levels: new Map()
            });
        }

        const category = groups.get(categoryName);
        if (!category.levels.has(levelKey)) {
            category.levels.set(levelKey, {
                levelKey,
                levelName: team.levelName || "Sin nivel visible",
                teams: []
            });
        }

        category.levels.get(levelKey).teams.push(team);
    }

    return [...groups.values()]
        .map((category) => ({
            categoryName: category.categoryName,
            levels: [...category.levels.values()]
                .map((level) => ({
                    ...level,
                    teams: [...level.teams].sort(compareTeamEntries)
                }))
                .sort((left, right) => compareLevels(left.levelName || left.levelKey, right.levelName || right.levelKey))
        }))
        .sort(compareCategoryGroups);
}

export function buildCurrentClubEntities(teams, competition = {}) {
    const matches = competition?.matches ?? [];
    const playerLeaders = competition?.playerLeaders ?? [];
    const entities = new Map();

    for (const team of teams ?? []) {
        const clubBranding = getClubBrandingForTeam(team.teamIdExtern, team.teamName);
        if (!clubBranding?.clubKey) {
            continue;
        }

        if (!entities.has(clubBranding.clubKey)) {
            entities.set(clubBranding.clubKey, {
                key: clubBranding.clubKey,
                label: clubBranding.clubName || team.teamName || "",
                shortName: clubBranding.shortName || "",
                clubId: Number(clubBranding.clubId ?? 0),
                primaryTeamIdExtern: Number(team.teamIdExtern ?? 0),
                teamEntries: [],
                searchTerms: new Set([
                    clubBranding.clubName ?? "",
                    clubBranding.shortName ?? ""
                ]),
                categories: new Set(),
                levels: new Set()
            });
        }

        const entity = entities.get(clubBranding.clubKey);
        const relevantMatches = matches.filter((match) =>
            match.homeTeamKey === team.teamKey || match.awayTeamKey === team.teamKey
        );
        const totalValuation = playerLeaders
            .filter((player) => player.teamKey === team.teamKey)
            .reduce((sum, player) => sum + Number(player.valuation ?? 0), 0);
        const phaseContext = [...(team.phases ?? [])]
            .sort((left, right) => {
                if (Number(left.phaseNumber ?? 0) !== Number(right.phaseNumber ?? 0)) {
                    return Number(right.phaseNumber ?? 0) - Number(left.phaseNumber ?? 0);
                }

                return Number(right.sourcePhaseId ?? 0) - Number(left.sourcePhaseId ?? 0);
            });
        const latestPhase = phaseContext[0] ?? null;
        const categoryName = String(latestPhase?.categoryName ?? "").trim();
        const levelKey = String(latestPhase?.levelCode ?? "").trim() || String(latestPhase?.levelName ?? "").trim();
        const levelName = String(latestPhase?.levelName ?? "").trim() || levelKey;
        const standingsMatches = filterMatchesByPhaseScopes(matches, team.phases ?? [], categoryName);
        const standingsRow = buildStandings(standingsMatches, null)
            .find((row) => row.teamKey === team.teamKey) ?? null;
        const record = buildTeamRecord(relevantMatches, team.teamKey);
        const latestPhaseOptionValue = latestPhase?.sourcePhaseId
            ? `source:${latestPhase.sourcePhaseId}`
            : (Number.isFinite(Number(latestPhase?.phaseNumber ?? NaN))
                ? `phase:${latestPhase.phaseNumber}`
                : "all");

        entity.primaryTeamIdExtern = entity.primaryTeamIdExtern || Number(team.teamIdExtern ?? 0);
        entity.searchTerms.add(team.teamName ?? "");
        entity.searchTerms.add(categoryName);
        entity.searchTerms.add(levelName);

        if (categoryName) {
            entity.categories.add(categoryName);
        }

        if (levelName) {
            entity.levels.add(levelName);
        }

        entity.teamEntries.push({
            key: team.teamKey || normalizeTeamName(team.teamName),
            teamKey: team.teamKey ?? "",
            teamIdExtern: Number(team.teamIdExtern ?? 0),
            teamName: team.teamName ?? "",
            matchesPlayed: Number(team.matchesPlayed ?? relevantMatches.length ?? 0),
            playersCount: Number(team.playersCount ?? 0),
            categoryName,
            levelKey,
            levelName,
            phaseLabel: latestPhase ? buildCompetitionPhaseLabel(latestPhase) : "",
            latestPhaseOptionValue,
            groupCode: String(latestPhase?.groupCode ?? "").trim(),
            standingPosition: standingsRow?.position ?? null,
            record,
            pointDiff: record.pointsFor - record.pointsAgainst,
            avgValuation: Number(team.matchesPlayed ?? 0) > 0
                ? totalValuation / Number(team.matchesPlayed ?? 0)
                : 0
        });
    }

    return [...entities.values()]
        .map((entity) => {
            const teamEntries = [...entity.teamEntries].sort(compareTeamEntries);
            const totalMatches = teamEntries.reduce((sum, team) => sum + Number(team.matchesPlayed ?? 0), 0);
            const totalPlayers = teamEntries.reduce((sum, team) => sum + Number(team.playersCount ?? 0), 0);

            return {
                key: entity.key,
                label: entity.label,
                shortName: entity.shortName,
                clubId: entity.clubId,
                primaryTeamIdExtern: entity.primaryTeamIdExtern,
                totalTeams: teamEntries.length,
                totalMatches,
                totalPlayers,
                categoriesCount: entity.categories.size,
                levelsCount: entity.levels.size,
                meta: [
                    `${teamEntries.length} equipo${teamEntries.length === 1 ? "" : "s"}`,
                    entity.categories.size > 0
                        ? `${entity.categories.size} categoria${entity.categories.size === 1 ? "" : "s"}`
                        : "",
                    totalMatches > 0 ? `${totalMatches} partidos` : ""
                ].filter(Boolean).join(" · "),
                searchText: [...entity.searchTerms].filter(Boolean).join(" "),
                teams: teamEntries,
                categories: finalizeCategoryGroups(teamEntries)
            };
        })
        .sort((left, right) => left.label.localeCompare(right.label, "es"));
}
