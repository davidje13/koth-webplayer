define(['./Match'], (Match) => {
	'use strict';

	function buildSubs(teams, current, begin, remaining, subHandler) {
		if(!remaining) {
			subHandler(current.slice());
			return;
		}
		for(let i = begin; i < teams.length; ++ i) {
			current.push(teams[i]);
			buildSubs(teams, current, i + 1, remaining - 1, subHandler);
			current.pop();
		}
	}

	return class extends Match {
		constructor({teamLimit = 2}) {
			super();

			this.teamLimit = teamLimit;
		}

		run(random, teams) {
			if(teams.length <= this.teamLimit) {
				return this.subHandler(
					random.makeRandomSeed(),
					teams,
					0
				).then((subScore) => this.trigger('complete', [[subScore]]));
			}

			const subs = [];
			buildSubs(
				teams,
				[],
				0,
				this.teamLimit,
				(chosenTeams) => {
					subs.push(this.subHandler(
						random.makeRandomSeed(),
						chosenTeams,
						subs.length
					));
				}
			);
			return Promise.all(subs).then((subScores) => {
				// TODO: should score aggregation happen here?
				this.trigger('complete', [subScores]);
			});
		}
	};
});
