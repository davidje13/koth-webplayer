define([
	'core/EventObject',
	'core/arrayUtils',
	'math/Random',
], (
	EventObject,
	arrayUtils,
	Random
) => {
	'use strict';

	const SHUFFLES = {
		none: (list) => list,
		random: (list, {random}) => {
			return arrayUtils.shuffle(list, new Random(random));
		},
		roundRobin: (list, {index}) => {
			return list.map((item, i) => list[(i + index) % list.length]);
		},
	};

	function applyShuffle(type, list, details) {
		return SHUFFLES[type](list, details);
	}

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
			for(let index = 0; index < this.matchCount; ++ index) {
				const matchSeed = random.makeRandomSeed('M');
				/* jshint -W083 */
				const matchTeams = teams.map((team) => {
					return Object.assign({}, team, {
						entries: applyShuffle(
							this.matchEntryShuffle,
							team.entries,
							{index, random}
						),
					});
				});
				const shuffledMatchTeams = applyShuffle(
					this.matchTeamShuffle,
					matchTeams,
					{index, random}
				);
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
