define(['core/EventObject', 'core/array_utils', 'math/Random'], (EventObject, array_utils, Random) => {
	'use strict';

	return class Match extends EventObject {
		constructor(gameCount) {
			super();

			this.gameCount = gameCount;

			this.gameHandler = null;
		}

		setGameHandler(handler) {
			this.gameHandler = handler;
		}

		begin({seed = null, entries}) {
			this.seed = Random.makeRandomSeedFrom(seed, 'M');

			const random = new Random(this.seed);

			// TODO:
			// * abstractions (alternative match types)
			// * support creation of games without all competitors

			const games = [];
			for(let i = 0; i < this.gameCount; ++ i) {
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
