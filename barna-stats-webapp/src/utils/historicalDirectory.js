import {buildStandings, normalizeTeamName} from "./analysisDerived.js";

function normalizeSearchValue(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}

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

function buildTeamEntityKey(team) {
    const externalId = Number(team?.teamIdExtern ?? 0);
    if (externalId > 0) {
        return `TEAM:${externalId}`;
    }

    return `NAME:${normalizeTeamName(team?.teamName ?? "")}`;
}

function buildRecord(matches, teamKey) {
    return (matches ?? []).reduce((accumulator, match) => {
        const isHome = match.homeTeamKey === teamKey;
        const teamScore = isHome ? Number(match.homeScore ?? 0) : Number(match.awayScore ?? 0);
        const rivalScore = isHome ? Number(match.awayScore ?? 0) : Number(match.homeScore ?? 0);

        if (teamScore > rivalScore) {
            accumulator.wins += 1;
        } else if (teamScore < rivalScore) {
            accumulator.losses += 1;
        } else {
            accumulator.ties += 1;
        }

        accumulator.pointsFor += teamScore;
        accumulator.pointsAgainst += rivalScore;
        return accumulator;
    }, {
        wins: 0,
        losses: 0,
        ties: 0,
        pointsFor: 0,
        pointsAgainst: 0
    });
}

function compareSeasonsDesc(left, right) {
    const yearDelta = Number(right?.seasonStartYear ?? 0) - Number(left?.seasonStartYear ?? 0);
    if (yearDelta !== 0) {
        return yearDelta;
    }

    return String(right?.seasonLabel ?? "").localeCompare(String(left?.seasonLabel ?? ""), "es");
}

export function buildHistoricalTeamEntities(seasonDatasets) {
    const entities = new Map();

    (seasonDatasets ?? []).forEach((seasonDataset) => {
        const analysis = seasonDataset?.analysis ?? {};
        const competition = seasonDataset?.competition ?? {};

        (analysis?.teams ?? []).forEach((team) => {
            const entityKey = buildTeamEntityKey(team);
            if (!entities.has(entityKey)) {
                entities.set(entityKey, {
                    key: entityKey,
                    label: team.teamName ?? "",
                    latestSeasonLabel: team.seasonLabel ?? "",
                    searchTerms: new Set(),
                    categories: new Set(),
                    levels: new Set(),
                    seasonSummaries: []
                });
            }

            const entity = entities.get(entityKey);
            entity.searchTerms.add(team.teamName ?? "");

            const relevantMatches = (competition?.matches ?? []).filter((match) =>
                match.homeTeamKey === team.teamKey || match.awayTeamKey === team.teamKey
            );
            const record = buildRecord(relevantMatches, team.teamKey);
            const totalValuation = (competition?.playerLeaders ?? [])
                .filter((player) => player.teamKey === team.teamKey)
                .reduce((sum, player) => sum + Number(player.valuation ?? 0), 0);
            const phaseContext = [...(team.phases ?? [])].sort((a, b) => Number(a.phaseNumber ?? 0) - Number(b.phaseNumber ?? 0));
            const latestPhase = phaseContext[phaseContext.length - 1] ?? phaseContext[0] ?? null;
            const categoryName = String(latestPhase?.categoryName ?? "").trim();
            const levelName = String(latestPhase?.levelName ?? "").trim() || String(latestPhase?.levelCode ?? "").trim();
            const standingsMatches = filterMatchesByPhaseScopes(
                competition?.matches ?? [],
                team.phases ?? [],
                categoryName
            );
            const standingsRow = buildStandings(standingsMatches, null)
                .find((row) => row.teamKey === team.teamKey) ?? null;

            if (categoryName) {
                entity.categories.add(categoryName);
            }

            if (levelName) {
                entity.levels.add(levelName);
            }

            if (compareSeasonsDesc(
                {seasonStartYear: team.seasonStartYear, seasonLabel: team.seasonLabel},
                {seasonStartYear: seasonDataset?.latestSeasonStartYear, seasonLabel: entity.latestSeasonLabel}
            ) < 0) {
                entity.label = team.teamName ?? entity.label;
                entity.latestSeasonLabel = team.seasonLabel ?? entity.latestSeasonLabel;
            }

            entity.seasonSummaries.push({
                key: `${entityKey}:${team.seasonLabel}`,
                seasonStartYear: team.seasonStartYear ?? null,
                seasonLabel: team.seasonLabel ?? "",
                teamName: team.teamName ?? "",
                categoryName,
                levelName,
                matchesPlayed: Number(team.matchesPlayed ?? relevantMatches.length ?? 0),
                playersCount: Number(team.playersCount ?? 0),
                pointsFor: record.pointsFor,
                pointsAgainst: record.pointsAgainst,
                pointDiff: record.pointsFor - record.pointsAgainst,
                wins: record.wins,
                losses: record.losses,
                ties: record.ties,
                standingPosition: standingsRow?.position ?? null,
                avgValuation: Number(team.matchesPlayed ?? 0) > 0
                    ? totalValuation / Number(team.matchesPlayed ?? 0)
                    : 0
            });
        });
    });

    return [...entities.values()]
        .map((entity) => {
            const seasonSummaries = [...entity.seasonSummaries].sort(compareSeasonsDesc);
            const latestSeason = seasonSummaries[0] ?? null;
            const metaParts = [];

            if (seasonSummaries.length > 0) {
                metaParts.push(`${seasonSummaries.length} temporada${seasonSummaries.length === 1 ? "" : "s"}`);
            }

            if (latestSeason?.categoryName) {
                metaParts.push(latestSeason.categoryName);
            }

            if (latestSeason?.levelName) {
                metaParts.push(latestSeason.levelName);
            }

            return {
                key: entity.key,
                label: latestSeason?.teamName || entity.label,
                meta: metaParts.join(" · "),
                searchText: [...entity.searchTerms, ...entity.categories, ...entity.levels].join(" "),
                seasonSummaries
            };
        })
        .sort((left, right) => left.label.localeCompare(right.label, "es"));
}

