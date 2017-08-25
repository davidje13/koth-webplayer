define(['core/EventObject', 'core/array_utils', 'math/Random'], (EventObject, array_utils, Random) => {
	'use strict';

	const SHUFFLES = {
		none: (list, index, random) => list,
		random: (list, index, random) => {
			return array_utils.shuffle(list, new Random(random));
		},
		roundRobin: (list, index, random) => {
			return list.map((item, i) => list[(i + index) % list.length]);
		},
	};

	return class Tournament extends EventObject {
		constructor({
			matchCount = 1,
			matchTeamLimit = null,
			matchTeamShuffle = 'random',
			matchEntryShuffle = 'random',
		}) {
			super();

			this.matchCount = matchCount;
			this.matchTeamLimit = matchTeamLimit;
			this.matchTeamShuffle = matchTeamShuffle;
			this.matchEntryShuffle = matchEntryShuffle;

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

			const matches = [];
			for(let i = 0; i < this.matchCount; ++ i) {
				const matchSeed = random.makeRandomSeed('M');
				const matchTeams = teams.map((team) => {
					return Object.assign({}, team, {
						entries: SHUFFLES[this.matchEntryShuffle](team.entries, i, random),
					});
				});
				const shuffledMatchTeams = SHUFFLES[this.matchTeamShuffle](matchTeams, i, random);
				if(this.matchTeamLimit && this.matchTeamLimit < shuffledMatchTeams.length) {
					shuffledMatchTeams.length = this.matchTeamLimit;
				}
				matches.push(this.matchHandler(
					matchSeed,
					shuffledMatchTeams,
					matches.length
				));
			}
			return Promise.all(matches).then((matchScores) => {
				// TODO: should score aggregation happen here?
				this.trigger('complete', [matchScores]);
			});
		}
	};
});
