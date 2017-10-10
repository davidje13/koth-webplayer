define(() => {
	'use strict';

	const randomGame = (seed, teams, structure) => {
		if(!structure.sub) {
			return {seed, teams};
		}
		const runner = new structure.runner(structure.args);
		const subProps = runner.getRandomSub(seed, teams);
		return randomGame(
			(structure.sub.seedPrefix || '') + subProps.seed,
			subProps.teams,
			structure.sub
		);
	};

	const begin = (seed, teams, index, parentDisplay, structure) => {
		const runner = new structure.runner(structure.args);
		let display = null;
		if(structure.display) {
			display = structure.display({
				seed,
				teams,
				index,
				parentDisplay,
				runner,
				scorer: structure.scorer,
				args: structure.args,
			});
		}
		if(structure.sub) {
			runner.setSubHandler((subSeed, subTeams, subIndex) => {
				return begin(
					structure.sub.seedPrefix + subSeed,
					subTeams,
					subIndex,
					display,
					structure.sub
				);
			});
		}
		return runner.begin(seed, teams).then((scores) => {
			if(!structure.scorer) {
				return scores;
			}
			return structure.scorer.score(teams, scores);
		});
	};

	return class TournamentRunner {
		constructor(structure) {
			this.structure = structure;
		}

		begin(seed, teams) {
			return begin(seed, teams, 0, null, this.structure);
		}

		randomGame(seed, teams) {
			return randomGame(seed, teams, this.structure);
		}
	};
});
