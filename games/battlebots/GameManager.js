define(['core/array_utils', 'fetch/entry_utils'], (array_utils, entry_utils) => {
	'use strict';

	const MOVES = {
		T0: [ // Red team
			{x: 0, y: 0},
			{x: 1, y: 0},
			{x:-1, y: 0},
			{x: 1, y:-1},
			{x:-1, y:-1},
			{x:-1, y: 1},
			{x: 1, y: 1},
		],
		T1: [ // Blue team
			{x: 0, y: 0},
			{x: 0, y: 1},
			{x: 0, y:-1},
			{x: 1, y:-1},
			{x:-1, y:-1},
			{x:-1, y: 1},
			{x: 1, y: 1},
		],
	};

	return class GameManager {
		constructor(random, {width, height, maxFrame, visibilityDistance, teams}) {
			this.random = random;
			this.width = width|0;
			this.height = height|0;
			this.teams = teams;
			this.maxFrame = Math.max(maxFrame|0, 1);
			this.frame = 0;
			this.simulationTime = 0;
			this.bots = [];
			this.visDist2 = visibilityDistance * visibilityDistance;
			this.entryLookup = new Map();

			const area = this.width * this.height;

			let entryCount = 0;
			teams.forEach((team) => entryCount += team.entries.length);

			// Randomly position all entrants
			const positions = [];
			let remaining = entryCount;
			for(let i = 0; i < area; ++ i) {
				if(this.random.next(area - i) < remaining) {
					positions.push(i);
					-- remaining;
				}
			}

			teams.forEach((team, teamIndex) => team.entries.forEach((entry) => {
				const positionIndex = this.random.next(positions.length);
				const startIndex = positions.splice(positionIndex, 1)[0];

				const bot = {
					id: this.bots.length,
					entry: entry.id,
					team: team.id,
					teamIndex,
					alive: true,
					message: '',
					moves: 0,
					kills: 0,
					x: startIndex % this.width,
					y: (startIndex / this.width)|0,
				};

				this.entryLookup.set(entry.id, {
					id: entry.id,
					fn: null,
					pauseOnError: false,
					disqualified: false,
					error: null,
					errorInput: null,
					errorOutput: null,
					console: [],
					bot,
					user_id: null,
					codeSteps: 0,
					elapsedTime: 0,
				});
				this.bots.push(bot);
				this.updateEntry(entry);
			}));
		}

		updateEntry({id, code = null, pauseOnError = null, disqualified = null, user_id = null}) {
			const entry = this.entryLookup.get(id);
			if(!entry) {
				throw new Error('Attempt to modify an entry which was not registered in the game');
			}
			if(code !== null) {
				const compiledCode = entry_utils.compile(code, [
					'move',
					'x',
					'y',
					'tCount',
					'eCount',
					'tNear',
					'eNear',
					'setMsg',
					'getMsg',
				], 'Math.random = extras.MathRandom;');
				entry.fn = compiledCode.fn;
				if(compiledCode.compileError) {
					entry.disqualified = true;
					entry.error = compiledCode.compileError;
				} else {
					// Automatically un-disqualify entries when code is updated
					entry.error = null;
					entry.disqualified = false;
				}
				entry.errorInput = null;
				entry.errorOutput = null;
			}
			if(pauseOnError !== null) {
				entry.pauseOnError = pauseOnError;
			}
			if(disqualified !== null) {
				entry.disqualified = disqualified;
			}
			if(user_id !== null) {
				entry.user_id = user_id;
			}
			this.entryLookup.forEach((otherEntry) => {
				if(
					otherEntry !== entry &&
					otherEntry.user_id === entry.user_id &&
					!otherEntry.disqualified
				) {
					entry.disqualified = true;
					entry.error = 'Only one entry per user';
				}
			});
		}

		updateConfig({maxFrame, visibilityDistance}) {
			this.maxFrame = Math.max(maxFrame|0, 1);
			this.visDist2 = visibilityDistance * visibilityDistance;
		}

		moveBot(bot, action) {
			const isBlue = (bot.team === 'T1');
			const move = MOVES[bot.team][action];
			bot.x += move.x;
			bot.y += move.y;
			if(bot.x < 0) {
				bot.x = 0;
			}
			if(bot.y < 0) {
				bot.y = 0;
			}
			if(bot.x >= this.width) {
				bot.x = this.width - 1;
			}
			if(bot.y >= this.height) {
				bot.y = this.height - 1;
			}
			this.bots.forEach((otherBot) => {
				const otherEntry = this.entryLookup.get(otherBot.entry);
				if(
					!otherEntry.disqualified &&
					otherBot.alive &&
					otherBot.x === bot.x &&
					otherBot.y === bot.y &&
					otherBot.teamIndex !== bot.teamIndex
				) {
					otherBot.alive = false;
					++ bot.kills;
				}
			});
		}

		stepBot(index) {
			const bot = this.bots[index];
			const entry = this.entryLookup.get(bot.entry);
			if(entry.disqualified || !bot.alive) {
				return;
			}
			const counts = [0, 0];
			const nearby = [[], []];
			const messages = {};
			this.bots.forEach((otherBot) => {
				const otherEntry = this.entryLookup.get(otherBot.entry);
				if(!otherEntry.disqualified && otherBot.alive) {
					const team = otherBot.teamIndex;
					++ counts[team];
					const dist2 = (
						(otherBot.x - bot.x) * (otherBot.x - bot.x) +
						(otherBot.y - bot.y) * (otherBot.y - bot.y)
					);
					if(dist2 < this.visDist2) {
						nearby[team].push({
							x: otherBot.x,
							y: otherBot.y,
							id: otherEntry.user_id,
						});
					}
					messages[otherEntry.user_id] = otherBot.message;
				} else {
					messages[otherEntry.user_id] = 'X';
				}
			});

			let error = null;
			let elapsed = 0;
			let action = undefined;

			const oldRandom = Math.random;
			const params = {
				move: ++ bot.moves,
				x: bot.x,
				y: bot.y,
				tCount: counts[bot.teamIndex],
				eCount: counts[1 - bot.teamIndex],
				tNear: nearby[bot.teamIndex],
				eNear: nearby[1 - bot.teamIndex],
				messages,
			};
			try {
				const begin = performance.now();
				action = entry.fn(Object.assign({
					setMsg: (msg) => {
						if(typeof msg === 'string') {
							messages[entry.user_id] = bot.message = msg.substr(0, 64);
						}
					},
					getMsg: (id) => {
						return messages[id];
					},
				}, params), {
					MathRandom: () => {
						return this.random.next(0x100000000) / 0x100000000;
					},
					consoleTarget: entry.console,
				});
				elapsed = performance.now() - begin;

				if((action|0) !== action || action < 0 || action > 6) {
					error = 'Invalid action: ' + action;
				} else if(elapsed > 15) {
					error = 'Too long to respond: ' + elapsed + 'ms';
				}
			} catch(e) {
				error = entry_utils.stringifyEntryError(e);
			}
			Math.random = oldRandom;

			entry.elapsedTime += elapsed;
			++ entry.codeSteps;

			if(error) {
				entry.errorInput = JSON.stringify(params);
				entry.errorOutput = action;
				entry.error = (
					error + ' (gave ' + entry.errorOutput +
					' for ' + entry.errorInput + ')'
				);
			} else {
				this.moveBot(bot, action);
			}
		}

		stepOneBot() {
			// TODO
		}

		stepAllBots() {
			if(this.frame >= this.maxFrame) {
				return;
			}
			const begin = performance.now();

			const movingTeamIndex = (this.frame % 2);

			// Randomise order
			array_utils.shuffleInPlace(this.bots, this.random);

			// Step all bots
			for(let i = 0; i < this.bots.length; ++ i) {
				if(this.bots[i].teamIndex === movingTeamIndex) {
					this.stepBot(i);
				}
			}

			++ this.frame;
			this.simulationTime += performance.now() - begin;
		}

		step(type) {
			if(type === 'single') {
				this.stepOneBot();
			} else {
				this.stepAllBots();
			}
		}

		isOver() {
			return this.frame >= this.maxFrame;
		}

		getState() {
			return {
				// Framework data
				over: this.isOver(),
				progress: this.frame / this.maxFrame,

				// Game specific data
				frame: this.frame,
				simulationTime: this.simulationTime,
				teams: this.teams.map((team) => ({
					id: team.id,
					entries: team.entries.map((entry) => {
						const entryState = this.entryLookup.get(entry.id);
						return {
							id: entry.id,
							team: team.id,
							codeSteps: entryState.codeSteps,
							elapsedTime: entryState.elapsedTime,
							disqualified: entryState.disqualified,
							error: entryState.error,
							errorInput: entryState.errorInput,
							errorOutput: entryState.errorOutput,
							console: entryState.console,

							teamIndex: entryState.bot.teamIndex,
							alive: entryState.bot.alive,
							x: entryState.bot.x,
							y: entryState.bot.y,
							kills: entryState.bot.kills,
						};
					}),
				})),
			};
		}
	}
});
