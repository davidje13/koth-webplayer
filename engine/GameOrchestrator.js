define([
	'math/Random',
	'core/sandbox_utils',
], (
	Random,
	sandbox_utils,
) => {
	'use strict';

	class Game {
		constructor(parent, token, display, config, swapTokenFn) {
			this.parent = parent;
			this.token = token;
			this.display = display;
			this.config = config;
			this.swapTokenFn = swapTokenFn;
			this.tokenUsed = false;
			this.updateTm = null;
			this.latestState = null;

			if(this.display) {
				this.display.addEventListener('replay', () => {
					this.begin(this.config.game.seed);
				});

				this.display.addEventListener('new', (seed) => {
					this.begin(seed);
				});

				this.display.addEventListener('step', (type, steps) => {
					this.config.play.delta = 0;
					this.config.play.speed = 0;
					this.display.updatePlayConfig(this.config.play);
					this.parent.sandbox.postMessage({
						action: 'STEP',
						token: this.token,
						type,
						steps,
					});
				});

				this.display.addEventListener('changegame', (delta) => {
					Object.assign(this.config.game, delta);
					this.display.updateGameConfig(this.config.game);
					this.parent.sandbox.postMessage({
						action: 'UPDATE_GAME_CONFIG',
						token: this.token,
						gameConfig: this.config.game,
					});
				});

				this.display.addEventListener('changeplay', (delta) => {
					Object.assign(this.config.play, delta);
					this.display.updatePlayConfig(this.config.play);
					this.parent.sandbox.postMessage({
						action: 'UPDATE_PLAY_CONFIG',
						token: this.token,
						playConfig: this.config.play,
					});
				});

				this.display.addEventListener('changedisplay', (delta) => {
					Object.assign(this.config.display, delta);
					this.display.updateDisplayConfig(this.config.display);
				});
			}

			this.debouncedUpdate = this.debouncedUpdate.bind(this);
		}

		begin(seed) {
			if(this.tokenUsed) {
				this.parent.sandbox.postMessage({
					action: 'STOP',
					token: this.token,
				});
				this.token = this.swapTokenFn(this.token);
			}
			clearTimeout(this.updateTm);
			this.updateTm = null;
			this.tokenUsed = true;
			this.config.game.seed = (seed || Random.makeRandomSeed('G'));
			if(this.display) {
				this.display.clear();
				this.display.updatePlayConfig(this.config.play);
				this.display.updateGameConfig(this.config.game);
				this.display.updateDisplayConfig(this.config.display);
			}
			this.parent.sandbox.postMessage({
				action: 'GAME',
				token: this.token,
				gameType: this.parent.gameType,
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
		constructor(gameType) {
			this.gameType = gameType;
			this.sandbox = sandbox_utils.make('engine/sandboxed_games');
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
			entries,
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
