define(['core/EventObject', 'core/array_utils', 'math/Random'], (EventObject, array_utils, Random) => {
	'use strict';

	return class Match extends EventObject {
		constructor(gameCount) {
			super();

			this.gameCount = gameCount;

			this.gameHandler = null;
			this.seed = null;
		}

		setGameHandler(handler) {
			this.gameHandler = handler;
		}

		getSeed() {
			return this.seed;
		}

		begin({seed = null, teams}) {
			this.seed = Random.makeRandomSeedFrom(seed, 'M');

			const random = new Random(this.seed);

			// TODO:
			// * abstractions (alternative match types)
			// * support creation of games without all competitors

			const games = [];
			for(let i = 0; i < this.gameCount; ++ i) {
				const gameSeed = random.makeRandomSeed('G');
				const randomShuffle = new Random(random);
				// TODO: shuffle entries in teams too?
				games.push(this.gameHandler(
					gameSeed,
					array_utils.shuffle(teams, randomShuffle)
				));
			}
			Promise.all(games).then((gameScores) => {
				this.trigger('complete', [gameScores]);
			});
		}
	};
});
