define([
	'core/arrayUtils',
	'fetch/entryUtils',
], (
	arrayUtils,
	entryUtils
) => {
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

	function makeAPIParams(bot, entry, params) {
		return Object.assign({
			setMsg: (msg) => {
				if(typeof msg === 'string') {
					msg = msg.substr(0, 64);
					params.messages[entry.userID] = bot.message = msg;
				}
			},
			getMsg: (id) => {
				return params.messages[id];
			},
		}, params);
	}

	function makeAPIExtras({console, random}) {
		return {
			consoleTarget: console,
			MathRandom: random.floatGenerator(),
		};
	}

	function checkError(action, elapsed) {
		if(Math.round(action) !== action || action < 0 || action > 6) {
			return 'Invalid action: ' + action;
		}
		if(elapsed > 50) {
			return 'Too long to respond: ' + elapsed + 'ms';
		}
		return '';
	}

	return class GameManager {
		constructor(random, {
			width,
			height,
			maxFrame,
			visibilityDistance,
			teams,
		}) {
			this.random = random;
			this.width = Math.round(width);
			this.height = Math.round(height);
			this.teams = teams;
			this.maxFrame = Math.max(Math.round(maxFrame), 1);
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
					y: Math.floor(startIndex / this.width),
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
					userID: null,
					codeSteps: 0,
					elapsedTime: 0,
				});
				this.bots.push(bot);
				this.updateEntry(entry);
			}));

			this.beginFrame();
		}

		updateEntry({id, code = null, pauseOnError = null, disqualified = null, userID = null}) {
			const entry = this.entryLookup.get(id);
			if(!entry) {
				throw new Error('Attempt to modify an entry which was not registered in the game');
			}
			if(code !== null) {
				const compiledCode = entryUtils.compile(code, [
					'move',
					'x',
					'y',
					'tCount',
					'eCount',
					'tNear',
					'eNear',
					'setMsg',
					'getMsg',
				], {pre: 'Math.random = extras.MathRandom;'});
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
			if(userID !== null) {
				entry.userID = userID;
			}
			this.entryLookup.forEach((otherEntry) => {
				if(
					otherEntry !== entry &&
					otherEntry.userID === entry.userID &&
					!otherEntry.disqualified
				) {
					entry.disqualified = true;
					entry.error = 'Only one entry per user';
				}
			});
		}

		updateConfig({maxFrame, visibilityDistance}) {
			this.maxFrame = Math.max(Math.round(maxFrame), 1);
			this.visDist2 = visibilityDistance * visibilityDistance;
		}

		moveBot(bot, action) {
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

		getBotParams(bot) {
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
							id: otherEntry.userID,
						});
					}
					messages[otherEntry.userID] = otherBot.message;
				} else {
					messages[otherEntry.userID] = 'X';
				}
			});

			return {
				move: bot.moves + 1,
				x: bot.x,
				y: bot.y,
				tCount: counts[bot.teamIndex],
				eCount: counts[1 - bot.teamIndex],
				tNear: nearby[bot.teamIndex],
				eNear: nearby[1 - bot.teamIndex],
				messages,
			};
		}

		handleError(entry, params, action, error) {
			entry.errorInput = JSON.stringify(params);
			entry.errorOutput = JSON.stringify(action);
			entry.error = (
				error + ' (gave ' + entry.errorOutput +
				' for ' + entry.errorInput + ')'
			);
			if(entry.pauseOnError) {
				this.random.rollback();
				throw 'PAUSE';
			}
		}

		stepBot(index) {
			this.random.save();
			const bot = this.bots[index];
			const entry = this.entryLookup.get(bot.entry);
			if(entry.disqualified || !bot.alive) {
				return false;
			}

			const params = this.getBotParams(bot);

			let error = null;
			let elapsed = 0;
			let action = null;

			const oldRandom = Math.random;
			try {
				const begin = performance.now();
				action = entry.fn(
					makeAPIParams(bot, entry, params),
					makeAPIExtras({
						console: entry.console,
						random: this.random,
					})
				);
				elapsed = performance.now() - begin;

				error = checkError(action, elapsed);
			} catch(e) {
				error = entryUtils.stringifyEntryError(e);
			}
			Math.random = oldRandom;

			entry.elapsedTime += elapsed;
			++ entry.codeSteps;

			if(error) {
				this.handleError(entry, params, action, error);
			} else {
				this.moveBot(bot, action);
			}
			++ bot.moves;

			return true;
		}

		beginFrame() {
			// Randomise order
			arrayUtils.shuffleInPlace(this.bots, this.random);
			this.currentBot = 0;
		}

		stepOneBot() {
			if(this.frame >= this.maxFrame) {
				return;
			}
			const begin = performance.now();

			let moved = false;
			for(; !moved; ++ this.currentBot) {
				if(this.currentBot === this.bots.length) {
					this.beginFrame();
					++ this.frame;
					if(this.frame >= this.maxFrame) {
						return;
					}
				}

				const movingTeamIndex = (this.frame % 2);
				if(this.bots[this.currentBot].teamIndex === movingTeamIndex) {
					moved = this.stepBot(this.currentBot);
				}
			}

			this.simulationTime += performance.now() - begin;
		}

		stepAllBots() {
			if(this.frame >= this.maxFrame) {
				return;
			}
			const begin = performance.now();

			if(this.currentBot === this.bots.length) {
				this.beginFrame();
				++ this.frame;
				if(this.frame >= this.maxFrame) {
					return;
				}
			}

			const movingTeamIndex = (this.frame % 2);
			for(; this.currentBot < this.bots.length; ++ this.currentBot) {
				if(this.bots[this.currentBot].teamIndex === movingTeamIndex) {
					this.stepBot(this.currentBot);
				}
			}

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
				currentBot: this.currentBot,
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
	};
});
