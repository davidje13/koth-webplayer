define(() => {
	'use strict';

	const scoreSorter = (a, b) => b.score - a.score;

	return {
		score: (teams, gameScores) => {
			const teamLookup = new Map();
			const entryLookup = new Map();
			const matchTeamScores = teams.map((team) => {
				const o = {
					id: team.id,
					winner: false,
					total: 0,
					score: 0,
					games: 0,
					entries: team.entries.map((entry) => {
						const o = {
							id: entry.id,
							total: 0,
							score: 0,
							games: 0,
						};
						entryLookup.set(entry.id, o);
						return o;
					}),
				};
				teamLookup.set(team.id, o);
				return o;
			});
			gameScores.forEach((gameScore) => {
				gameScore.teams.forEach((gameTeamScore) => {
					const teamItem = teamLookup.get(gameTeamScore.id);
					teamItem.total += gameTeamScore.score;
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
			});

			if(matchTeamScores.length > 0) {
				const bestScore = matchTeamScores[0].score;
				matchTeamScores.forEach((matchTeamScore) => {
					if(matchTeamScore.score === bestScore) {
						matchTeamScore.winner = true;
					}
				});
			}
			return {teams: matchTeamScores};
		},
	};
});
