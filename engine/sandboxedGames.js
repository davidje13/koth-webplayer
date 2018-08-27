define([
	'core/workerUtils',
	'path:./gameWorker',
], (
	workerUtils,
	pathGameWorker
) => {
	'use strict';

	class GameStepper {
		constructor(token, pathGameManager, playConfig, gameConfig) {
			this.playConfig = playConfig;
			this.playing = (this.playConfig.speed !== 0);
			this.token = token;
			this.timeout = null;

			this._handleMessage = this._handleMessage.bind(this);

			this.gameWorker = workerUtils.make([
				pathGameManager,
				pathGameWorker,
			], (GameManager, gameWorker) => gameWorker(GameManager));
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
				if(data.pauseTriggered) {
					this.playing = false;
				} else if(!data.state.over) {
					this._advanceDelayed(true);
				}
				self.postMessage({
					action: 'RENDER',
					token: this.token,
					state: data.state,
					pauseTriggered: data.pauseTriggered,
				});
				break;

			case 'STEP_INCOMPLETE':
				self.postMessage({
					action: 'RENDER',
					token: this.token,
					state: data.state,
					pauseTriggered: false,
				});
				break;
			}
		}

		_advanceDelayed(subtractStepTime) {
			clearTimeout(this.timeout);
			this.timeout = null;
			if(this.playing) {
				let delay = this.playConfig.delay;
				if(subtractStepTime) {
					delay -= (Date.now() - this.lastStartStep);
				}
				const call = () => this._advance({
					type: '',
					steps: this.playConfig.speed,
					maxDuration: this.playConfig.maxDuration,
					checkbackInterval: this.playConfig.checkbackInterval,
				});
				if(delay > 0) {
					this.timeout = setTimeout(call, delay);
				} else {
					call();
				}
			}
		}

		_advance({type, steps, maxDuration, checkbackInterval}) {
			this.timeout = null;
			this.waiting = true;
			this.lastStartStep = Date.now();
			this.gameWorker.postMessage({
				action: 'STEP',
				type: type || '',
				steps,
				maxDuration,
				checkbackInterval,
			});
		}

		step({type, steps, maxDuration, checkbackInterval}) {
			this.stop();
			if(!this.waiting) {
				this._advance({type, steps, maxDuration, checkbackInterval});
			}
		}

		skip(skipFrame, checkbackInterval) {
			this.stop();

			this.waiting = true;
			this.gameWorker.postMessage({
				action: 'SKIP',
				type: '',
				skipFrame,
				checkbackInterval,
			});
		}

		stop() {
			this.playing = false;
			clearTimeout(this.timeout);
			this.timeout = null;
		}

		terminate() {
			this.stop();
			this.gameWorker.terminate();
		}

		updatePlayConfig(config) {
			this.playConfig = config;
			this.playing = (this.playConfig.speed !== 0);
			if(!this.waiting) {
				this._advanceDelayed(false);
			}
		}

		updateGameConfig(config) {
			this.gameWorker.postMessage({
				action: 'UPDATE_CONFIG',
				config,
			});
		}

		updateEntry(entry) {
			this.gameWorker.postMessage({
				action: 'UPDATE_ENTRY',
				entry,
			});
		}
	}

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
				data.pathGameManager,
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

		case 'UPDATE_ENTRY':
			game.updateEntry(data.entry);
			break;

		case 'STEP':
			game.step(data);
			break;

		case 'SKIP':
			game.skip(data.steps, data.checkbackInterval);
			break;

		case 'STOP':
			game.terminate();
			runningGames.delete(data.token);
			break;

		case 'STOP_ALL':
			runningGames.forEach((runningGame) => runningGame.terminate());
			runningGames.clear();
			break;
		}
	});
});
