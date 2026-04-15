export function normalizeTeamName(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toUpperCase()
        .split(/\s+/)
        .filter(Boolean)
        .join(" ");
}

export function buildTeamRoute(teamKey, seasonLabel = "") {
    const path = `#/team/${encodeURIComponent(teamKey)}`;
    if (!seasonLabel) {
        return path;
    }

    const params = new URLSearchParams();
    params.set("season", seasonLabel);
    return `${path}?${params.toString()}`;
}

export function getAllPhaseNumbers(teams) {
    return [...new Set(
        teams.flatMap((team) => (team.matchSummaries ?? []).map((match) => match.phaseNumber))
    )]
        .filter((phase) => Number.isFinite(phase))
        .sort((a, b) => a - b);
}

export function buildUniqueMatches(teams) {
    const keyByName = new Map(
        teams.map((team) => [normalizeTeamName(team.teamName), team.teamKey])
    );
    const uniqueMatches = new Map();

    teams.forEach((team) => {
        (team.matchSummaries ?? []).forEach((summary) => {
            const homeScore = summary.isHome ? Number(summary.teamScore) : Number(summary.rivalScore);
            const awayScore = summary.isHome ? Number(summary.rivalScore) : Number(summary.teamScore);

            uniqueMatches.set(summary.matchWebId, {
                matchWebId: summary.matchWebId,
                matchDate: summary.matchDate,
                phaseNumber: summary.phaseNumber,
                homeTeam: summary.homeTeam,
                awayTeam: summary.awayTeam,
                homeTeamKey: summary.homeTeamKey
                    || keyByName.get(normalizeTeamName(summary.homeTeam))
                    || "",
                awayTeamKey: summary.awayTeamKey
                    || keyByName.get(normalizeTeamName(summary.awayTeam))
                    || "",
                homeScore,
                awayScore
            });
        });
    });

    return [...uniqueMatches.values()].sort((a, b) => {
        const dateA = a.matchDate ? new Date(a.matchDate).getTime() : Number.MAX_SAFE_INTEGER;
        const dateB = b.matchDate ? new Date(b.matchDate).getTime() : Number.MAX_SAFE_INTEGER;

        if (dateA !== dateB) {
            return dateA - dateB;
        }

        return a.matchWebId - b.matchWebId;
    });
}

export function buildStandings(matches, phaseNumber) {
    const rows = new Map();

    matches
        .filter((match) => phaseNumber == null || Number(match.phaseNumber) === Number(phaseNumber))
        .forEach((match) => {
            ensureStandingRow(rows, match.homeTeam, match.homeTeamKey);
            ensureStandingRow(rows, match.awayTeam, match.awayTeamKey);

            const home = rows.get(match.homeTeamKey || normalizeTeamName(match.homeTeam));
            const away = rows.get(match.awayTeamKey || normalizeTeamName(match.awayTeam));

            home.played += 1;
            home.pointsFor += Number(match.homeScore);
            home.pointsAgainst += Number(match.awayScore);

            away.played += 1;
            away.pointsFor += Number(match.awayScore);
            away.pointsAgainst += Number(match.homeScore);

            if (match.homeScore > match.awayScore) {
                home.wins += 1;
                away.losses += 1;
            } else if (match.homeScore < match.awayScore) {
                away.wins += 1;
                home.losses += 1;
            } else {
                home.ties += 1;
                away.ties += 1;
            }
        });

    return [...rows.values()]
        .map((row) => ({
            ...row,
            standingsPoints: (row.wins * 2) + row.losses + row.ties,
            pointDiff: row.pointsFor - row.pointsAgainst,
            winRate: row.played > 0 ? row.wins / row.played : 0
        }))
        .sort((a, b) => {
            if (b.wins !== a.wins) {
                return b.wins - a.wins;
            }

            if (a.losses !== b.losses) {
                return a.losses - b.losses;
            }

            if (b.pointDiff !== a.pointDiff) {
                return b.pointDiff - a.pointDiff;
            }

            if (b.pointsFor !== a.pointsFor) {
                return b.pointsFor - a.pointsFor;
            }

            return a.teamName.localeCompare(b.teamName, "es");
        })
        .map((row, index) => ({
            ...row,
            position: index + 1
        }));
}

