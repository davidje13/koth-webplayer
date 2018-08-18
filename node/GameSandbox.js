define([
	'node/ProcessWorker',
	'node/nodeUtils',
	'core/EventObject',
	'node/logger',
], (
	ProcessWorker,
	nodeUtils,
	EventObject,
	logger
) => {
	'use strict';

	class GameStepper{
		constructor(token, pathGameManager, playConfig, gameConfig, eventReceiver) {
			this.playConfig = playConfig;
			this.token = token;
			this.timeout = null;
			this.eventReceiver = eventReceiver;
			this.teamEntries = new Set();
			this.gameEntriesInfo = new Map();
			for (let team of gameConfig.teams) {
				this.teamEntries.add(team.id);
				for (let entry of team.entries) {
					this.gameEntriesInfo.set(entry.id, entry);
				}
			}
			this.stage = 0;

			this._advance = this._advance.bind(this);
			this._handleMessage = this._handleMessage.bind(this);

			this.gameWorker = ProcessWorker.make({game: pathGameManager});
			this.gameWorker.addEventListener('message', this._handleMessage);

			this.waiting = true;
			this.lastStartStep = Date.now();
			this.stage = 1;
			this.gameWorker.postMessage({
				action: 'BEGIN',
				config: gameConfig,
				checkbackTime: playConfig.checkbackTime,
				disqualifyReaction: this.eventReceiver.disqualifyReaction,
				errorReaction: this.eventReceiver.errorReaction,
			});
			this.stage = 2;
			this.logHandle = logger.topLevel.openHandle('sandbox');
			this.logHandle.log(this.teamEntries, 'info');
			this.knownDisqualified = [];
			this.knownErrors = [];
		}

		checkEntryDisqualification(teamArray) {
			for (let team of teamArray) {
				for (let entry of team.entries) {
					if (entry.disqualified && this.knownDisqualified.indexOf(entry.id) < 0) {
						this.knownDisqualified.push(entry.id);
						//Perciptate to an entity that knows how to disqualify entries
						this.eventReceiver.trigger('message', [{
							action: 'DISQUALIFIED',
							entryInfo: this.gameEntriesInfo.get(entry.id),
							entryError: entry,
							token: this.token,
						}]);
					}
					if (entry.error && this.knownErrors.indexOf(entry.id) < 0) {
						this.knownErrors.push(entry.id);
						//Perciptate to an entity that knows how to disqualify entries
						this.eventReceiver.trigger('message', [{
							action: 'DISQUALIFIED',
							entryInfo: this.gameEntriesInfo.get(entry.id),
							entryError: entry,
							token: this.token,
						}]);
					}
				}
			}
		}

		//Returns an array of possibilities
		findCorrespondingEntries(buildHash, srcHash) {
			let entryArray = [...this.gameEntriesInfo.entries()];
			return entryArray.filter((entry) =>
				entry[1].codeBlocks.some((block) => (
					nodeUtils.hashBlock(block) === buildHash ||
					nodeUtils.hashBlock(block) === srcHash
				))
			).map((validEnt) => validEnt[0]);
		}

		sendRenderState(state) {
			this.eventReceiver.trigger('message', [{
				action: 'RENDER',
				token: this.token,
				state: state,
				pauseTriggered: false,
			}]);
		}

		teamsMatch(sentTeams) {
			return sentTeams.map((team) => team.id).every((ent) => (
				this.teamEntries.has(ent)
			));
		}

		sendBadState(data) {
			if(!data.state.over) {
				this.logHandle.log(
					'Game progress lost due to mismatched teams',
					'warn'
				);
				this._advanceDelayed(true);
				this.sendRenderState(Object.assign(data.state, {
					teams: data.state.teams.filter((team)=>(
						this.teamEntries.has(team.id)
					)),
				}));
			} else {
				this.logHandle.log(
					'Game ending lost due to mismatched teams',
					'warn'
				);
				this.eventReceiver.trigger('message', [{
					action: 'DISCONNECTED',
					token: this.token,
				}]);
			}

		}

		_handleMessage(data) {
			switch(data.action) {
			case 'STEP_COMPLETE':
				if (data.hasOwnProperty('reason')) {
					this.logHandle.log(data.reason, 'warn');
				}
				this.waiting = false;
				if (this.teamsMatch(data.state.teams)) {
					this.checkEntryDisqualification(data.state.teams);
					if(!data.state.over) {
						this._advanceDelayed(true);
					}
					this.sendRenderState(data.state);
				} else {
					//NONONONONO
					this.sendBadState(data);
				}
				break;
			case 'STEP_INCOMPLETE':
				//Perform checking of state, since some state mismatch bugs are here
				if (this.teamsMatch(data.state.teams)) {
					this.checkEntryDisqualification(data.state.teams);
					this.sendRenderState(data.state);
				} else {
					this.logHandle.log(
						'Game progress lost due to mismatched teams',
						'warn'
					);
					this.sendRenderState(Object.assign(data.state, {
						teams: data.state.teams.filter((team)=>(
							this.teamEntries.has(team.id)
						)),
					}));
				}
				break;
			case 'DISCONNECT':
				this.logHandle.log('disconnected', 'warn');
				this.waiting = false;
				this.eventReceiver.trigger('message', [{
					action: 'DISCONNECTED',
					token: this.token,
				}]);
				throw new Error('Runner ' + this.token + ' unexpectedly disconnected');
			case 'UNHANDLED':
				this.logHandle.log(data, 'error');
				break;
			}
		}

		_advanceDelayed(subtractStepTime) {
			clearTimeout(this.timeout);
			this.timeout = null;
			if(this.playConfig.speed) {
				let delay = this.playConfig.delay;
				if(subtractStepTime) {
					delay -= (Date.now() - this.lastStartStep);
				}
				if(delay > 0) {
					this.timeout = setTimeout(this._advance, delay);
				} else {
					this._advance();
				}
			}
		}

		_advance(type = null, steps = null) {
			this.timeout = null;
			this.waiting = true;
			this.lastStartStep = Date.now();
			this.gameWorker.postMessage({
				action: 'STEP',
				type: type || '',
				steps: steps || this.playConfig.speed,
				checkbackTime: (type !== null && steps === null) ?
					0 :
					this.playConfig.checkbackTime,
			});
		}

		step(type, steps) {
			this.playConfig.delay = 0;
			this.playConfig.speed = 0;
			clearTimeout(this.timeout);
			this.timeout = null;
			if(!this.waiting) {
				this._advance(type, steps);
			}
		}

		terminate() {
			this.playConfig.delay = 0;
			this.playConfig.speed = 0;
			clearTimeout(this.timeout);
			this.timeout = null;
			if (this.gameWorker !== null) {
				this.gameWorker.removeEventListener('message', this._handleMessage);
				this.gameWorker.terminate();
				this.gameWorker = null;
			} else {
				throw new Error('Game worker double freed');
			}
		}
	}

	return class GameSandbox extends EventObject {
		constructor(disqualifyReaction, errorReaction) {
			super();
			this.runningGames = new Map();
			this.disqualifyReaction = disqualifyReaction;
			this.errorReaction = errorReaction;
		}

		postMessage(data) {
			let game = this.runningGames.get(data.token);

			switch(data.action) {
				case 'GAME':
					if(game) {
						game.terminate();
					}
					this.runningGames.set(data.token, new GameStepper(
						data.token,
						data.pathGameManager,
						data.playConfig,
						data.gameConfig,
						this
					));
					break;

				case 'STEP':
					game.step(data.type, data.steps);
					break;

				case 'STOP':
					game.terminate();
					this.runningGames.delete(data.token);
					break;

				case 'STOP_ALL':
					this.runningGames.forEach((runningGame) => runningGame.terminate());
					this.runningGames.clear();
					break;
			}
		}

	};
});
