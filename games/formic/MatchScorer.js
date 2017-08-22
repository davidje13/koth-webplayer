define(() => {
	'use strict';

	return {
		score: (entries, gameScores) => {
			const scoreLookup = new Map();
			const scores = entries.map((entry) => {
				const o = {
					id: entry.id,
					winner: false,
					score: 0,
				};
				scoreLookup.set(entry.id, o);
				return o;
			});
			gameScores.forEach((scores) => {
				scores.forEach((result) => {
					scoreLookup.get(result.id).score += result.score;
				});
			});
			scores.sort((a, b) => b.score - a.score);

			if(scores.length > 0) {
				const bestScore = scores[0].score;
				scores.forEach((score) => {
					if(score.score === bestScore) {
						score.winner = true;
					}
				});
			}
			return scores;
		},
	};
});
