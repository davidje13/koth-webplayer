define(['core/EventObject', 'math/Random'], (EventObject, Random) => {
	'use strict';

	return class Tournament extends EventObject {
		constructor() {
			super();

			this.matchHandler = null;
			this.seed = null;
		}

		setMatchHandler(handler) {
			this.matchHandler = handler;
		}

		getSeed() {
			return this.seed;
		}

		begin({seed = null, entries}) {
			this.seed = Random.makeRandomSeedFrom(seed, 'T');

			const random = new Random(this.seed);

			// TODO:
			// * abstractions
			// * multi-match tournaments (e.g. winner advances)

			const match1 = this.matchHandler(
				random.makeRandomSeed('M'),
				entries
			);
			match1.then((scores) => this.trigger('complete', [scores]));
		}
	};
});
