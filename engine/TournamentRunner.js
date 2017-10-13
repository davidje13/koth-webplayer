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

	const begin = (structure, progressCallback, parentDisplay, info) => {
		const runner = new structure.runner(structure.args);
		let display = null;
		if(structure.display) {
			display = structure.display(parentDisplay, info);
		}
		if(structure.sub) {
			runner.setSubHandler((subInfo, subProgress) => {
				return begin(structure.sub, subProgress, display, {
					seed: structure.sub.seedPrefix + subInfo.seed,
					teams: subInfo.teams,
					index: subInfo.index,
				});
			});
		}
		const scorer = (scores) => structure.scorer.score(info.teams, scores);
		return runner.begin(
			info.seed,
			info.teams,
			(progress, scores) => {
				const aggScores = scorer(scores);
				if(display && display.updateProgress) {
					display.updateProgress(progress, aggScores);
				}
				if(progressCallback) {
					progressCallback(progress, aggScores);
				}
			}
		).then(scorer);
	};

	return class TournamentRunner {
		constructor(structure) {
			this.structure = structure;
		}

		begin(seed, teams, progressCallback = null) {
			return begin(this.structure, progressCallback, null, {
				seed,
				teams,
				index: 0,
			});
		}

		randomGame(seed, teams) {
			return randomGame(seed, teams, this.structure);
		}
	};
});
