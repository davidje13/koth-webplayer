define(() => {
	'use strict';

	const scoreSorter = (a, b) => {
		if(a.disqualified !== b.disqualified) {
			return a.disqualified ? 1 : -1;
		}
		if(a.food !== b.food) {
			return b.food - a.food;
		}
		return b.workers - a.workers;
	};

	return {
		score: (config, {teams}) => {
			const gameTeamScores = teams.map((team) => {
				let teamWorkers = 0;
				let food = 0;
				let disqualified = true;
				const entries = [];
				team.entries.forEach((entry) => {
					let entryWorkers = 0;
					entry.workers.forEach((count) => entryWorkers += count);
					if(!entry.disqualified) {
						disqualified = false;
						teamWorkers += entryWorkers;
						food += entry.food;
					}
					entries.push({
						id: entry.id,
						food: entry.food,
						workers: entryWorkers,
						disqualified: entry.disqualified,
					});
				});
				entries.sort(scoreSorter);
				return {
					id: team.id,
					food,
					workers: teamWorkers,
					disqualified,
					winner: false,
					score: 0,
					entries,
				};
			});
			gameTeamScores.sort(scoreSorter);

			// Score = number of teams with food strictly less than current team
			let tiedFood = 0;
			let tiedTeams = 0;
			let accumScore = 0;
			for(let i = gameTeamScores.length; (i --) > 0;) {
				const place = gameTeamScores[i];
				if(place.food !== tiedFood) {
					tiedFood = place.food;
					accumScore += tiedTeams;
					tiedTeams = 0;
				}
				if(!place.disqualified) {
					place.score = accumScore;
				}
				++ tiedTeams;
			}

			// Winners = teams tied for most food
			for(let i = 0; i < gameTeamScores.length; ++ i) {
				const place = gameTeamScores[i];
				if(place.disqualified || place.food < gameTeamScores[0].food) {
					break;
				}
				place.winner = true;
			}

			return {teams: gameTeamScores};
		},
	};
});
