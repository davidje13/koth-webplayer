'use strict';

define(['core/worker_utils'], (worker_utils) => {
	class GameStepper {
		constructor(token, gameType, playConfig, gameConfig) {
			this.delay = playConfig.delay;
			this.speed = playConfig.speed;
			this.token = token;
			this.timeout = null;

			this._advance = this._advance.bind(this);
			this._handleMessage = this._handleMessage.bind(this);

			this.gameWorker = worker_utils.make('games/' + gameType + '/game_worker');
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
			if(this.speed > 0) {
				let delay = this.delay;
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
				steps: steps || this.speed,
				render: true,
			});
		}

		step(type, steps) {
			this.delay = 0;
			this.speed = 0;
			clearTimeout(this.timeout);
			this.timeout = null;
			if(!this.waiting) {
				this._advance(type, steps);
			}
		}

		terminate() {
			this.delay = 0;
			this.speed = 0;
			clearTimeout(this.timeout);
			this.timeout = null;
			this.gameWorker.terminate();
		}

		updatePlayConfig(config) {
			if(this.delay !== config.delay || this.speed !== config.speed) {
				this.delay = config.delay;
				this.speed = config.speed;
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
				data.gameType,
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
