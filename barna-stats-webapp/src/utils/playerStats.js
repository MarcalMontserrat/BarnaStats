export function getPlayersList(players) {
    return [...new Set(players.map((player) => player.playerName))]
        .sort((a, b) => a.localeCompare(b, "es"));
}

export function getChartData(players, selectedPlayer, selectedPhase) {
    return players
        .filter((row) => row.playerName === selectedPlayer)
        .sort((a, b) => {
            if (a.phaseNumber !== b.phaseNumber) {
                return a.phaseNumber - b.phaseNumber;
            }

            if (a.phaseRound !== b.phaseRound) {
                return a.phaseRound - b.phaseRound;
            }

            return a.matchWebId - b.matchWebId;
        })
        .map((row) => ({
            match: selectedPhase
                ? `J${row.phaseRound ?? "-"}`
                : `F${row.phaseNumber ?? "-"} · J${row.phaseRound ?? "-"}`,
            matchId: row.matchWebId,
            points: Number(row.points),
            valuation: Number(row.valuation)
        }));
}

export function sortPlayers(players) {
    return [...players].sort((a, b) => {
        if (a.matchWebId !== b.matchWebId) {
            return a.matchWebId - b.matchWebId;
        }

        return Number(b.points) - Number(a.points);
    });
}

export function groupPlayersByMatch(players, matchSummaries = []) {
    const summariesByMatch = Object.fromEntries(
        matchSummaries.map((summary) => [summary.matchWebId, summary])
    );

    return Object.values(
        players.reduce((accumulator, player) => {
            if (!accumulator[player.matchWebId]) {
                const summary = summariesByMatch[player.matchWebId];

                accumulator[player.matchWebId] = {
                    matchWebId: player.matchWebId,
                    phaseNumber: summary?.phaseNumber ?? player.phaseNumber ?? null,
                    roundNumber: summary?.roundNumber ?? null,
                    phaseRound: summary?.phaseRound ?? player.phaseRound ?? null,
                    rival: summary?.rivalTeam ?? player.rival,
                    teamScore: summary?.teamScore ?? null,
                    rivalScore: summary?.rivalScore ?? null,
                    isHome: summary?.isHome ?? false,
                    result: summary?.result ?? "",
                    players: []
                };
            }

            accumulator[player.matchWebId].players.push(player);
            return accumulator;
        }, {})
    );
}

export function sortMatches(matches) {
    return [...matches].sort((a, b) => {
        if (a.phaseNumber !== null && b.phaseNumber !== null && a.phaseNumber !== b.phaseNumber) {
            return a.phaseNumber - b.phaseNumber;
        }

        if (a.phaseRound !== null && b.phaseRound !== null && a.phaseRound !== b.phaseRound) {
            return a.phaseRound - b.phaseRound;
        }

        if (a.roundNumber !== null && b.roundNumber !== null && a.roundNumber !== b.roundNumber) {
            return a.roundNumber - b.roundNumber;
        }

        return a.matchWebId - b.matchWebId;
    });
}

export function getVisibleMatches(matches, selectedMatch) {
    return selectedMatch
        ? matches.filter((match) => String(match.matchWebId) === String(selectedMatch))
        : matches;
}

export function buildPlayersArray(players) {
    const totalsByPlayer = {};

    players.forEach((player) => {
        if (!totalsByPlayer[player.playerName]) {
            totalsByPlayer[player.playerName] = {
                points: 0,
                valuation: 0,
                games: 0
            };
        }

        totalsByPlayer[player.playerName].points += Number(player.points);
        totalsByPlayer[player.playerName].valuation += Number(player.valuation);
        totalsByPlayer[player.playerName].games += 1;
    });

    return Object.entries(totalsByPlayer).map(([name, stats]) => ({
        name,
        ...stats,
        avgPoints: stats.games > 0 ? stats.points / stats.games : 0,
        avgVal: stats.games > 0 ? stats.valuation / stats.games : 0
    }));
}

export function getTopScorer(playersArray) {
    return [...playersArray].sort((a, b) => b.points - a.points)[0];
}

export function getMvp(playersArray) {
    return [...playersArray].sort((a, b) => b.valuation - a.valuation)[0];
}

export function getTeamAverage(players) {
    if (players.length === 0) {
        return 0;
    }

    const matchesPlayed = new Set(players.map((player) => player.matchWebId)).size;
    if (matchesPlayed === 0) {
        return 0;
    }

    return players.reduce((sum, player) => sum + Number(player.points), 0) / matchesPlayed;
}
