define(['math/Random'], (Random) => {
	'use strict';

	return class Match {
		constructor() {
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
			return this.run(
				new Random(this.seed),
				teams,
				this.subHandler
			);
		}

		getRandomSub(seed, teams) {
			const all = [];
			const random = new Random(seed);
			this.run(
				random,
				teams,
				(subSeed, subTeams) => {
					all.push({seed: subSeed, teams: subTeams});
					return [];
				}
			);
			if(!all.length) {
				return {seed: '', teams: []};
			}
			return all[random.next(all.length)];
		}
	};
});
