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

export function buildTeamRoute(teamKey) {
    return `#/team/${encodeURIComponent(teamKey)}`;
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

    const summariesByPhase = new Map();

    (matchSummaries ?? []).forEach((match) => {
        const phaseKey = Number(match.phaseNumber);
        if (!summariesByPhase.has(phaseKey)) {
            summariesByPhase.set(phaseKey, {
                phaseNumber: phaseKey,
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
        .sort((a, b) => a.phaseNumber - b.phaseNumber)
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
