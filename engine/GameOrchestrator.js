define([
	'math/Random',
	'core/sandbox_utils',
	'path:./sandboxed_games',
], (
	Random,
	sandbox_utils,
	sandboxed_games_path,
) => {
	'use strict';

	class Game {
		constructor(parent, token, display, config, swapTokenFn) {
			this.parent = parent;
			this.token = token;
			this.display = null;
			this.config = config;
			this.swapTokenFn = swapTokenFn;
			this.gameActive = false;
			this.updateTm = null;
			this.latestState = null;

			this.begin = this.begin.bind(this);
			this.replay = this.replay.bind(this);
			this.step = this.step.bind(this);
			this.updateGameConfig = this.updateGameConfig.bind(this);
			this.updatePlayConfig = this.updatePlayConfig.bind(this);
			this.updateDisplayConfig = this.updateDisplayConfig.bind(this);
			this.debouncedUpdate = this.debouncedUpdate.bind(this);

			this.swapDisplay(display);
		}

		swapDisplay(display) {
			if(this.display === display) {
				return;
			}

			if(this.display) {
				this.display.removeEventListener('begin', this.begin);
				this.display.removeEventListener('replay', this.replay);
				this.display.removeEventListener('step', this.step);
				this.display.removeEventListener('changegame', this.updateGameConfig);
				this.display.removeEventListener('changeplay', this.updatePlayConfig);
				this.display.removeEventListener('changedisplay', this.updateDisplayConfig);
			}

			this.display = display;
			if(this.display) {
				this.display.addEventListener('begin', this.begin);
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
					clearTimeout(this.updateTm);
					this.debouncedUpdate();
				}
			}
		}

		getSeed() {
			return this.config.game.seed;
		}

		step(type = null, steps = null) {
			Object.assign(this.config.play, {
				delta: 0,
				speed: 0,
			});
			if(this.display) {
				this.display.updatePlayConfig(this.config.play);
			}
			if(this.gameActive) {
				this.parent.sandbox.postMessage({
					action: 'STEP',
					token: this.token,
					type,
					steps,
				});
			}
		}

		updateGameConfig(delta) {
			Object.assign(this.config.game, delta);
			if(this.display) {
				this.display.updateGameConfig(this.config.game);
			}
			if(this.gameActive) {
				this.parent.sandbox.postMessage({
					action: 'UPDATE_GAME_CONFIG',
					token: this.token,
					gameConfig: this.config.game,
				});
			}
		}

		updatePlayConfig(delta) {
			Object.assign(this.config.play, delta);
			if(this.display) {
				this.display.updatePlayConfig(this.config.play);
			}
			if(this.gameActive) {
				this.parent.sandbox.postMessage({
					action: 'UPDATE_PLAY_CONFIG',
					token: this.token,
					playConfig: this.config.play,
				});
			}
		}

		updateDisplayConfig(delta) {
			Object.assign(this.config.display, delta);
			if(this.display) {
				this.display.updateDisplayConfig(this.config.display);
			}
		}

		replay() {
			this.begin({seed: this.getSeed()});
		}

		begin({seed = null, entries = null} = {}) {
			if(this.gameActive) {
				this.parent.sandbox.postMessage({
					action: 'STOP',
					token: this.token,
				});
				this.token = this.swapTokenFn(this.token);
			}
			clearTimeout(this.updateTm);
			this.updateTm = null;
			this.config.game.seed = (seed || Random.makeRandomSeed('G'));
			if(entries) {
				this.config.game.entries = entries;
			}
			if(this.display) {
				this.display.clear();
				this.display.updatePlayConfig(this.config.play);
				this.display.updateGameConfig(this.config.game);
				this.display.updateDisplayConfig(this.config.display);
			}
			this.gameActive = true;
			this.parent.sandbox.postMessage({
				action: 'GAME',
				token: this.token,
				gameManagerPath: this.parent.gameManagerPath,
				gameConfig: this.config.game,
				playConfig: this.config.play,
			});
		}

		debouncedUpdate() {
			this.updateTm = null;
			if(this.display) {
				this.display.updateState(this.latestState);
			}
		}

		updateState(state) {
			this.latestState = state;
			if(!this.updateTm) {
				this.updateTm = setTimeout(this.debouncedUpdate, 0);
			}
		}
	};

	return class GameOrchestrator {
		constructor(gameManagerPath) {
			this.gameManagerPath = gameManagerPath;
			this.sandbox = sandbox_utils.make(sandboxed_games_path);
			this.games = new Map();
			this.nextToken = 0;

			this.sandbox.addEventListener('message', (event) => {
				const data = event.data;
				switch(data.action) {
				case 'RENDER':
					const game = this.games.get(data.token);
					if(game) {
						game.updateState(data.state);
					}
					break;
				}
			});

			this._swapTokenFn = this._swapTokenFn.bind(this);
		}

		_swapTokenFn(token) {
			const game = this.games.get(token);
			this.games.delete(token);
			const newToken = (this.nextToken ++);
			this.games.set(newToken, game);
			return newToken;
		}

		makeGame({
			entries = [],
			display = null,
			baseGame = {},
			basePlay = {},
			baseDisplay = {}
		}) {
			const token = (this.nextToken ++);

			const config = {
				game: Object.assign({
					seed: null,
					entries,
				}, baseGame),
				play: Object.assign({
					delay: 0,
					speed: 0,
				}, basePlay),
				display: Object.assign({
				}, baseDisplay),
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
	};
});