export function buildPhaseSummaries(matchSummaries, matchPlayers) {
    const valuationByMatch = (matchPlayers ?? []).reduce((accumulator, player) => {
        accumulator[player.matchWebId] = (accumulator[player.matchWebId] ?? 0) + Number(player.valuation ?? 0);
        return accumulator;
    }, {});
    const phaseNumbersBySource = new Map();

    (matchSummaries ?? []).forEach((match) => {
        const sourcePhaseId = Number(match?.sourcePhaseId ?? 0);
        const phaseNumber = Number(match?.phaseNumber ?? 0);

        if (!Number.isFinite(sourcePhaseId) || sourcePhaseId <= 0) {
            return;
        }

        if (!Number.isFinite(phaseNumber) || phaseNumber <= 0) {
            return;
        }

        if (!phaseNumbersBySource.has(sourcePhaseId)) {
            phaseNumbersBySource.set(sourcePhaseId, new Set());
        }

        phaseNumbersBySource.get(sourcePhaseId).add(phaseNumber);
    });

    const summariesByPhase = new Map();

    (matchSummaries ?? []).forEach((match) => {
        const sourcePhaseId = Number(match.sourcePhaseId ?? 0);
        const phaseNumber = Number(match.phaseNumber ?? 0);
        const isSplitSourcePhase = sourcePhaseId > 0
            && (phaseNumbersBySource.get(sourcePhaseId)?.size ?? 0) > 1;
        const phaseKey = sourcePhaseId > 0
            ? (isSplitSourcePhase ? `source:${sourcePhaseId}:segment:${phaseNumber}` : `source:${sourcePhaseId}`)
            : `phase:${phaseNumber}`;

        if (!summariesByPhase.has(phaseKey)) {
            summariesByPhase.set(phaseKey, {
                phaseKey,
                phaseNumber,
                sourcePhaseId: match.sourcePhaseId ?? null,
                categoryName: match.categoryName ?? "",
                phaseName: match.phaseName ?? "",
                levelName: match.levelName ?? "",
                levelCode: match.levelCode ?? "",
                groupCode: match.groupCode ?? "",
                segmentNumber: isSplitSourcePhase ? phaseNumber : null,
                segmentLabel: isSplitSourcePhase ? `Tramo ${phaseNumber}` : "",
                matches: 0,
                wins: 0,
                losses: 0,
                ties: 0,
                pointsFor: 0,
                pointsAgainst: 0,
                valuation: 0
            });
        }

        const phase = summariesByPhase.get(phaseKey);
        phase.matches += 1;
        phase.pointsFor += Number(match.teamScore);
        phase.pointsAgainst += Number(match.rivalScore);
        phase.valuation += Number(valuationByMatch[match.matchWebId] ?? 0);

        if (match.result === "W") {
            phase.wins += 1;
        } else if (match.result === "L") {
            phase.losses += 1;
        } else {
            phase.ties += 1;
        }
    });

    return [...summariesByPhase.values()]
        .sort((a, b) => {
            if (a.phaseNumber !== b.phaseNumber) {
                return a.phaseNumber - b.phaseNumber;
            }

            return Number(a.sourcePhaseId ?? Number.MAX_SAFE_INTEGER) - Number(b.sourcePhaseId ?? Number.MAX_SAFE_INTEGER);
        })
        .map((phase) => ({
            ...phase,
            avgPointsFor: phase.matches > 0 ? phase.pointsFor / phase.matches : 0,
            avgPointsAgainst: phase.matches > 0 ? phase.pointsAgainst / phase.matches : 0,
            avgValuation: phase.matches > 0 ? phase.valuation / phase.matches : 0,
            pointDiff: phase.pointsFor - phase.pointsAgainst
        }));
}

export function buildPhaseComparison(phaseSummaries) {
    if (!phaseSummaries || phaseSummaries.length < 2) {
        return null;
    }

    const firstPhase = phaseSummaries[0];
    const lastPhase = phaseSummaries[phaseSummaries.length - 1];

    return {
        fromPhase: firstPhase.phaseNumber,
        toPhase: lastPhase.phaseNumber,
        winsDelta: lastPhase.wins - firstPhase.wins,
        avgPointsDelta: lastPhase.avgPointsFor - firstPhase.avgPointsFor,
        avgValuationDelta: lastPhase.avgValuation - firstPhase.avgValuation,
        pointDiffDelta: lastPhase.pointDiff - firstPhase.pointDiff
    };
}

export function sortMatchSummariesChronologically(matchSummaries) {
    return [...(matchSummaries ?? [])].sort((a, b) => {
        const phaseA = Number(a.phaseNumber ?? Number.MAX_SAFE_INTEGER);
        const phaseB = Number(b.phaseNumber ?? Number.MAX_SAFE_INTEGER);
        if (phaseA !== phaseB) {
            return phaseA - phaseB;
        }

        const phaseRoundA = Number(a.phaseRound ?? Number.MAX_SAFE_INTEGER);
        const phaseRoundB = Number(b.phaseRound ?? Number.MAX_SAFE_INTEGER);
        if (phaseRoundA !== phaseRoundB) {
            return phaseRoundA - phaseRoundB;
        }

        const roundA = Number(a.roundNumber ?? Number.MAX_SAFE_INTEGER);
        const roundB = Number(b.roundNumber ?? Number.MAX_SAFE_INTEGER);
        if (roundA !== roundB) {
            return roundA - roundB;
        }

        const dateA = a.matchDate ? new Date(a.matchDate).getTime() : Number.MAX_SAFE_INTEGER;
        const dateB = b.matchDate ? new Date(b.matchDate).getTime() : Number.MAX_SAFE_INTEGER;
        if (dateA !== dateB) {
            return dateA - dateB;
        }

        return Number(a.matchWebId ?? 0) - Number(b.matchWebId ?? 0);
    });
}

