'use strict';

define(['core/worker_utils', 'path:./game_worker'], (worker_utils, game_worker_path) => {
	class GameStepper {
		constructor(token, gameManagerPath, playConfig, gameConfig) {
			this.playConfig = playConfig;
			this.token = token;
			this.timeout = null;

			this._advance = this._advance.bind(this);
			this._handleMessage = this._handleMessage.bind(this);

			this.gameWorker = worker_utils.make([
				gameManagerPath,
				game_worker_path,
			], (GameManager, game_worker) => game_worker(GameManager));
			this.gameWorker.addEventListener('message', this._handleMessage);

			this.waiting = true;
			this.lastStartStep = Date.now();
			this.gameWorker.postMessage({
				action: 'BEGIN',
				config: gameConfig,
			});
		}

		_handleMessage(event) {
			const data = event.data;
			switch(data.action) {
			case 'STEP_COMPLETE':
				this.waiting = false;
				if(!data.state.over) {
					this._advanceDelayed(true);
				}
				self.postMessage({
					action: 'RENDER',
					token: this.token,
					state: data.state,
				});
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
				maxTime: (type !== null || steps !== null) ? 0 : this.playConfig.maxTime,
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
			this.gameWorker.terminate();
		}

		updatePlayConfig(config) {
			if(
				this.playConfig.delay !== config.delay ||
				this.playConfig.speed !== config.speed ||
				this.playConfig.maxTime !== config.maxTime
			) {
				this.playConfig = config;
				if(!this.waiting) {
					this._advanceDelayed(false);
				}
			}
		}

		updateGameConfig(config) {
			this.lastStartStep = Date.now();
			this.gameWorker.postMessage({
				action: 'UPDATE_CONFIG',
				config,
			});
		}
	};

	const runningGames = new Map();

	self.addEventListener('message', (event) => {
		const data = event.data;
		let game = runningGames.get(data.token);

		switch(data.action) {
		case 'GAME':
			if(game) {
				game.terminate();
			}
			runningGames.set(data.token, new GameStepper(
				data.token,
				data.gameManagerPath,
				data.playConfig,
				data.gameConfig
			));
			break;

		case 'UPDATE_PLAY_CONFIG':
			game.updatePlayConfig(data.playConfig);
			break;

		case 'UPDATE_GAME_CONFIG':
			game.updateGameConfig(data.gameConfig);
			break;

		case 'STEP':
			game.step(data.type, data.steps);
			break;

		case 'STOP':
			game.terminate();
			runningGames.delete(data.token);
			break;

		case 'STOP_ALL':
			runningGames.forEach((game) => game.terminate());
			runningGames.clear();
			break;
		}
	});
});
