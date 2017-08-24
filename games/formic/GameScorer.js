define(() => {
	'use strict';

	const SCORING = [
		15,
		14,
		13,
		12,
		11,
		10,
		9,
		8,
		7,
		6,
		5,
		4,
		3,
		2,
		1,
	];

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
					teamWorkers += entryWorkers;
					food += entry.food;
					if(!entry.disqualified) {
						disqualified = false;
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

			let tiedPos = 0;
			let tiedFood = 0;
			for(let i = 0; i < gameTeamScores.length; ++ i) {
				const place = gameTeamScores[i];
				if(place.food !== tiedFood) {
					tiedPos = i;
					tiedFood = place.food;
				}
				let score = 0;
				if(!place.disqualified && place.food > 0) {
					place.winner = (tiedPos === 0);
					place.score = SCORING[tiedPos];
				}
			}
			return {teams: gameTeamScores};
		},
	};
});
