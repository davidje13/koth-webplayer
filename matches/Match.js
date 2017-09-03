define([
	'core/EventObject',
	'math/Random',
], (
	EventObject,
	Random
) => {
	'use strict';

	return class Match extends EventObject {
		constructor() {
			super();

			this.subHandler = null;
			this.seed = null;
		}

		setSubHandler(handler) {
			this.subHandler = handler;
		}

		getSeed() {
			return this.seed;
		}

		run() {
			throw new Error('Override this method');
		}

		begin(seed, teams) {
			this.seed = seed;
			return this.run(new Random(this.seed), teams);
		}
	};
});
