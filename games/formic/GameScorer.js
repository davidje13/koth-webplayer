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
		if(a.active !== b.active) {
			return a.active ? -1 : 1;
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
				let active = false;
				const entries = [];
				team.entries.forEach((entry) => {
					let entryWorkers = 0;
					entry.workers.forEach((count) => entryWorkers += count);
					teamWorkers += entryWorkers;
					food += entry.food;
					if(entry.active) {
						active = true;
					}
					entries.push({
						id: entry.id,
						food: entry.food,
						workers: entryWorkers,
						active: entry.active,
					});
				});
				entries.sort(scoreSorter);
				return {
					id: team.id,
					food,
					workers: teamWorkers,
					active,
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
				if(place.active && place.food > 0) {
					place.winner = (tiedPos === 0);
					place.score = SCORING[tiedPos];
				}
			}
			return {teams: gameTeamScores};
		},
	};
});
