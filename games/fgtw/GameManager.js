define([
	'fetch/entryUtils',
], (
	entryUtils
) => {
	'use strict';

	function checkError(action) {
		if(typeof action !== 'object') {
			return 'Invalid action: ' + action;
		}
		if(!Array.isArray(action.shots)) {
			return 'Invalid shots: ' + action.shots;
		}
		if(action.shots.some((shot) => (typeof shot !== 'number' || Math.round(shot) !== shot))) {
			return 'Invalid shots: ' + JSON.stringify(action.shots);
		}
		if(typeof action.move !== 'number' && Math.round(action.move) !== action.move) {
			return 'Invalid movement: ' + action.move;
		}
		if(action.reload !== undefined && typeof action.reload !== 'boolean') {
			return 'Invalid reload: ' + action.reload;
		}
		return '';
	}

	function getAttributeValue(attributes, attribute) {
		const v = attributes[attribute];
		if(typeof v !== 'number' || Math.round(v) !== v) {
			throw 'Invalid value for ' + attribute;
		}
		return v;
	}

	function shallowCopyArray(array) {
		return array.slice();
	}

	function applyCycle(surviving, cycleIndex) {
		surviving.forEach((entry) => {
			const shot = entry.currentShots[cycleIndex];
			if((!entry.alive && !entry.stagger) || !shot) {
				return;
			}
			-- entry.currentBullets;
			entry.shotHistory[entry.shotHistory.length - 1].push(shot);
			surviving.forEach((enemyEntry) => {
				if(
					enemyEntry !== entry &&
					enemyEntry.alive &&
					enemyEntry.cell === shot &&
					(entry.alive || enemyEntry.speed <= entry.speed)
				) {
					enemyEntry.alive = false;
					enemyEntry.stagger = (enemyEntry.speed >= entry.speed);
					++ entry.kills;
				}
			});
		});
	}

	function bulletsForCycle(surviving, cycleIndex) {
		return surviving.some((entry) => entry.currentShots[cycleIndex]);
	}

	return class GameManager {
		constructor(random, {
			seed,
			teams,
			cells,
			initialCell,
			freeBullets,
			bulletCost,
			baseReloadSpeed,
			reloadCost,
			freeShotsPerTurn,
			shotPerTurnCost,
			freeMoveSpeed,
			moveSpeedCost,
			totalPoints,
			maxFrame,
		}) {
			this.random = random; // a seeded random object you can use

			this.cells = cells;
			this.freeBullets = freeBullets;
			this.bulletCost = bulletCost;
			this.baseReloadSpeed = baseReloadSpeed;
			this.reloadCost = reloadCost;
			this.freeShotsPerTurn = freeShotsPerTurn;
			this.shotPerTurnCost = shotPerTurnCost;
			this.freeMoveSpeed = freeMoveSpeed;
			this.moveSpeedCost = moveSpeedCost;
			this.totalPoints = totalPoints;
			this.maxFrame = maxFrame;

			this.teams = teams;
			this.entries = [];
			this.currentPlayers = [];
			this.entryLookup = new Map();
			this.frame = 0;
			this.cycle = 0;
			this.completedFrame = 0;
			this.completedCycle = 0;
			this.over = false;

			teams.forEach((team) => team.entries.forEach((entry) => {
				const entryObj = {
					id: entry.id,
					pauseOnError: false,
					disqualified: false,
					error: null,
					errorInput: null,
					errorOutput: null,
					console: [],
					mainFn: null,
					currentAction: null,
					currentShots: [],
					moved: false,
					cell: initialCell,
					cellHistory: [initialCell],
					shotHistory: [],
					bullets: 0,
					reloadSpeed: 0,
					shots: 0,
					speed: 0,
					currentBullets: 0,
					reloadCounter: 0,
					alive: true,
					stagger: false,
					kills: 0,
					score: 0,
					codeSteps: 0,
					elapsedTime: 0,
				};
				this.entries.push(entryObj);
				this.entryLookup.set(entry.id, entryObj);
				this.updateEntry(entry);
				entryObj.currentBullets = entryObj.bullets;
			}));
		}

		applyAttributes(entry, attributes) {
			const bullets = getAttributeValue(attributes, 'numbOfBullets');
			const reload = getAttributeValue(attributes, 'reloadSpeed');
			const shots = getAttributeValue(attributes, 'shotsPerTurn');
			const speed = getAttributeValue(attributes, 'moveSpeed');
			if(bullets < this.freeBullets) {
				throw 'Invalid number of bullets: ' + bullets;
			}
			if(reload > this.baseReloadSpeed || reload < 1) {
				throw 'Invalid reload speed: ' + bullets;
			}
			if(shots < this.freeShotsPerTurn) {
				throw 'Invalid shots per turn: ' + shots;
			}
			if(speed < this.freeMoveSpeed) {
				throw 'Invalid movement speed: ' + speed;
			}
			const cost = (
				(bullets - this.freeBullets) * this.bulletCost +
				(this.baseReloadSpeed - reload) * this.reloadCost +
				(shots - this.freeShotsPerTurn) * this.shotPerTurnCost +
				(speed - this.freeMoveSpeed) * this.moveSpeedCost
			);
			if(cost !== this.totalPoints) {
				throw 'Invalid point allocation; used ' + cost + '/' + this.totalPoints;
			}
			entry.bullets = bullets;
			entry.reloadSpeed = reload;
			entry.shots = shots;
			entry.speed = speed;
		}

		updateEntry({id, code = null, pauseOnError = null, disqualified = null}) {
			const entry = this.entryLookup.get(id);
			if(!entry) {
				throw new Error('Attempt to modify an entry which was not registered in the game');
			}
			if(code !== null) {
				const compiledCode = entryUtils.compile(
					code + '\nreturn {attributes, main};',
					[]
				);
				if(compiledCode.compileError) {
					entry.disqualified = true;
					entry.error = compiledCode.compileError;
				} else {
					const oldRandom = Math.random;
					Math.random = () => {
						return this.random.next(0x100000000) / 0x100000000;
					};
					try {
						const functions = compiledCode.fn({}, {});
						const attributes = functions.attributes.call({});
						this.applyAttributes(entry, attributes);
						entry.mainFn = functions.main;
						// Automatically un-disqualify entries when code is updated
						entry.error = null;
						entry.disqualified = false;
					} catch(e) {
						entry.disqualified = true;
						entry.error = String(e);
					}
					Math.random = oldRandom;
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
		}

		updateConfig({cells, maxFrame}) {
			this.cells = cells;
			this.maxFrame = maxFrame;
		}

		handleError(entry, params, action, error) {
			entry.errorInput = JSON.stringify(params);
			entry.errorOutput = JSON.stringify(action);
			entry.error = (
				error + ' (gave ' + entry.errorOutput +
				' for ' + entry.errorInput + ')'
			);
			// pauseOnError is not reliable due to too much private state
			if(entry.pauseOnError) {
				this.random.rollback();
				throw 'PAUSE';
			}
		}

		stepEntry(entry) {
			entry.currentAction = {
				move: 0,
				reload: false,
				shots: [],
			};

			if(entry.disqualified || !entry.alive) {
				return;
			}

			const enemyEntry = this.entries.find((e) => (e !== entry));

			const params = {
				bulletsLeft: entry.currentBullets,
				yourShots: entry.shotHistory.map(shallowCopyArray),
				enemyShots: enemyEntry.shotHistory.map(shallowCopyArray),
				yourMovement: shallowCopyArray(entry.cellHistory),
				enemyMovement: shallowCopyArray(enemyEntry.cellHistory),
			};

			let action = null;
			let error = null;
			let elapsed = 0;

			const oldRandom = Math.random;
			Math.random = () => {
				return this.random.next(0x100000000) / 0x100000000;
			};
			try {
				const begin = performance.now();
				action = entry.mainFn.call(
					{},
					params.bulletsLeft,
					params.yourShots,
					params.enemyShots,
					params.yourMovement,
					params.enemyMovement
				);
				elapsed = performance.now() - begin;

				error = checkError(action);
			} catch(e) {
				error = entryUtils.stringifyEntryError(e);
			}
			Math.random = oldRandom;

			entry.elapsedTime += elapsed;
			++ entry.codeSteps;

			if(error) {
				this.handleError(entry, params, action, error);
			} else {
				entry.currentAction = action;
			}
		}

		moveEntries() {
			this.entries.forEach((entry) => {
				entry.moved = false;
				entry.currentShots.length = 0;
				if(!entry.alive) {
					return;
				}
				const action = entry.currentAction;
				const move = action.move;
				if(
					move !== entry.cell &&
					move >= 1 &&
					move <= this.cells &&
					Math.abs(move - entry.cell) <= entry.speed
				) {
					entry.cell = move;
					entry.moved = true;
				}

				if(entry.reloadCounter > 0) {
					entry.reloadCounter -= (entry.moved ? 1 : 2);
					if(entry.reloadCounter <= 0) {
						entry.currentBullets = entry.bullets;
						entry.reloadCounter = 0;
					}
				} else if(action.reload || entry.currentBullets <= 0) {
					entry.reloadCounter = entry.reloadSpeed;
				}

				let maxShots = 0;
				if(entry.reloadCounter === 0) {
					maxShots = Math.min(
						entry.currentBullets,
						entry.shots + (entry.moved ? 0 : 1)
					);
				}
				entry.cellHistory.push(entry.cell);
				const shots = action.shots.slice(0, maxShots);
				entry.currentShots = shots;
				entry.shotHistory.push([]);
			});
		}

		checkVictory(survivors) {
			if(survivors.length === 1) {
				// outright victor: 2 points
				this.currentPlayers.forEach((entry) => {
					entry.score = entry.alive ? 2 : 0;
				});
				this.over = true;
			} else if(survivors.length === 0) {
				// draw: 1 point for all recently deceased
				this.currentPlayers.forEach((entry) => {
					entry.score = 1;
				});
				this.over = true;
			}
		}

		step() {
			if(this.over) {
				return;
			}

			if(this.cycle === 0) {
				this.random.save();
				this.entries.forEach(this.stepEntry.bind(this));
				this.moveEntries();

				// Sort fastest-to-slowest
				this.currentPlayers = this.entries.filter((e) => e.alive);
				this.currentPlayers.sort((e1, e2) => (e2.speed - e1.speed));
			} else {
				applyCycle(this.currentPlayers, this.cycle - 1);

				const survivors = this.currentPlayers.filter((e) => e.alive);
				this.checkVictory(survivors);
				this.currentPlayers = survivors;
			}

			this.completedCycle = this.cycle;
			this.completedFrame = this.frame;

			++ this.cycle;

			if(!bulletsForCycle(this.currentPlayers, this.cycle - 1)) {
				this.cycle = 0;
				++ this.frame;
				if(this.frame >= this.maxFrame) {
					this.over = true;
				}
			}
		}

		isOver() {
			return this.over;
		}

		getState() {
			return {
				// Framework data
				over: this.isOver(),
				progress: this.isOver() ? 1 : (this.frame / this.maxFrame),

				// Game specific data
				frame: this.frame,
				cycle: this.cycle,
				completedFrame: this.completedFrame,
				completedCycle: this.completedCycle,
				teams: this.teams.map((team) => ({
					id: team.id,
					entries: team.entries.map((entry) => {
						const entryState = this.entryLookup.get(entry.id);
						return {
							id: entryState.id,
							disqualified: entryState.disqualified,

							error: entryState.error,
							errorInput: entryState.errorInput,
							errorOutput: entryState.errorOutput,
							console: entryState.console,
							codeSteps: entryState.codeSteps,
							elapsedTime: entryState.elapsedTime,

							score: entryState.score,
							alive: entryState.alive,
							kills: entryState.kills,
							cell: entryState.cell,
							bullets: entryState.bullets,
							reloadSpeed: entryState.reloadSpeed,
							shots: entryState.shots,
							speed: entryState.speed,
							currentBullets: entryState.currentBullets,
							reloadCounter: entryState.reloadCounter,

							shotHistory: entryState.shotHistory,
							cellHistory: entryState.cellHistory,
						};
					}),
				})),
			};
		}
	};
});
