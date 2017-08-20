define(['core/EventObject', 'math/Random'], (EventObject, Random) => {
	'use strict';

	return class Match extends EventObject {
		constructor() {
			super();
		}

		setGameHandler(handler) {
			// TODO
		}

		begin({seed = null, entries}) {
			this.seed = Random.makeRandomSeedFrom(seed, 'M');
			// TODO
		}
	};
});
