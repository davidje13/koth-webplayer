define(['math/Random'], (Random) => {
	'use strict';

	function average(list) {
		return list.reduce((a, b) => (a + b)) / list.length;
	}

	class SimpleSubgameManager {
		constructor(subHandler, progressCallback) {
			this.subHandler = subHandler;
			this.subPromises = [];
			this.subProgs = [];
			this.subScores = [];
			this.progressFn = (index, subProgress, subScore) => {
				this.subProgs[index] = subProgress;
				this.subScores[index] = subScore;
				progressCallback(average(this.subProgs), this.subScores);
			};
		}

		add(seed, teams) {
			const index = this.subPromises.length;
			this.subPromises.push(this.subHandler(
				{seed, teams, index},
				(progress, score) => this.progressFn(index, progress, score)
			));
			this.subProgs.push(0);
			this.subScores.push(null);
		}

		promise() {
			return Promise.all(this.subPromises);
		}
	}

	class Match {
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

		begin(seed, teams, progressCallback) {
			this.seed = seed;
			return this.run(
				new Random(this.seed),
				teams,
				this.subHandler,
				progressCallback
			);
		}

		getRandomSub(seed, teams) {
			const all = [];
			const random = new Random(seed);
			this.run(
				random,
				teams,
				(subInfo) => {
					all.push(subInfo);
					return [];
				},
				() => {}
			);
			if(!all.length) {
				return {seed: '', teams: [], index: 0};
			}
			return all[random.next(all.length)];
		}
	}

	Match.SimpleSubgameManager = SimpleSubgameManager;

	return Match;
});
