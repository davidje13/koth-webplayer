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

	return {
		score: (config, state) => {
			const scores = state.entries.map((entry) => {
				let totalWorkers = 0;
				entry.workers.forEach((count) => totalWorkers += count);
				return {
					id: entry.id,
					food: entry.food,
					workers: totalWorkers,
					active: entry.active,
					winner: false,
					score: 0,
				};
			});
			scores.sort((a, b) => {
				if(a.active !== b.active) {
					return a.active ? -1 : 1;
				}
				if(a.food !== b.food) {
					return b.food - a.food;
				}
				return b.workers - a.workers;
			});

			let tiedPos = 0;
			let tiedFood = 0;
			for(let i = 0; i < scores.length; ++ i) {
				const place = scores[i];
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
			return scores;
		},
	};
});
