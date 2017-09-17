define(() => {
	'use strict';

	const teamScoreSorter = (a, b) => {
		if(a.disqualified !== b.disqualified) {
			return a.disqualified ? 1 : -1;
		}
		if(b.score !== a.score) {
			return b.score - a.score;
		}
		if(b.alive !== a.alive) {
			return b.alive - a.alive;
		}
		return b.kills - a.kills;
	};

	const entryScoreSorter = (a, b) => {
		if(a.disqualified !== b.disqualified) {
			return a.disqualified ? 1 : -1;
		}
		if(b.score !== a.score) {
			return b.score - a.score;
		}
		if(b.alive !== a.alive) {
			return b.alive ? 1 : -1;
		}
		return b.kills - a.kills;
	};

	return {
		score: (config, {teams}) => {
			const gameTeamScores = teams.map((team) => {
				let teamScore = 0;
				let teamAlive = 0;
				let teamKills = 0;
				let disqualified = true;
				const entries = [];
				team.entries.forEach((entry) => {
					if(!entry.disqualified) {
						disqualified = false;
						teamScore += entry.score;
						if(entry.alive) {
							++ teamAlive;
						}
					}
					teamKills += entry.kills;
					entries.push({
						id: entry.id,
						alive: entry.alive,
						score: entry.score,
						kills: entry.kills,
						disqualified: entry.disqualified,
					});
				});
				entries.sort(entryScoreSorter);
				return {
					id: team.id,
					disqualified,
					winner: false,
					score: teamScore,
					alive: teamAlive,
					kills: teamKills,
					entries,
				};
			});
			gameTeamScores.sort(teamScoreSorter);

			if(gameTeamScores.length > 0) {
				const bestScore = gameTeamScores[0].score;
				gameTeamScores.forEach((place) => {
					place.winner = (place.score === bestScore);
				});
			}
			return {teams: gameTeamScores};
		},
	};
});
