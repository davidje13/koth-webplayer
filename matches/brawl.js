define(['core/EventObject', 'core/array_utils', 'math/Random'], (EventObject, array_utils, Random) => {
	'use strict';

	// TODO: this is almost identical to tournament mode "single_match"
	// - seems concept of matches and tournaments could be replaced with a
	//   nested matches concept (how to handle configuration & defaults?)

	const SHUFFLES = {
		none: (list, index, random) => list,
		random: (list, index, random) => {
			return array_utils.shuffle(list, new Random(random));
		},
		roundRobin: (list, index, random) => {
			return list.map((item, i) => list[(i + index) % list.length]);
		},
	};

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
			for(let i = 0; i < this.gameCount; ++ i) {
				const gameSeed = random.makeRandomSeed('G');
				const gameTeams = teams.map((team) => {
					return Object.assign({}, team, {
						entries: SHUFFLES[this.gameEntryShuffle](team.entries, i, random),
					});
				});
				const shuffledGameTeams = SHUFFLES[this.gameTeamShuffle](gameTeams, i, random);
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