export function buildTeamRecord(matchSummaries) {
    return (matchSummaries ?? []).reduce((record, match) => {
        record.matches += 1;
        record.pointsFor += Number(match.teamScore ?? 0);
        record.pointsAgainst += Number(match.rivalScore ?? 0);

        if (match.result === "W") {
            record.wins += 1;
        } else if (match.result === "L") {
            record.losses += 1;
        } else {
            record.ties += 1;
        }

        return record;
    }, {
        matches: 0,
        wins: 0,
        losses: 0,
        ties: 0,
        pointsFor: 0,
        pointsAgainst: 0
    });
}

export function getLongestWinStreak(matchSummaries) {
    let longest = 0;
    let current = 0;

    sortMatchSummariesChronologically(matchSummaries).forEach((match) => {
        if (match.result === "W") {
            current += 1;
            longest = Math.max(longest, current);
            return;
        }

        current = 0;
    });

    return longest;
}

export function buildCompetitionPhaseLabel(phase, options = {}) {
    const {includeCategory = false} = options;
    const phaseName = String(phase?.phaseName ?? "").trim() || `Fase ${phase?.phaseNumber ?? "-"}`;
    const segmentLabel = String(phase?.segmentLabel ?? "").trim();
    const levelName = String(phase?.levelName ?? "").trim();
    const groupCode = String(phase?.groupCode ?? "").trim();
    const extras = [
        segmentLabel,
        levelName,
        groupCode ? `Grupo ${groupCode}` : ""
    ].filter(Boolean);
    const baseLabel = extras.length > 0
        ? `${phaseName} · ${extras.join(" · ")}`
        : phaseName;
    const categoryName = String(phase?.categoryName ?? "").trim();

    return includeCategory && categoryName
        ? `${categoryName} · ${baseLabel}`
        : baseLabel;
}

export function buildCompetitionPhaseOptions(phases) {
    const options = new Map();

    (phases ?? []).forEach((phase) => {
        const value = phase?.sourcePhaseId
            ? `source:${phase.sourcePhaseId}`
            : `phase:${phase.phaseNumber}`;

        if (options.has(value)) {
            return;
        }

        options.set(value, {
            value,
            phaseNumber: Number(phase?.phaseNumber ?? 0),
            sourcePhaseId: phase?.sourcePhaseId ?? null,
            categoryName: phase?.categoryName ?? "",
            phaseName: phase?.phaseName ?? "",
            levelName: phase?.levelName ?? "",
            levelCode: phase?.levelCode ?? "",
            groupCode: phase?.groupCode ?? "",
            label: buildCompetitionPhaseLabel(phase)
        });
    });

    return [...options.values()].sort(comparePhaseDisplayOrder);
}

export function buildTeamPhaseOptions(phases, levelValue = "all") {
    const filteredPhases = filterRowsByLevel(phases ?? [], levelValue);
    return buildCompetitionPhaseOptions(filteredPhases);
}

export function filterRowsByPhaseOption(rows, phaseOptionValue) {
    if (!phaseOptionValue || phaseOptionValue === "all") {
        return rows ?? [];
    }

    if (String(phaseOptionValue).startsWith("source:")) {
        const sourcePhaseId = Number(String(phaseOptionValue).slice("source:".length));
        return (rows ?? []).filter((row) => Number(row.sourcePhaseId) === sourcePhaseId);
    }

    if (String(phaseOptionValue).startsWith("phase:")) {
        const phaseNumber = Number(String(phaseOptionValue).slice("phase:".length));
        return (rows ?? []).filter((row) => Number(row.phaseNumber) === phaseNumber);
    }

    return rows ?? [];
}

export function filterCompetitionMatchesByPhaseOption(matches, phaseOptionValue) {
    return filterRowsByPhaseOption(matches, phaseOptionValue);
}

export function buildLatestTeamContextByKey(teams) {
    const contexts = new Map();

    (teams ?? []).forEach((team) => {
        const latestContext = [...(team.phases ?? [])]
            .filter((phase) => phase.levelName || phase.groupCode || phase.phaseName || phase.categoryName)
            .sort((a, b) => {
                if (Number(a.phaseNumber) !== Number(b.phaseNumber)) {
                    return Number(b.phaseNumber) - Number(a.phaseNumber);
                }

                return Number(b.sourcePhaseId ?? 0) - Number(a.sourcePhaseId ?? 0);
            })[0];

        if (!latestContext) {
            return;
        }

        contexts.set(team.teamKey, {
            phaseNumber: latestContext.phaseNumber,
            sourcePhaseId: latestContext.sourcePhaseId ?? null,
            categoryName: latestContext.categoryName ?? "",
            phaseName: latestContext.phaseName ?? "",
            levelName: latestContext.levelName ?? "",
            levelCode: latestContext.levelCode ?? "",
            groupCode: latestContext.groupCode ?? "",
            label: buildCompetitionPhaseLabel(latestContext)
        });
    });

    return contexts;
}

