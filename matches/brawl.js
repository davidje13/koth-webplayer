define([
	'./Match',
	'core/arrayUtils',
	'math/Random',
], (
	Match,
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

	return class extends Match {
		constructor({
			count = 1,
			teamLimit = null,
			teamShuffle = 'random',
			entryShuffle = 'random',
		}) {
			super();

			this.count = count;
			this.teamLimit = teamLimit;
			this.teamShuffle = teamShuffle;
			this.entryShuffle = entryShuffle;
		}

		run(random, teams) {
			const subs = [];
			for(let index = 0; index < this.count; ++ index) {
				const subSeed = random.makeRandomSeed();
				/* jshint -W083 */
				const subTeams = teams.map((team) => {
					return Object.assign({}, team, {
						entries: applyShuffle(
							this.entryShuffle,
							team.entries,
							{index, random}
						),
					});
				});
				const shuffledSubTeams = applyShuffle(
					this.teamShuffle,
					subTeams,
					{index, random}
				);
				if(this.teamLimit && this.teamLimit < shuffledSubTeams.length) {
					shuffledSubTeams.length = this.teamLimit;
				}
				subs.push(this.subHandler(
					subSeed,
					shuffledSubTeams,
					subs.length
				));
			}
			return Promise.all(subs).then((subScores) => {
				// TODO: should score aggregation happen here?
				this.trigger('complete', [subScores]);
			});
		}
	};
});
