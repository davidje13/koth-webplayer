define(['core/EventObject', 'math/Random'], (EventObject, Random) => {
	'use strict';

	function buildMatches(teams, current, begin, remaining, matchHandler) {
		if(!remaining) {
			matchHandler(current.slice());
			return;
		}
		for(let i = begin; i < teams.length; ++ i) {
			current.push(teams[i]);
			buildMatches(teams, current, i + 1, remaining - 1, matchHandler);
			current.pop();
		}
	}

	return class Tournament extends EventObject {
		constructor({matchTeamLimit = 2}) {
			super();

			this.matchTeamLimit = matchTeamLimit;

			this.matchHandler = null;
			this.seed = null;
		}

		setMatchHandler(handler) {
			this.matchHandler = handler;
		}

		getSeed() {
			return this.seed;
		}

		begin({seed = null, teams}) {
			this.seed = Random.makeRandomSeedFrom(seed, 'T');

			const random = new Random(this.seed);

			if(teams.length <= this.matchTeamLimit) {
				return this.matchHandler(
					random.makeRandomSeed('M'),
					teams,
					0
				).then((matchScore) => this.trigger('complete', [[matchScore]]));
			}

			const matches = [];
			buildMatches(
				teams,
				[],
				0,
				this.matchTeamLimit,
				(chosenTeams) => {
					matches.push(this.matchHandler(
						random.makeRandomSeed('M'),
						chosenTeams,
						matches.length
					));
				}
			);
			return Promise.all(matches).then((matchScores) => {
				// TODO: should score aggregation happen here?
				this.trigger('complete', [matchScores]);
			});
		}
	};
});
