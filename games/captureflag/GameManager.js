define([
	'core/arrayUtils',
	'fetch/entryUtils',
], (
	arrayUtils,
	entryUtils
) => {
	'use strict';

	function pushAway(obj, from, dist) {
		const d = (
			(obj.x - from.x) * (obj.x - from.x) +
			(obj.y - from.y) * (obj.y - from.y)
		);
		if(d < dist * dist) {
			if(d <= 0) {
				obj.x = from.x;
				obj.y = from.y + dist;
				return;
			}
			const m = dist / Math.sqrt(d);
			obj.x = (obj.x - from.x) * m + from.x;
			obj.y = (obj.y - from.y) * m + from.y;
		}
	}

	function near(a, b, dist) {
		return (
			(a.x - b.x) * (a.x - b.x) +
			(a.y - b.y) * (a.y - b.y) <
			dist * dist
		);
	}

	function insideZone(obj, zone) {
		return (
			obj.x >= zone.x &&
			obj.y >= zone.y &&
			obj.x < zone.x + zone.w &&
			obj.y < zone.y + zone.h
		);
	}

	function deepCopy(o) {
		// TODO
		return Object.assign({}, o);
	}

	function makeAPIExtras({console, random}) {
		return {
			consoleTarget: console,
			MathRandom: () => {
				return random.next(0x100000000) / 0x100000000;
			},
		};
	}

	function checkError(action, elapsed) {
		if(typeof action !== 'object' || !action) {
			return 'Invalid action: ' + action;
		}
		if(typeof action.x !== 'number' || typeof action.y !== 'number') {
			return 'Invalid action delta: ' + action;
		}
		if(elapsed > 50) {
			return 'Too long to respond: ' + elapsed + 'ms';
		}
		return '';
	}

	return class GameManager {
		constructor(random, {
			teams,
			width,
			height,
			fieldPadding,
			spawnPadding,
			defenseRadius,
			touchDistance,
			initialStrength,
			maxStrength,
			jailStrength,
			strengthGrowth,
			maxFrame,
		}) {
			this.random = random;
			this.width = width;
			this.height = height;
			this.teams = teams;
			this.maxFrame = Math.max(Math.round(maxFrame), 1);
			this.frame = 0;
			this.simulationTime = 0;
			this.bots = [];
			this.touchDistance = touchDistance;
			this.fieldPadding = fieldPadding;
			this.defenseRadius = defenseRadius;
			this.maxStrength = maxStrength;
			this.jailStrength = jailStrength;
			this.strengthGrowth = strengthGrowth;
			this.winningTeam = null;
			this.entryLookup = new Map();

			this.teamObjects = [
				{ // Red
					jail: {
						x: this.width - fieldPadding,
						y: this.height - fieldPadding,
					},
					flag: {
						x: fieldPadding,
						y: this.height - fieldPadding,
						holder: null,
					},
					spawn: {
						x: spawnPadding,
						y: height / 2,
						w: width - spawnPadding * 2,
						h: height / 2 - spawnPadding,
					},
					captureZone: {
						x: -1,
						y: height / 2,
						w: width + 2,
						h: height / 2 + 1,
					},
					shared: {},
				},
				{ // Blue
					jail: {
						x: fieldPadding,
						y: fieldPadding,
					},
					flag: {
						x: this.width - fieldPadding,
						y: fieldPadding,
						holder: null,
					},
					spawn: {
						x: spawnPadding,
						y: spawnPadding,
						w: width - spawnPadding * 2,
						h: height / 2 - spawnPadding,
					},
					captureZone: {
						x: -1,
						y: -1,
						w: width + 2,
						h: height / 2 + 1,
					},
					shared: {},
				},
			];

			teams.forEach((team, teamIndex) => {
				team.entries.forEach((entry) => {
					const spawn = this.teamObjects[teamIndex].spawn;
					const bot = {
						id: this.bots.length,
						entry: entry.id,
						team: team.id,
						teamIndex,
						captured: false,
						captures: 0,
						infiltrations: 0,
						carrying: null,
						strength: initialStrength,
						moves: 0,
						x: random.next(spawn.w) + spawn.x,
						y: random.next(spawn.h) + spawn.y,
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
				});
			});

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
					'tJailed',
					'eJailed',
					'team',
					'enemies',
					'tFlag',
					'eFlag',
					'messages',
					'WIDTH',
					'HEIGHT',
					'FIELD_PADDING',
					'DEFENSE_RADIUS',
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

		updateConfig({maxFrame}) {
			this.maxFrame = Math.max(Math.round(maxFrame), 1);
		}

		imprison(bot, jail) {
			if(bot.carrying !== null) {
				const flag = this.teamObjects[bot.carrying].flag;
				flag.holder = null;
				bot.carrying = null;
			}
			bot.captured = true;
			bot.strength = this.jailStrength;
			bot.x = jail.x;
			bot.y = jail.y;
		}

		freePrisoners(teamIndex, jail) {
			let n = 0;
			const spawn = this.teamObjects[teamIndex].spawn;
			this.bots.forEach((bot) => {
				if(
					bot.teamIndex === teamIndex &&
					bot.captured &&
					bot.x === jail.x &&
					bot.y === jail.y
				) {
					++ n;
					bot.captured = false;
					bot.x = this.random.next(spawn.w) + spawn.x;
					bot.y = this.random.next(spawn.h) + spawn.y;
				}
			});
			return n;
		}

		declareWinner(teamIndex) {
			this.winningTeam = teamIndex;
		}

		moveBot(bot, entry, action) {
			if(bot.captured) {
				return;
			}
			const objs = this.teamObjects[bot.teamIndex];
			let dx = action.x;
			let dy = action.y;
			const distance = Math.sqrt(dx * dx + dy * dy);
			if(distance <= bot.strength) {
				bot.strength -= distance;
				bot.x += dx;
				bot.y += dy;
			}
			for(let rep = 0; rep < 10; ++ rep) {
				bot.x = Math.max(0, Math.min(this.width, bot.x));
				bot.y = Math.max(0, Math.min(this.height, bot.y));
				pushAway(bot, objs.jail, this.defenseRadius);
				if(objs.flag.holder === null) {
					pushAway(bot, objs.flag, this.defenseRadius);
				}
			}
			bot.strength = Math.min(
				this.maxStrength,
				bot.strength + this.strengthGrowth
			);
			this.bots.forEach((otherBot) => {
				const otherEntry = this.entryLookup.get(otherBot.entry);
				const otherObjs = this.teamObjects[otherBot.teamIndex];
				if(
					!otherEntry.disqualified &&
					!bot.captured &&
					!otherBot.captured &&
					near(bot, otherBot, this.touchDistance) &&
					otherBot.teamIndex !== bot.teamIndex
				) {
					if(insideZone(bot, otherObjs.captureZone)) {
						++ otherBot.captures;
						this.imprison(bot, otherObjs.jail);
					}
					if(insideZone(otherBot, objs.captureZone)) {
						++ bot.captures;
						this.imprison(otherBot, objs.jail);
					}
				}
			});
			if(bot.captured) {
				return;
			}
			this.teamObjects.forEach((otherObjs, teamIndex) => {
				if(teamIndex === bot.teamIndex) {
					return;
				}
				if(near(bot, otherObjs.jail, this.touchDistance)) {
					if(this.freePrisoners(bot.teamIndex, otherObjs.jail) > 0) {
						++ bot.infiltrations;
					}
				}
				if(
					bot.carrying === null &&
					otherObjs.flag.holder === null &&
					near(bot, otherObjs.flag, this.touchDistance)
				) {
					bot.carrying = teamIndex;
					otherObjs.flag.holder = entry.userID;
				}
			});
			if(bot.carrying) {
				const flag = this.teamObjects[bot.carrying].flag;
				flag.x = bot.x;
				flag.y = bot.y;
				if(insideZone(flag, objs.captureZone)) {
					this.declareWinner(bot.teamIndex);
				}
			}
		}

		getBotParams(bot, entry, objs) {
			const makeAPIBot = (b) => {
				return {
					x: b.x,
					y: b.y,
					strength: b.strength,
					id: this.entryLookup.get(b.entry).userID,
					isJailed: b.captured,
				};
			};

			const bots = this.bots.map(makeAPIBot);
			const team = (this.bots
				.filter((b) => (b.teamIndex === bot.teamIndex))
				.map(makeAPIBot)
			);
			const enemies = (this.bots
				.filter((b) => (b.teamIndex !== bot.teamIndex))
				.map(makeAPIBot)
			);
			const otherObjs = this.teamObjects[(bot.teamIndex === 1) ? 0 : 1];
			return {
				'this': bots.filter((b) => (b.id === entry.userID))[0],
				move: bot.moves,
				tJailed: team.filter((b) => b.isJailed),
				eJailed: enemies.filter((b) => b.isJailed),
				team,
				enemies,
				tFlag: {
					x: objs.flag.x,
					y: objs.flag.y,
					pickedUpBy: bots.filter((b) => (b.id === objs.flag.holder))[0] || null,
				},
				eFlag: {
					x: otherObjs.flag.x,
					y: otherObjs.flag.y,
					pickedUpBy: bots.filter((b) => (b.id === otherObjs.flag.holder))[0] || null,
				},
				messages: objs.shared, // mutable
				WIDTH: this.width,
				HEIGHT: this.height,
				FIELD_PADDING: this.fieldPadding,
				DEFENSE_RADIUS: this.defenseRadius,
			};
		}

		handleError(bot, params, action, error, sharedRollback) {
			const entry = this.entryLookup.get(bot.entry);
			entry.errorInput = JSON.stringify(params);
			entry.errorOutput = JSON.stringify(action);
			entry.error = (
				error + ' (gave ' + entry.errorOutput +
				' for ' + entry.errorInput + ')'
			);
			if(entry.pauseOnError) {
				this.random.rollback();
				this.teamObjects[bot.teamIndex].shared = sharedRollback;
				throw 'PAUSE';
			}
		}

		stepBot(index) {
			this.random.save();
			const bot = this.bots[index];
			const entry = this.entryLookup.get(bot.entry);
			if(entry.disqualified) {
				return false;
			}

			const objs = this.teamObjects[bot.teamIndex];
			const sharedRollback = deepCopy(objs.shared);
			const params = this.getBotParams(bot, entry, objs);

			let error = null;
			let elapsed = 0;
			let action = null;

			const oldRandom = Math.random;
			try {
				const begin = performance.now();
				action = entry.fn(
					params,
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
				this.handleError(bot, params, action, error, sharedRollback);
			} else {
				this.moveBot(bot, entry, action);
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

				moved = this.stepBot(this.currentBot);
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

			for(; this.currentBot < this.bots.length; ++ this.currentBot) {
				this.stepBot(this.currentBot);
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
			return (
				this.frame >= this.maxFrame ||
				this.winningTeam !== null
			);
		}

		getState() {
			return {
				// Framework data
				over: this.isOver(),
				progress: this.isOver() ? 1 : (this.frame / this.maxFrame),

				// Game specific data
				frame: this.frame,
				simulationTime: this.simulationTime,
				teams: this.teams.map((team, teamIndex) => {
					const objs = this.teamObjects[teamIndex];
					return {
						id: team.id,
						hasWon: (teamIndex === this.winningTeam),
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
								x: entryState.bot.x,
								y: entryState.bot.y,
								captured: entryState.bot.captured,
								captures: entryState.bot.captures,
								infiltrations: entryState.bot.infiltrations,
								strength: entryState.bot.strength,
								hasFlag: (entryState.bot.carrying !== null),
							};
						}),
						flag: {
							x: objs.flag.x,
							y: objs.flag.y,
							carrying: (objs.flag.holder !== null),
						},
						jail: {
							x: objs.jail.x,
							y: objs.jail.y,
						},
						spawn: objs.spawn,
						captureZone: objs.captureZone,
					};
				}),
			};
		}
	};
});
