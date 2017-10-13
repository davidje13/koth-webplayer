define(['./Match'], (Match) => {
	'use strict';

	return class extends Match {
		constructor({teamLimit = 2}) {
			super();

			this.teamLimit = teamLimit;
		}

		run(random, teams, subHandler, progressCallback) {
			const subs = new Match.SimpleSubgameManager(
				subHandler,
				progressCallback
			);

			if(teams.length <= this.teamLimit) {
				subs.add(random.makeRandomSeed(), teams);
				return subs.promise();
			}

			const current = [];
			function buildSubs(begin, remaining) {
				if(remaining <= 0) {
					subs.add(random.makeRandomSeed(), current.slice());
					return;
				}
				for(let i = begin; i < teams.length; ++ i) {
					current.push(teams[i]);
					buildSubs(i + 1, remaining - 1);
					current.pop();
				}
			}

			buildSubs(0, this.teamLimit);
			return subs.promise();
		}
	};
});
