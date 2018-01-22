define([
	'core/EventObject',
	'core/sandboxUtils',
	'math/Random',
	'path:./sandboxedGames',
], (
	EventObject,
	sandboxUtils,
	Random,
	pathSandboxedGames
) => {
	'use strict';

	class Game extends EventObject {
		constructor(parent, token, display, config, swapTokenFn) {
			super();

			this.parent = parent;
			this.token = token;
			this.display = null;
			this.config = config;
			this.swapTokenFn = swapTokenFn;
			this.gameStarted = false;
			this.gameActive = false;
			this.dead = false;
			this.updateTm = null;
			this.latestState = null;

			this.beginGame = this.beginGame.bind(this);
			this.replay = this.replay.bind(this);
			this.step = this.step.bind(this);
			this.updateGameConfig = this.updateGameConfig.bind(this);
			this.updatePlayConfig = this.updatePlayConfig.bind(this);
			this.updateDisplayConfig = this.updateDisplayConfig.bind(this);
			this._updateState = this._updateState.bind(this);

			this.swapDisplay(display);
		}

		_markDead() {
			this.swapDisplay(null);
			this.removeAllEventListeners();
			this.dead = true;
		}

		swapDisplay(display) {
			if(this.dead) {
				throw new Error('Attempt to use terminated game');
			}
			if(this.display === display) {
				return;
			}

			if(this.display) {
				this.display.removeEventListener('begin', this.beginGame);
				this.display.removeEventListener('replay', this.replay);
				this.display.removeEventListener('step', this.step);
				this.display.removeEventListener('changegame', this.updateGameConfig);
				this.display.removeEventListener('changeplay', this.updatePlayConfig);
				this.display.removeEventListener('changedisplay', this.updateDisplayConfig);
			}

			this.display = display;
			if(this.display) {
				this.display.addEventListener('begin', this.beginGame);
				this.display.addEventListener('replay', this.replay);
				this.display.addEventListener('step', this.step);
				this.display.addEventListener('changegame', this.updateGameConfig);
				this.display.addEventListener('changeplay', this.updatePlayConfig);
				this.display.addEventListener('changedisplay', this.updateDisplayConfig);
				this.display.clear();
				this.display.updateGameConfig(this.config.game);
				this.display.updatePlayConfig(this.config.play);
				this.display.updateDisplayConfig(this.config.display);
				if(this.latestState) {
					this._updateState();
				}
			}
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
			if(this.display) {
				this.display.updatePlayConfig(this.config.play);
			}
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
					});
				}, this.gameActive);
			}
		}

		updateGameConfig(delta) {
			if(this.dead) {
				throw new Error('Attempt to use terminated game');
			}
			Object.assign(this.config.game, delta);
			if(this.display) {
				this.display.updateGameConfig(this.config.game);
			}
			if(this.gameStarted) {
				this.parent.sandbox.postMessage({
					action: 'UPDATE_GAME_CONFIG',
					token: this.token,
					gameConfig: this.config.game,
				});
			}
		}

		updateEntry(updatedEntry) {
			if(this.dead) {
				throw new Error('Attempt to use terminated game');
			}
			this.config.game.teams.forEach((team) => team.entries.forEach((entry) => {
				if(entry.id === updatedEntry.id) {
					Object.assign(entry, updatedEntry);
				}
			}));
			if(this.display) {
				this.display.updateGameConfig(this.config.game);
			}
			if(this.gameStarted) {
				this.parent.sandbox.postMessage({
					action: 'UPDATE_ENTRY',
					token: this.token,
					entry: updatedEntry,
				});
			}
		}

		updatePlayConfig(delta) {
			if(this.dead) {
				throw new Error('Attempt to use terminated game');
			}
			Object.assign(this.config.play, delta);
			if(this.display) {
				this.display.updatePlayConfig(this.config.play);
			}
			if(this.gameStarted) {
				this.parent.sandbox.postMessage({
					action: 'UPDATE_PLAY_CONFIG',
					token: this.token,
					playConfig: this.config.play,
				});
			}
		}

		updateDisplayConfig(delta) {
			if(this.dead) {
				throw new Error('Attempt to use terminated game');
			}
			Object.assign(this.config.display, delta);
			if(this.display) {
				this.display.updateDisplayConfig(this.config.display);
			}
		}

		getGameConfig() {
			return this.config.game;
		}

		replay() {
			this.begin(this.getSeed(), this.config.game.teams);
		}

		beginGame({seed = null} = {}) {
			if(!seed) {
				seed = 'G' + Random.makeRandomSeed();
			}
			this.begin(seed, this.config.game.teams);
		}

		begin(seed, teams) {
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
			this.config.game.teams = teams;
			if(this.display) {
				this.display.clear();
				this.display.updatePlayConfig(this.config.play);
				this.display.updateGameConfig(this.config.game);
				this.display.updateDisplayConfig(this.config.display);
			}
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
			if(this.display) {
				this.display.updateState(this.latestState);
			}
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
				this.updateTm = setTimeout(this._updateState, 0);
			}
		}

		terminate() {
			this.parent.terminate(this.token);
		}
	}

	return class GameOrchestrator {
		constructor(pathGameManager, {maxConcurrency = 1} = {}) {
			this.pathGameManager = pathGameManager;
			this.maxConcurrency = maxConcurrency;
			this.awaitingCapacity = [];
			this.sandbox = sandboxUtils.make(pathSandboxedGames);
			this.games = new Map();
			this.nextToken = 0;

			this.sandbox.addEventListener('message', (event) => {
				const data = event.data;
				switch(data.action) {
				case 'RENDER':
					const game = this.games.get(data.token);
					if(game) {
						game.updateState(data.state);
						if(data.pauseTriggered) {
							game.updatePlayConfig({delay: 0, speed: 0});
						}
					}
					break;
				}
			});

			this._swapTokenFn = this._swapTokenFn.bind(this);
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
			display = null,
			baseGameConfig = {},
			basePlayConfig = {},
			baseDisplayConfig = {}
		}) {
			const token = (this.nextToken ++);

			const config = {
				game: Object.assign({
					seed: null,
					teams,
				}, baseGameConfig),
				play: Object.assign({
					delay: 0,
					speed: 0,
					maxTime: 500,
				}, basePlayConfig),
				display: Object.assign({
					focussed: [],
				}, baseDisplayConfig),
			};

			const game = new Game(
				this,
				token,
				display,
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
