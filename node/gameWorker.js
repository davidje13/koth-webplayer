define([
	'fetch/entryUtils',
	'math/Random',
], (
	entryUtils,
	Random
) => {
	'use strict';
	/* globals process */

	return (GameManager) => {
		let game = null;
		let time0 = null;
		let refuseReason = null;
		let dqReact = null;
		let errReact = null;

		//Return true if the game should be abandoned
		function isGameBad(teams) {
			//Check game configuration
			let dqCheck = ['excise', 'teardown'].includes(dqReact);
			let errCheck = ['excise', 'teardown'].includes(errReact);
			if (teams.some((team) => (
				team.entries.some((entry) => (
					(dqCheck && entry.disqualified) ||
					(errCheck && entry.error)
				))
			))) {
				return true;
			}
			//No? Then check that there exist at least 2 participating teams
			let teamCount = 0;
			teams.forEach((team) => {
				if (team.entries.some((entry) => (
					(dqReact === 'ignore' || !entry.disqualified) &&
					(errReact === 'ignore' || !entry.error)
				))) {
					teamCount++;
				}
			});
			return teamCount <= 1; //Is bad if 1 or fewer teams are good
		}

		function isTeamsBad(teams) {
			if (teams.some((team) => (
				team.entries.some((entry) => (
					(dqReact === 'teardown' && entry.disqualified) ||
					(errReact === 'teardown' && entry.error)
				))
			))) {
				return true;
			}
			let teamCount = 0;
			teams.forEach((team) => {
				if (team.entries.some((entry) => (
					(dqReact === 'ignore' || !entry.disqualified) &&
					(errReact === 'ignore' || !entry.error)
				))) {
					teamCount++;
				}
			});
			return teamCount <= 1; //Is bad if 1 or fewer teams are good
		}

		function sendState() {
			//We're in Node, so lop off some state we don't need or want
			const now = Date.now();
			const state = game.getState();
			if (isTeamsBad(state.teams)) {
				sendRefusal('Game torn down');
				return false;
			} else {
				process.send({
					action: 'STEP_COMPLETE',
					state: {
						teams: state.teams,
						frame: state.frame,
						over: state.over,
						progress: state.progress,
						simulationTime: state.simulationTime,
						realWorldTime: now - time0,
					},
				});
				return true;
			}
		}

		function sendIncomplete() {
			//We're in Node, so lop off some state we don't need or want
			const now = Date.now();
			const state = game.getState();
			if (isTeamsBad(state.teams)) {
				sendRefusal('Game torn down');
				return false;
			} else {
				process.send({
					action: 'STEP_INCOMPLETE',
					state: {
						teams: state.teams,
						frame: state.frame,
						over: state.over,
						progress: state.progress,
						simulationTime: state.simulationTime,
						realWorldTime: now - time0,
					},
				});
				return !state.over;
			}
		}

		function sendRefusal(reason) {
			const now = Date.now();
			const state = game.getState();
			//We're in Node, so lop off some state we don't need or want
			refuseReason = reason;
			process.send({
				action: 'STEP_COMPLETE',
				reason: refuseReason,
				state: {
					teams: state.teams,
					frame: state.frame,
					over: true,
					progress: 1,
					simulationTime: state.simulationTime,
					realWorldTime: now - time0,
				},
			});
		}

		function begin(config, checkbackTime, dqReaction, errReaction) {
			/* jshint maxdepth: 6 */
			if(game || refuseReason) {
				throw new Error('Please reset game worker first');
			}
			time0 = Date.now();
			dqReact = dqReaction;
			errReact = errReaction;
			game = new GameManager(new Random(config.seed), config);
			//I consider this a hack, but it's hard to figure out a better way
			if (isGameBad(config.teams)) {
				sendRefusal('Participating teams are bad');
			} else if (config.hasOwnProperty('startFrame') && config.startFrame > 0) {
				let prevLim = Math.floor(Date.now()/checkbackTime)*checkbackTime;
				let limit = checkbackTime ? prevLim + checkbackTime : 0;
				for(let i = 0; (i < config.startFrame) && !game.isOver(); ++ i) {
					game.step(null);
					if(limit && Date.now() >= limit) {
						let estLim = Math.floor(Date.now()/checkbackTime)*checkbackTime;
						limit = estLim + checkbackTime;
						if (!sendIncomplete()) {
							return;
						}
					}
				}
				sendState();
			} else {
				sendState();
			}
		}

		function step({checkbackTime, steps, type}) {
			/* jshint maxdepth: 6 */
			if (refuseReason !== null) {
				sendRefusal(refuseReason);
			} else {
				let prevLim = Math.floor(Date.now()/checkbackTime)*checkbackTime;
				let limit = checkbackTime ? prevLim + checkbackTime : 0;
				for(let i = 0; (steps < 0 || i < steps) && !game.isOver(); ++ i) {
					game.step(type);
					//if (game.getState().frame % 100 === 0) console.log(game.getState().frame);
					if(limit && Date.now() >= limit) {
						let estLim = Math.floor(Date.now()/checkbackTime)*checkbackTime;
						limit = estLim + checkbackTime;
						if (!sendIncomplete()) {
							return;
						}
					}
				}
				sendState();
			}
		}

		process.on('message', (data) => {
			switch(data.action) {
			case 'BEGIN':
				begin(
					data.config,
					data.checkbackTime,
					data.disqualifyReaction,
					data.errorReaction
				);
				break;

			case 'STEP':
				step(data);
				break;

			case 'END':
				if (game !== null || refuseReason !== null) {
					game = null;
					time0 = null;
					refuseReason = null;
					entryUtils.disposeEnvs();
				} else {
					throw new Error('Game was already ended');
				}
				break;
			}
		});
	};
});
