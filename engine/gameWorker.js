define(['math/Random'], (Random) => {
	'use strict';

	return (GameManager) => {
		let game = null;
		let time0 = null;

		function sendState(pauseTriggered = false) {
			const now = Date.now();
			const state = game.getState();
			self.postMessage({
				action: 'STEP_COMPLETE',
				state: Object.assign({}, state, {
					realWorldTime: now - time0,
				}),
				pauseTriggered,
			});
		}

		function sendIncomplete() {
			//Call us back, we want to continue on
			const now = Date.now();
			const state = game.getState();
			self.postMessage({
				action: 'STEP_INCOMPLETE',
				state: Object.assign({}, state, {
					realWorldTime: now - time0,
				}),
			});
		}

		function begin(config, checkbackTime) {
			if(game) {
				throw new Error('Cannot re-use game worker');
			}
			time0 = Date.now();
			game = new GameManager(new Random(config.seed), config);
			//I consider this a hack, but it's hard to figure out a better way
			if (config.hasOwnProperty('startFrame') && config.startFrame > 0) {
				let limit = 0;
				if (checkbackTime) {
					let prevLim = Math.floor(Date.now()/checkbackTime)*checkbackTime;
					limit = prevLim + checkbackTime;
				}
				try {
					for(let i = 0; (i < config.startFrame) && !game.isOver(); ++ i) {
						game.step(null);
						/* jshint maxdepth:6 */
						if(limit && Date.now() >= limit) {
							let prevLim = Math.floor(Date.now()/checkbackTime)*checkbackTime;
							limit = prevLim + checkbackTime;
							sendIncomplete();
						}
					}
				} catch(e) {
					if(e === 'PAUSE') {
						sendState(true);
					} else {
						throw e;
					}
				}
			}
			sendState();
		}

		function step({checkbackTime, steps, type}) {
			let limit = 0;
			if (checkbackTime) {
				limit = Math.floor(Date.now()/checkbackTime)*checkbackTime + checkbackTime;
			}
			try {
				for(let i = 0; (steps < 0 || i < steps) && !game.isOver(); ++ i) {
					game.step(type);
					if(limit && Date.now() >= limit) {
						limit = Math.floor(Date.now()/checkbackTime)*checkbackTime + checkbackTime;
						sendIncomplete();
					}
				}
				sendState();
			} catch(e) {
				if(e === 'PAUSE') {
					sendState(true);
				} else {
					throw e;
				}
			}
		}

		function skip({checkbackTime, skipFrame, type}) {
			let limit = 0;
			if (checkbackTime) {
				limit = Math.floor(Date.now()/checkbackTime)*checkbackTime + checkbackTime;
			}
			try {
				while(!game.isOver() && game.getState().frame < skipFrame) {
					game.step(type);
					if(limit && Date.now() >= limit) {
						let prevLim = Math.floor(Date.now()/checkbackTime)*checkbackTime;
						limit = prevLim + checkbackTime;
						sendIncomplete();
					}
				}
				sendState();
			} catch(e) {
				if(e === 'PAUSE') {
					sendState(true);
				} else {
					throw e;
				}
			}
		}

		self.addEventListener('message', (event) => {
			const data = event.data;

			switch(data.action) {
			case 'BEGIN':
				begin(data.config, data.checkbackTime);
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
