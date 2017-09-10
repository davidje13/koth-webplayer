define(() => {
	'use strict';

	const teamScoreSorter = (a, b) => {
		if(a.disqualified !== b.disqualified) {
			return a.disqualified ? 1 : -1;
		}
		return b.score - a.score;
	};

	const entryScoreSorter = (a, b) => {
		if(a.disqualified !== b.disqualified) {
			return a.disqualified ? 1 : -1;
		}
		return b.score - a.score;
	};

	return {
		score: (config, {teams}) => {
			const gameTeamScores = teams.map((team) => {
				let teamScore = 0;
				let disqualified = true;
				const entries = [];
				team.entries.forEach((entry) => {
					if(!entry.disqualified) {
						disqualified = false;
						teamScore += entry.score;
					}
					entries.push({
						id: entry.id,
						score: entry.score,
						disqualified: entry.disqualified,
					});
				});
				entries.sort(entryScoreSorter);
				return {
					id: team.id,
					disqualified,
					winner: false,
					score: teamScore,
					entries,
				};
			});
			gameTeamScores.sort(teamScoreSorter);

			if(gameTeamScores.length > 0) {
				const bestScore = gameTeamScores[0].score;
				gameTeamScores.forEach((place) => {
					place = (place.score === bestScore);
				});
			}
			return {teams: gameTeamScores};
		},
	};
});
