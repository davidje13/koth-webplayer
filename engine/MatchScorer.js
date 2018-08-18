define(['math/statistics'], (statistics) => {
	'use strict';

	const scoreSorter = (a, b) => b.score - a.score;

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
					disqualified: false,
					error: false,
					entries: team.entries.map((entry) => {
						const entryAgg = {
							id: entry.id,
							total: 0,
							score: 0,
							games: 0,
							disqualified: false,
							error: false,
						};
						entryLookup.set(entry.id, entryAgg);
						return entryAgg;
					}),
				};
				teamLookup.set(team.id, teamAgg);
				return teamAgg;
			});
			gameScores.forEach((gameScore) => {
				if(!gameScore) {
					return;
				}
				gameScore.teams.forEach((gameTeamScore) => {
					const teamItem = teamLookup.get(gameTeamScore.id);
					if (teamItem !== undefined) { //Because sometimes things derp up
						teamItem.total += gameTeamScore.score;
						teamItem.allScores.push(gameTeamScore.score);
						teamItem.games++;
						gameTeamScore.entries.forEach((gameEntryScore) => {
							const entryItem = entryLookup.get(gameEntryScore.id);
							entryItem.total += gameEntryScore.score;
							++ entryItem.games;
							if (gameEntryScore.disqualified) {
								entryItem.disqualified = true;
							}
						});
						if (teamItem.entries.every((teamEntryScore)=>teamEntryScore.disqualified)) {
							teamItem.disqualified = true;
						}
						if (teamItem.entries.every((teamEntryScore)=>teamEntryScore.error)) {
							teamItem.error = true;
						}
					} else {
						throw new Error({expected: gameScore.teams, actual: teams});
					}
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
			});

			if(matchTeamScores.length > 0) {
				const bestScore = matchTeamScores[0].score;
				matchTeamScores.forEach((matchTeamScore, index) => {
					if(matchTeamScore.score === bestScore) {
						matchTeamScore.winner = true;
					}
					if(index < matchTeamScores.length - 1) {
						matchTeamScore.certainty = 1 - statistics.mwTest(
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