function resolvePlayerEntityKey(player) {
    if (player?.playerIdentityKey) {
        return String(player.playerIdentityKey);
    }

    if (player?.playerUuid) {
        return `UUID:${String(player.playerUuid).trim().toLowerCase()}`;
    }

    if (Number(player?.playerActorId ?? 0) > 0) {
        return `PLAYER:${Number(player.playerActorId)}`;
    }

    return `NAME:${normalizeSearchValue(player?.playerName ?? "")}`;
}

export function buildHistoricalPlayerEntities(seasonDatasets) {
    const entities = new Map();

    (seasonDatasets ?? []).forEach((seasonDataset) => {
        const competition = seasonDataset?.competition ?? {};

        (competition?.playerLeaders ?? []).forEach((player) => {
            const entityKey = resolvePlayerEntityKey(player);
            if (!entities.has(entityKey)) {
                entities.set(entityKey, {
                    key: entityKey,
                    label: player.playerName ?? "",
                    searchTerms: new Set(),
                    seasonMap: new Map()
                });
            }

            const entity = entities.get(entityKey);
            entity.searchTerms.add(player.playerName ?? "");
            entity.searchTerms.add(player.teamName ?? "");

            const seasonKey = player.seasonLabel ?? "";
            if (!entity.seasonMap.has(seasonKey)) {
                entity.seasonMap.set(seasonKey, {
                    seasonStartYear: player.seasonStartYear ?? null,
                    seasonLabel: player.seasonLabel ?? "",
                    playerName: player.playerName ?? "",
                    games: 0,
                    points: 0,
                    valuation: 0,
                    minutes: 0,
                    teams: new Map()
                });
            }

            const seasonSummary = entity.seasonMap.get(seasonKey);
            seasonSummary.games += Number(player.games ?? 0);
            seasonSummary.points += Number(player.points ?? 0);
            seasonSummary.valuation += Number(player.valuation ?? 0);
            seasonSummary.minutes += Number(player.minutes ?? 0);
            seasonSummary.playerName = player.playerName ?? seasonSummary.playerName;

            const currentTeam = seasonSummary.teams.get(player.teamKey) ?? {
                teamKey: player.teamKey ?? "",
                teamName: player.teamName ?? "",
                games: 0
            };
            currentTeam.games += Number(player.games ?? 0);
            seasonSummary.teams.set(player.teamKey, currentTeam);
        });
    });

    return [...entities.values()]
        .map((entity) => {
            const seasonSummaries = [...entity.seasonMap.values()]
                .map((seasonSummary) => {
                    const teams = [...seasonSummary.teams.values()]
                        .sort((left, right) => right.games - left.games || left.teamName.localeCompare(right.teamName, "es"));
                    const teamNames = teams.map((team) => team.teamName);

                    return {
                        key: `${entity.key}:${seasonSummary.seasonLabel}`,
                        seasonStartYear: seasonSummary.seasonStartYear,
                        seasonLabel: seasonSummary.seasonLabel,
                        playerName: seasonSummary.playerName,
                        games: seasonSummary.games,
                        points: seasonSummary.points,
                        valuation: seasonSummary.valuation,
                        minutes: seasonSummary.minutes,
                        avgPoints: seasonSummary.games > 0 ? seasonSummary.points / seasonSummary.games : 0,
                        avgValuation: seasonSummary.games > 0 ? seasonSummary.valuation / seasonSummary.games : 0,
                        avgMinutes: seasonSummary.games > 0 ? seasonSummary.minutes / seasonSummary.games : 0,
                        teamNames,
                        primaryTeamName: teamNames[0] ?? "",
                        primaryTeamKey: teams[0]?.teamKey ?? ""
                    };
                })
                .sort(compareSeasonsDesc);

            const totalGames = seasonSummaries.reduce((sum, season) => sum + season.games, 0);
            const totalPoints = seasonSummaries.reduce((sum, season) => sum + season.points, 0);
            const totalValuation = seasonSummaries.reduce((sum, season) => sum + season.valuation, 0);
            const totalMinutes = seasonSummaries.reduce((sum, season) => sum + season.minutes, 0);
            const latestSeason = seasonSummaries[0] ?? null;
            const metaParts = [];

            if (seasonSummaries.length > 0) {
                metaParts.push(`${seasonSummaries.length} temporada${seasonSummaries.length === 1 ? "" : "s"}`);
            }

            if (latestSeason?.primaryTeamName) {
                metaParts.push(latestSeason.primaryTeamName);
            }

            return {
                key: entity.key,
                label: latestSeason?.playerName || entity.label,
                meta: metaParts.join(" · "),
                searchText: [...entity.searchTerms].join(" "),
                totals: {
                    seasons: seasonSummaries.length,
                    games: totalGames,
                    points: totalPoints,
                    valuation: totalValuation,
                    minutes: totalMinutes,
                    avgPoints: totalGames > 0 ? totalPoints / totalGames : 0,
                    avgValuation: totalGames > 0 ? totalValuation / totalGames : 0,
                    avgMinutes: totalGames > 0 ? totalMinutes / totalGames : 0
                },
                seasonSummaries
            };
        })
        .sort((left, right) => left.label.localeCompare(right.label, "es"));
}