export function buildLevelOptions(teamContexts) {
    const options = new Map();

    [...(teamContexts?.values?.() ?? [])].forEach((context) => {
        const value = String(context?.levelCode ?? "").trim() || String(context?.levelName ?? "").trim();
        const label = String(context?.levelName ?? "").trim() || value;

        if (!value || !label || options.has(value)) {
            return;
        }

        options.set(value, {value, label});
    });

    return [...options.values()].sort((a, b) => a.label.localeCompare(b.label, "es"));
}

export function buildLevelOptionsFromRows(rows) {
    const options = new Map();

    (rows ?? []).forEach((row) => {
        const value = getLevelValue(row);
        const label = String(row?.levelName ?? "").trim() || value;

        if (!value || !label || options.has(value)) {
            return;
        }

        options.set(value, {value, label});
    });

    return [...options.values()].sort((a, b) => a.label.localeCompare(b.label, "es"));
}

export function buildCategoryOptionsFromRows(rows) {
    const options = new Map();

    (rows ?? []).forEach((row) => {
        const value = String(row?.categoryName ?? "").trim();

        if (!value || options.has(value)) {
            return;
        }

        options.set(value, {value, label: value});
    });

    return [...options.values()].sort((a, b) => a.label.localeCompare(b.label, "es"));
}

export function buildCategoryOptions(teamContexts) {
    return buildCategoryOptionsFromRows([...(teamContexts?.values?.() ?? [])]);
}

export function filterRowsByCategory(rows, categoryValue) {
    if (!categoryValue || categoryValue === "all") {
        return rows ?? [];
    }

    return (rows ?? []).filter((row) => String(row?.categoryName ?? "").trim() === String(categoryValue));
}

export function filterRowsByLevel(rows, levelValue) {
    if (!levelValue || levelValue === "all") {
        return rows ?? [];
    }

    return (rows ?? []).filter((row) => getLevelValue(row) === String(levelValue));
}

function getLevelValue(row) {
    return String(row?.levelCode ?? "").trim() || String(row?.levelName ?? "").trim();
}

function comparePhaseDisplayOrder(a, b) {
    const phaseDelta = Number(a?.phaseNumber ?? Number.MAX_SAFE_INTEGER) - Number(b?.phaseNumber ?? Number.MAX_SAFE_INTEGER);
    if (phaseDelta !== 0) {
        return phaseDelta;
    }

    const levelDelta = compareLevelKeys(getLevelSortKey(a), getLevelSortKey(b));
    if (levelDelta !== 0) {
        return levelDelta;
    }

    const groupDelta = compareGroupCodes(a?.groupCode, b?.groupCode);
    if (groupDelta !== 0) {
        return groupDelta;
    }

    return Number(a?.sourcePhaseId ?? Number.MAX_SAFE_INTEGER) - Number(b?.sourcePhaseId ?? Number.MAX_SAFE_INTEGER);
}

function getLevelSortKey(row) {
    const levelCode = String(row?.levelCode ?? "").trim();
    if (levelCode) {
        return levelCode;
    }

    return String(row?.levelName ?? "")
        .replace(/^nivell\s+/i, "")
        .trim();
}

function compareLevelKeys(a, b) {
    const left = String(a ?? "").trim();
    const right = String(b ?? "").trim();

    if (!left && !right) {
        return 0;
    }

    if (!left) {
        return 1;
    }

    if (!right) {
        return -1;
    }

    return left.localeCompare(right, "es", {numeric: true, sensitivity: "base"});
}

function compareGroupCodes(a, b) {
    const left = String(a ?? "").trim();
    const right = String(b ?? "").trim();

    if (!left && !right) {
        return 0;
    }

    if (!left) {
        return 1;
    }

    if (!right) {
        return -1;
    }

    return left.localeCompare(right, "es", {numeric: true, sensitivity: "base"});
}

function ensureStandingRow(rows, teamName, teamKey) {
    const resolvedKey = teamKey || normalizeTeamName(teamName);

    if (!rows.has(resolvedKey)) {
        rows.set(resolvedKey, {
            teamKey: resolvedKey,
            teamName,
            played: 0,
            wins: 0,
            losses: 0,
            ties: 0,
            pointsFor: 0,
            pointsAgainst: 0
        });
    }
}
