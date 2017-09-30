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
		constructor(scorer, {teamLimit = 2}) {
			super(scorer);

			this.teamLimit = teamLimit;
		}

		run(random, teams, subHandler) {
			if(teams.length <= this.teamLimit) {
				return subHandler(
					random.makeRandomSeed(),
					teams,
					0
				).then((subScore) => [subScore]);
			}

			const subs = [];
			buildSubs(
				teams,
				[],
				0,
				this.teamLimit,
				(chosenTeams) => {
					subs.push(subHandler(
						random.makeRandomSeed(),
						chosenTeams,
						subs.length
					));
				}
			);
			return Promise.all(subs);
		}
	};
});
