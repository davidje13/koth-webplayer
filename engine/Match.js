define(['core/EventObject', 'core/array_utils', 'math/Random'], (EventObject, array_utils, Random) => {
	'use strict';

	return class Match extends EventObject {
		constructor() {
			super();

			this.gameHandler = null;
		}

		setGameHandler(handler) {
			this.gameHandler = handler;
		}

		begin({seed = null, entries}) {
			this.seed = Random.makeRandomSeedFrom(seed, 'M');

			const random = new Random(this.seed);

			// TODO: abstractions

			const gameCount = 4;
			const games = [];
			for(let i = 0; i < gameCount; ++ i) {
				const gameSeed = random.makeRandomSeed('G');
				const randomShuffle = new Random(random);
				games.push(this.gameHandler(
					gameSeed,
					array_utils.shuffle(entries, randomShuffle)
				));
			}
			Promise.all(games).then((allScores) => {
				this.trigger('complete', [allScores]);
			});
		}
	};
});
