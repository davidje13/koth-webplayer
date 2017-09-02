define(() => {
	'use strict';

	const scoreSorter = (a, b) => b.score - a.score;

	function ksTest(sortedResults1, sortedResults2) {
		// Thanks, https://en.wikipedia.org/wiki/Kolmogorov%E2%80%93Smirnov_test
		const l1 = sortedResults1.length;
		const l2 = sortedResults2.length;
		if(l1 + l2 === 0) {
			return 1;
		}
		const all = sortedResults1.concat(sortedResults2).sort();
		let v = null;
		let p1 = 0;
		let p2 = 0;
		let maxDiff2 = 0;
		for(let i = 0; i < all.length; ++ i) {
			if(all[i] !== v) {
				v = all[i];
			}
			while(p1 < l1 && sortedResults1[p1] === v) {
				++ p1;
			}
			while(p2 < l2 && sortedResults2[p2] === v) {
				++ p2;
			}
			const diff = (p1 / l1) - (p2 / l2);
			maxDiff2 = Math.max(maxDiff2, diff * diff);
		}

		return Math.min(Math.exp(-2 * maxDiff2 * (l1 * l2) / (l1 + l2)) * 2, 1);
	}

	return {
		score: (teams, gameScores) => {
			const teamLookup = new Map();
			const entryLookup = new Map();
			const matchTeamScores = teams.map((team) => {
				const teamAgg = {
					id: team.id,
					winner: false,
					total: 0,
					score: 0,
					allScores: [],
					certainty: null,
					games: 0,
					entries: team.entries.map((entry) => {
						const entryAgg = {
							id: entry.id,
							total: 0,
							score: 0,
							games: 0,
						};
						entryLookup.set(entry.id, entryAgg);
						return entryAgg;
					}),
				};
				teamLookup.set(team.id, teamAgg);
				return teamAgg;
			});
			gameScores.forEach((gameScore) => {
				gameScore.teams.forEach((gameTeamScore) => {
					const teamItem = teamLookup.get(gameTeamScore.id);
					teamItem.total += gameTeamScore.score;
					teamItem.allScores.push(gameTeamScore.score);
					++ teamItem.games;
					gameTeamScore.entries.forEach((gameEntryScore) => {
						const entryItem = entryLookup.get(gameEntryScore.id);
						entryItem.total += gameEntryScore.score;
						++ entryItem.games;
					});
				});
			});
			teamLookup.forEach((teamItem) => {
				if(teamItem.games > 0) {
					teamItem.score = teamItem.total / teamItem.games;
				}
			});
			entryLookup.forEach((entryItem) => {
				if(entryItem.games > 0) {
					entryItem.score = entryItem.total / entryItem.games;
				}
			});

			matchTeamScores.sort(scoreSorter);
			matchTeamScores.forEach((teamScore) => {
				teamScore.entries.sort(scoreSorter);
				teamScore.allScores.sort();
			});

			if(matchTeamScores.length > 0) {
				const bestScore = matchTeamScores[0].score;
				matchTeamScores.forEach((matchTeamScore, index) => {
					if(matchTeamScore.score === bestScore) {
						matchTeamScore.winner = true;
					}
					if(index < matchTeamScores.length - 1) {
						matchTeamScore.certainty = 1 - ksTest(
							matchTeamScore.allScores,
							matchTeamScores[index + 1].allScores
						);
					}
				});
			}
			return {teams: matchTeamScores};
		},
	};
});
