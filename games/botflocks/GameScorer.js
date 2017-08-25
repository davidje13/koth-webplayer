define(() => {
	'use strict';

	const SCORING = [1, 0];

	const teamScoreSorter = (a, b) => {
		if(a.disqualified !== b.disqualified) {
			return a.disqualified ? 1 : -1;
		}
		return b.points - a.points;
	};

	const entryScoreSorter = (a, b) => {
		if(a.disqualified !== b.disqualified) {
			return a.disqualified ? 1 : -1;
		}
		return b.points - a.points;
	};

	return {
		score: (config, {teams}) => {
			const gameTeamScores = teams.map((team) => {
				let teamPoints = 0;
				let disqualified = true;
				const entries = [];
				team.entries.forEach((entry) => {
					if(!entry.disqualified) {
						disqualified = false;
						teamPoints += entry.points;
					}
					entries.push({
						id: entry.id,
						points: entry.points,
						disqualified: entry.disqualified,
					});
				});
				entries.sort(entryScoreSorter);
				return {
					id: team.id,
					points: teamPoints,
					disqualified,
					winner: false,
					score: 0,
					entries,
				};
			});
			gameTeamScores.sort(teamScoreSorter);

			let tiedPos = 0;
			let tiedPoints = 0;
			for(let i = 0; i < gameTeamScores.length; ++ i) {
				const place = gameTeamScores[i];
				if(place.points !== tiedPoints) {
					tiedPos = i;
					tiedPoints = place.points;
				}
				let score = 0;
				if(!place.disqualified && place.points > 0) {
					place.winner = (tiedPos === 0);
					place.score = SCORING[tiedPos];
				}
			}
			return {teams: gameTeamScores};
		},
	};
});
