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
					score: 0,
					entries: team.entries.map((entry) => {
						const o = {
							id: entry.id,
							score: 0,
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
					teamLookup.get(gameTeamScore.id).score += gameTeamScore.score;
					gameTeamScore.entries.forEach((gameEntryScore) => {
						entryLookup.get(gameEntryScore.id).score += gameEntryScore.score;
					});
				});
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
