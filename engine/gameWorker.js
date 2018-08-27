define(['math/Random'], (Random) => {
	'use strict';

	return (GameManager) => {
		let game = null;
		let time0 = null;

		function sendState({complete = true, pauseTriggered = false} = {}) {
			const now = Date.now();
			const state = game.getState();
			self.postMessage({
				action: complete ? 'STEP_COMPLETE' : 'STEP_INCOMPLETE',
				state: Object.assign({}, state, {
					realWorldTime: now - time0,
				}),
				pauseTriggered,
			});
		}

		function begin(config) {
			if(game) {
				throw new Error('Cannot re-use game worker');
			}
			time0 = Date.now();
			game = new GameManager(new Random(config.seed), config);
			sendState();
		}

		function nextCheckbackTime(interval) {
			if(!interval) {
				return Number.POSITIVE_INFINITY;
			}
			return Math.floor((Date.now() / interval) + 1) * interval;
		}

		function durationDeadline(duration) {
			if(!duration) {
				return Number.POSITIVE_INFINITY;
			}
			return Date.now() + duration;
		}

		function runSteps({checkbackInterval = null, maxDuration = null, steps, type}) {
			const timeLimit = durationDeadline(maxDuration);
			let checkbackTime = nextCheckbackTime(checkbackInterval);

			for(let i = 0; (steps < 0 || i < steps) && !game.isOver(); ++ i) {
				game.step(type);
				const now = Date.now();
				if(now >= timeLimit) {
					return;
				}
				if(now >= checkbackTime) {
					checkbackTime = nextCheckbackTime(checkbackInterval);
					if(checkbackTime >= timeLimit) {
						// Next checkback will be too late;
						// exit early instead to keep framerate consistent
						return;
					}
					// Carry on computing, but send a frame back so the user
					// can see what's happening
					sendState({complete: false});
				}
			}
		}

		function step(options) {
			try {
				runSteps(options);
				sendState();
			} catch(e) {
				if(e === 'PAUSE') {
					sendState({pauseTriggered: true});
				} else {
					throw e;
				}
			}
		}

		function skip({checkbackInterval, skipFrame, type}) {
			const steps = skipFrame - game.getState().frame;
			if(steps > 0) {
				step({checkbackInterval, steps, type});
			}
		}

		self.addEventListener('message', (event) => {
			const data = event.data;

			switch(data.action) {
			case 'BEGIN':
				begin(data.config);
				break;

			case 'STEP':
				step(data);
				break;

			case 'SKIP':
				skip(data);
				break;

			case 'UPDATE_CONFIG':
				game.updateConfig(data.config);
				break;

			case 'UPDATE_ENTRY':
				game.updateEntry(data.entry);
				break;
			}
		});
	};
});
