define([
	'core/EventObject',
	'node/GameSandbox',
	'node/nodeUtils',
	'node/logger',
	'fs',
], (
	EventObject,
	GameSandbox,
	nodeUtils,
	logger,
	fs
) => {
	'use strict';
	/* globals process */

	class Game extends EventObject {
		constructor(parent, token, config, swapTokenFn) {
			super();

			this.parent = parent;
			this.token = token;
			this.config = config;
			this.swapTokenFn = swapTokenFn;
			this.gameStarted = false;
			this.gameActive = false;
			this.dead = false;
			this.updateTm = null;
			this.latestState = null;

			this.beginGame = this.beginGame.bind(this);
			this.step = this.step.bind(this);
			this._updateState = this._updateState.bind(this);
		}

		_markDead() {
			this.removeAllEventListeners();
			this.dead = true;
		}

		getSeed() {
			return this.config.game.seed;
		}

		getTeams() {
			return this.config.game.teams;
		}

		step(type = null, steps = null) {
			if(this.dead) {
				throw new Error('Attempt to use terminated game');
			}
			Object.assign(this.config.play, {
				delay: 0,
				speed: 0,
			});
			if(this.gameStarted) {
				const currentToken = this.token;
				this.parent.awaitCapacity(() => {
					if(this.token !== currentToken) {
						return;
					}
					this.gameActive = true;
					this.parent.sandbox.postMessage({
						action: 'STEP',
						token: this.token,
						type,
						steps,
						checkbackTime: this.config.play.checkbackTime,
					});
				}, this.gameActive);
			}
		}

		getGameConfig() {
			return this.config.game;
		}

		beginGame({seed = null} = {}) {
			if(!seed) {
				seed = 'G' + nodeUtils.makeRandomSeed();
			}
			this.begin(seed, this.config.game.teams);
		}

		begin(seed, teams, frame = 0) {
			if(this.dead) {
				throw new Error('Attempt to use terminated game');
			}
			const wasActive = this.gameActive;
			if(this.gameStarted) {
				this.parent.sandbox.postMessage({
					action: 'STOP',
					token: this.token,
				});
				this.token = this.swapTokenFn(this.token);
				clearTimeout(this.updateTm);
				this.updateTm = null;
				this.gameStarted = false;
				this.gameActive = false;
			}
			this.config.game.seed = seed;
			this.config.game.teams = teams.filter((team) => (team.entries.length > 0));
			this.config.game.startFrame = frame;
			this.trigger('begin');
			const currentToken = this.token;
			this.parent.awaitCapacity(() => {
				if(this.token !== currentToken) {
					return;
				}
				this.gameStarted = true;
				this.gameActive = true;
				this.parent.sandbox.postMessage({
					action: 'GAME',
					token: this.token,
					pathGameManager: this.parent.pathGameManager,
					gameConfig: this.config.game,
					playConfig: this.config.play,
				});
			}, wasActive);
		}

		_updateState() {
			if(this.dead) {
				return;
			}
			clearTimeout(this.updateTm);
			this.updateTm = null;
			this.trigger('update', [this.latestState]);
		}

		updateState(state) {
			if(this.dead) {
				throw new Error('Attempt to use terminated game');
			}
			this.latestState = state;
			if(this.latestState.over) {
				this.gameActive = false;
				this._updateState();
				this.trigger('complete', [this.latestState]);
				this.parent.checkCapacity();
			} else if(!this.updateTm) {
				this.updateTm = process.nextTick(this._updateState);
			}
		}

		//Can't reclaim, not complete, send what there is left
		salvage() {
			if(this.dead) {
				throw new Error('Attempt to use terminated game');
			}
			if (!this.latestState) {
				this.latestState = {
					teams: [],
					frame: 0,
					over: true,
					progress: 1,
					simulationTime: 0,
					realWorldTime: 0,
				};
			}
			this.gameActive = false;
			this._updateState();
			this.trigger('complete', [this.latestState]);
			this.parent.checkCapacity();
		}

		terminate() {
			this.parent.terminate(this.token);
		}
	}

	return class GameOrchestrator {
		constructor(pathGameManager, {
			maxConcurrency = 1,
			pathToFilter=null,
			disqualifyReaction='exclude',
			errorReaction='ignore',
		} = {}) {
			this.pathGameManager = pathGameManager;
			this.maxConcurrency = maxConcurrency;
			this.awaitingCapacity = [];
			this.disqualifiedReasons = new Map();
			this.pathToFilter = pathToFilter;
			this.disqualifyReaction = disqualifyReaction;
			this.errorReaction = errorReaction;
			this.sandbox = new GameSandbox(
				this.disqualifyReaction,
				this.errorReaction
			);
			this.games = new Map();
			this.nextToken = 0;
			this.logHandle = logger.topLevel.openHandle('orchestrator');

			this.sandbox.addEventListener('message', (data) => {
				switch(data.action) {
				case 'RENDER': {
					const game = this.games.get(data.token);
					if(game) {
						game.updateState(data.state);
					}
					break;
				}
				case 'DISCONNECTED': {
					const game = this.games.get(data.token);
					if (game) {
						game.salvage();
					}
					break;
				}
				case 'DISQUALIFIED': {
					//I'm assuming that disqualifications are largely a rare, one-time
					//thing, so the expense of reopening, rereading, and rewriting
					//the file to insert a disqualification is acceptable, as well as
					//the space wasted by leaving the file uncompressed
					//If this turns out to not be the case, feel free to modify
					let hasReason = this.disqualifiedReasons.has(data.entryInfo.id);
					let isBad = (data.entryError.disqualified &&
							this.disqualifyReaction !== 'ignore') ||
							(data.entryError.error &&
							this.errorReaction !== 'ignore');
					if (data.entryError.disqualified || data.entryError.error) {
						if (isBad) {
							process.exitCode = 1; //EXIT_SUBMISSION_ERROR
						}
						let why = {
							disqualified: data.entryError.disqualified,
							error: data.entryError.error,
							errorOutput: data.entryError.errorOutput,
							errorInput: data.entryError.errorInput,
						};
						if (isBad && data.entryInfo === undefined) {
							this.logHandle.log(why, 'warn');
						} else if (isBad || !hasReason) {
							Object.assign(data.entryInfo, why);
							this.disqualifiedReasons.set(data.entryInfo.id, Object.assign({
								blockHash: data.entryInfo.blockHash,
							}, why));
							this.logHandle.log(Object.assign({
								title: data.entryInfo.title,
								answerID: data.entryInfo.answerID,
								blockHash: data.entryInfo.blockHash,
								userName: data.entryInfo.userName,
								userID: data.entryInfo.userID,
							}, why), 'warn');
						}
					}
				}
				}

			});

			//Attach an exit hook which performs the draining
			//of the remainder of the filters synchronously
			process.on('exit', this._filterDump.bind(this));

			this._swapTokenFn = this._swapTokenFn.bind(this);
		}

		_filterDump() {
			if (this.pathToFilter !== null) {
				const dumpArray = Array.from(this.disqualifiedReasons.values()).map((entryVal) => {
					return {
						field: 'blockHash',
						value: entryVal.blockHash,
						reason: {
							disqualified: entryVal.disqualified,
							error: entryVal.error,
							errorInput: entryVal.errorInput,
							errorOutput: entryVal.errorOutput,
						},
					};
				});
				if (dumpArray.length > 0) {
					try {
						let existingFilterStr = fs.readFileSync(
							this.pathToFilter,
							{encoding: 'utf8'}
						);
						let oldFilter = JSON.parse(existingFilterStr);
						let dumpArrayValues = new Set(dumpArray.map((ent) => ent.value));
						let newFilter = dumpArray.concat(oldFilter.filter((elm) => {
							return !dumpArrayValues.has(elm.value);
						}));
						fs.writeFileSync(this.pathToFilter, JSON.stringify(newFilter));
					} catch(err) {
						fs.writeFileSync(this.pathToFilter, JSON.stringify(dumpArray));
					}
				}
			}

		}

		_swapTokenFn(token) {
			const game = this.games.get(token);
			if(!game) {
				throw new Error('Game not found for token ' + token);
			}
			this.games.delete(token);
			const newToken = (this.nextToken ++);
			this.games.set(newToken, game);
			return newToken;
		}

		awaitCapacity(fn, immediate = false) {
			if(immediate) {
				fn();
			} else {
				this.awaitingCapacity.push(fn);
				this.checkCapacity();
			}
		}

		countActiveThreads() {
			let used = 0;
			this.games.forEach((game) => {
				used += game.gameActive ? 1 : 0;
			});
			return used;
		}

		checkCapacity() {
			while(this.awaitingCapacity.length > 0) {
				if(this.countActiveThreads() >= this.maxConcurrency) {
					break;
				}
				const fn = this.awaitingCapacity.shift();
				fn();
			}
		}

		make({
			teams = [],
			baseGameConfig = {},
			basePlayConfig = {},
			baseDisplayConfig = {}
		}) {
			const token = (this.nextToken ++);
			const config = {
				game: Object.assign({
					seed: null,
					teams: teams,
					startFrame: 0,
				}, baseGameConfig),
				play: Object.assign({
					delay: 0,
					speed: 0,
					checkbackTime: 1000,
				}, basePlayConfig),
				display: Object.assign({
					focussed: [],
				}, baseDisplayConfig),
			};

			const game = new Game(
				this,
				token,
				config,
				this._swapTokenFn
			);
			this.games.set(token, game);

			return game;
		}

		terminate(token) {
			const game = this.games.get(token);
			if(game) {
				game._markDead();
				if(game.gameStarted) {
					this.sandbox.postMessage({
						action: 'STOP',
						token: game.token,
					});
				}
				this.games.delete(game.token);
				this.checkCapacity();
			}
		}

		terminateAll() {
			this.games.forEach((game) => {
				game._markDead();
				if(game.gameStarted) {
					this.sandbox.postMessage({
						action: 'STOP',
						token: game.token,
					});
				}
			});
			this.games.clear();
			this.awaitingCapacity.length = 0;
		}
	};
});
