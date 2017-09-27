define(() => {
	'use strict';

	const teamScoreSorter = (a, b) => {
		if(a.disqualified !== b.disqualified) {
			return a.disqualified ? 1 : -1;
		}
		if(b.points !== a.points) {
			return b.points - a.points;
		}
		if(b.deaths !== a.deaths) {
			return a.deaths - b.deaths;
		}
		if(b.kills !== a.kills) {
			return b.kills - a.kills;
		}
		return b.missiles - a.missiles;
	};

	const entryScoreSorter = (a, b) => {
		if(a.disqualified !== b.disqualified) {
			return a.disqualified ? 1 : -1;
		}
		if(b.points !== a.points) {
			return b.points - a.points;
		}
		if(b.deaths !== a.deaths) {
			return a.deaths - b.deaths;
		}
		if(b.kills !== a.kills) {
			return b.kills - a.kills;
		}
		return b.missiles - a.missiles;
	};

	return {
		score: (config, {teams}) => {
			const gameTeamScores = teams.map((team) => {
				let teamPoints = 0;
				let teamKills = 0;
				let teamDeaths = 0;
				let teamMissiles = 0;
				let disqualified = true;
				const entries = [];
				team.entries.forEach((entry) => {
					if(!entry.disqualified) {
						disqualified = false;
						teamPoints += entry.score;
						teamKills += entry.kills;
						teamMissiles += entry.missiles;
					}
					teamDeaths += entry.deaths;
					entries.push({
						id: entry.id,
						points: entry.score,
						kills: entry.kills,
						deaths: entry.deaths,
						missiles: entry.missiles,
						disqualified: entry.disqualified,
					});
				});
				entries.sort(entryScoreSorter);
				return {
					id: team.id,
					disqualified,
					winner: false,
					score: 0,
					points: teamPoints,
					kills: teamKills,
					deaths: teamDeaths,
					missiles: teamMissiles,
					entries,
				};
			});
			gameTeamScores.sort(teamScoreSorter);

			if(gameTeamScores.length > 0) {
				const bestPoints = gameTeamScores[0].points;
				gameTeamScores.forEach((place) => {
					if(place.points === bestPoints && !place.disqualified) {
						place.winner = true;
						place.score = 1;
					}
				});
			}
			return {teams: gameTeamScores};
		},
	};
});
