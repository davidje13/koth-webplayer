define(['core/EventObject', 'math/Random'], (EventObject, Random) => {
	'use strict';

	return class Tournament extends EventObject {
		constructor() {
			super();
		}

		setMatchHandler(handler) {
			// TODO
		}

		begin({seed = null, entries}) {
			this.seed = Random.makeRandomSeedFrom(seed, 'T');
			// TODO
		}
	};
});
