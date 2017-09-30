define([
	'core/EventObject',
	'math/Random',
], (
	EventObject,
	Random
) => {
	'use strict';

	return class Match extends EventObject {
		constructor(scorer) {
			super();

			this.subHandler = null;
			this.seed = null;
			this.scorer = scorer;
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
			).then((scores) => {
				this.trigger('complete', [
					this.scorer ? this.scorer.score(teams, scores) : null,
					scores,
				]);
			});
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
