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

	// TODO: this is almost identical to tournament mode "single_match"
	// - seems concept of matches and tournaments could be replaced with a
	//   nested matches concept (how to handle configuration & defaults?)

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

	return class Match extends EventObject {
		constructor({
			gameCount = 4,
			gameTeamLimit = null,
			gameTeamShuffle = 'random',
			gameEntryShuffle = 'random',
		}) {
			super();

			this.gameCount = gameCount;
			this.gameTeamLimit = gameTeamLimit;
			this.gameTeamShuffle = gameTeamShuffle;
			this.gameEntryShuffle = gameEntryShuffle;

			this.gameHandler = null;
			this.seed = null;
		}

		setGameHandler(handler) {
			this.gameHandler = handler;
		}

		getSeed() {
			return this.seed;
		}

		begin({seed = null, teams}) {
			this.seed = Random.makeRandomSeedFrom(seed, 'M');

			const random = new Random(this.seed);

			const games = [];
			for(let index = 0; index < this.gameCount; ++ index) {
				const gameSeed = random.makeRandomSeed('G');
				/* jshint -W083 */
				const gameTeams = teams.map((team) => {
					return Object.assign({}, team, {
						entries: applyShuffle(
							this.gameEntryShuffle,
							team.entries,
							{index, random}
						),
					});
				});
				const shuffledGameTeams = applyShuffle(
					this.gameTeamShuffle,
					gameTeams,
					{index, random}
				);
				if(this.gameTeamLimit && this.gameTeamLimit < shuffledGameTeams.length) {
					shuffledGameTeams.length = this.gameTeamLimit;
				}
				games.push(this.gameHandler(
					gameSeed,
					shuffledGameTeams,
					games.length
				));
			}
			return Promise.all(games).then((gameScores) => {
				// TODO: should score aggregation happen here?
				this.trigger('complete', [gameScores]);
			});
		}
	};
});
