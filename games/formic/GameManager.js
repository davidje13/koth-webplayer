define([
	'core/arrayUtils',
	'fetch/entryUtils',
], (
	arrayUtils,
	entryUtils
) => {
	'use strict';

	/* jshint -W016 */ // bit operations used extensively for speed

	const QUEEN = 5;
	const WORKER_TYPES = 4;
	const CENTRE = 4;

	const FOOD_BIT = 0x08;
	const COLOUR_BITS = 0x07;

	const ROTATIONS = [
		[0, 1, 2, 3, 4, 5, 6, 7, 8],
		[6, 3, 0, 7, 4, 1, 8, 5, 2],
		[8, 7, 6, 5, 4, 3, 2, 1, 0],
		[2, 5, 8, 1, 4, 7, 0, 3, 6],
	];

	const DELTAS = [
		{x: -1, y: -1},
		{x:  0, y: -1},
		{x:  1, y: -1},
		{x: -1, y:  0},
		{x:  0, y:  0},
		{x:  1, y:  0},
		{x: -1, y:  1},
		{x:  0, y:  1},
		{x:  1, y:  1},
	];

	const SV_ANT_TYPE = 0x07;
	const SV_COLOUR_SHIFT = 3;
	const SV_FOOD = FOOD_BIT << SV_COLOUR_SHIFT;
	const SV_FRIEND = 0x80;
	const SV_ANT_FOOD_SHIFT = 8;

	const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23];

	const CACHE_SIZE = 0x1234;

	const SHARED_VIEW = []; // reusable array to reduce memory growth

	function transferFood(worker, queen) {
		if(queen.entry === worker.entry && worker.food > 0) {
			// Give food to own queen
			++ queen.food;
			-- worker.food;
			return true;
		}
		if(queen.entry !== worker.entry && queen.food > 0 && worker.food < 1) {
			// Steal food from other queens
			-- queen.food;
			++ worker.food;
			return true;
		}
		return false;
	}

	function foodAtI(board, i) {
		return Boolean(board[i] & FOOD_BIT);
	}

	function setColourAtI(board, i, col) {
		board[i] = (col - 1) | (board[i] & FOOD_BIT);
	}

	function setFoodAtI(board, i, present) {
		board[i] = (board[i] & COLOUR_BITS) | (present ? FOOD_BIT : 0);
	}

	function viewToAPI(view) {
		const api = [];
		for(let i = 0; i < 9; ++ i) {
			const v = view[i];
			const type = (v & SV_ANT_TYPE);
			api[i] = {
				color: ((v >>> SV_COLOUR_SHIFT) & COLOUR_BITS) + 1,
				// Original challenge implementation uses ints, not bools, for food
				food: Boolean(v & SV_FOOD) ? 1 : 0,
				ant: type ? {
					type,
					food: v >>> SV_ANT_FOOD_SHIFT,
					friend: Boolean(v & SV_FRIEND),
				} : null,
			};
		}
		return api;
	}

	function checkEqualView(view1, view2) {
		for(let i = 0; i < 9; ++ i) {
			if(view1[i] !== view2[i]) {
				return false;
			}
		}
		return true;
	}

	function findCache(entry, hash, view) {
		const v = entry.cacheView[hash];
		if(v && checkEqualView(v, view)) {
			return entry.cacheAct[hash];
		}
		return null;
	}

	function putCache(entry, hash, view, action) {
		entry.cacheView[hash] = view;
		entry.cacheAct[hash] = action;
	}

	function checkIntRange(v, low, high) {
		if(typeof v !== 'number') {
			return false;
		}
		if(Math.round(v) !== v) {
			return false;
		}
		if(v < low || v > high) {
			return false;
		}
		return true;
	}

	function checkError(action, ant, view) {
		/* jshint -W074 */ // complexity is justified!

		if(typeof action !== 'object') {
			return 'Returned ' + (typeof action);
		}
		if(!checkIntRange(action.cell, 0, 8)) {
			return 'Returned bad action.cell: ' + String(action.cell);
		}
		const target = view[action.cell];
		if(action.color) {
			if(action.type) {
				return 'Returned both color and type';
			}
			if(!checkIntRange(action.color, 1, 8)) {
				return 'Returned bad action.color: ' + String(action.color);
			}
		} else if(action.type) {
			if(!checkIntRange(action.type, 1, WORKER_TYPES)) {
				return 'Returned bad action.type: ' + String(action.type);
			}
			if(ant.type !== QUEEN) {
				return 'Non-queen cannot create workers';
			}
			if(!ant.food) {
				return 'No food left to create workers';
			}
			if(target & (SV_ANT_TYPE | SV_FOOD)) {
				return 'Cannot spawn ant on non-empty square';
			}
		} else {
			if(action.cell !== CENTRE && (target & SV_ANT_TYPE)) {
				return 'Cannot move to non-empty square';
			}
			if(ant.type !== QUEEN && ant.food && (target & SV_FOOD)) {
				return 'Cannot move to food while carrying food';
			}
		}

		return '';
	}

	return class GameManager {
		constructor(random, {
			width,
			height,
			foodRatio,
			maxFrame,
			teams,
		}) {
			this.random = random;
			this.width = Math.round(width);
			this.height = Math.round(height);
			this.teams = teams;
			this.maxFrame = Math.max(Math.round(maxFrame), 1);
			const area = this.width * this.height;
			this.frame = 0;
			this.currentAnt = 0;
			this.simulationTime = 0;
			this.board = new Uint8Array(area);
			this.antGrid = arrayUtils.makeList(area, null);
			this.entryLookup = new Map();
			this.ants = [];
			this.nextAntID = 0;

			const foodCount = Math.round(area * foodRatio);

			let entryCount = 0;
			teams.forEach((team) => entryCount += team.entries.length);

			// Randomly position all food & queens without overlaps
			// (inefficient, but predictable performance regardless of coverage)
			const positions = [];
			let remaining = foodCount + entryCount;
			for(let i = 0; i < area; ++ i) {
				if(this.random.next(area - i) < remaining) {
					positions.push(i);
					-- remaining;
				}
			}

			// Take one position for each queen; the rest will be food
			teams.forEach((team) => team.entries.forEach((entry) => {
				const positionIndex = this.random.next(positions.length);
				const startIndex = positions.splice(positionIndex, 1)[0];

				const queen = {
					id: (this.nextAntID ++),
					entry: entry.id,
					type: QUEEN,
					x: startIndex % this.width,
					y: Math.floor(startIndex / this.width),
					i: startIndex,
					food: 0,
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
					queen,
					workerCounts: arrayUtils.makeList(WORKER_TYPES, 0),
					cacheView: arrayUtils.makeList(CACHE_SIZE, null),
					cacheAct: arrayUtils.makeList(CACHE_SIZE, null),
					codeSteps: 0,
					elapsedTime: 0,
				});
				this.ants.push(queen);
				this.antGrid[queen.i] = queen;
				this.updateEntry(entry);
			}));

			// Ensure random competitor order
			arrayUtils.shuffleInPlace(this.ants, this.random);

			// All remaining positions are food
			for(let i = 0; i < positions.length; ++ i) {
				setFoodAtI(this.board, positions[i], true);
			}
		}

		updateEntry({id, code = null, pauseOnError = null, disqualified = null}) {
			const entry = this.entryLookup.get(id);
			if(!entry) {
				throw new Error('Attempt to modify an entry which was not registered in the game');
			}
			if(code !== null) {
				const compiledCode = entryUtils.compile(code, ['view']);
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
				entry.cacheView.fill(null);
				entry.cacheAct.fill(null);
			}
			if(pauseOnError !== null) {
				entry.pauseOnError = pauseOnError;
			}
			if(disqualified !== null) {
				entry.disqualified = disqualified;
			}
		}

		updateConfig({maxFrame}) {
			this.maxFrame = Math.max(Math.round(maxFrame), 1);
		}

		indexFromPos(pos) {
			return pos.y * this.width + pos.x;
		}

		antAt(pos) {
			return this.antGrid[this.indexFromPos(pos)];
		}

		colourAt(pos) {
			return (this.board[this.indexFromPos(pos)] & COLOUR_BITS) + 1;
		}

		foodAt(pos) {
			return foodAtI(this.board, this.indexFromPos(pos));
		}

		offsetPos(pos, delta) {
			const d = DELTAS[delta];
			let x = pos.x + d.x;
			let y = pos.y + d.y;

			// Fast modulo
			if(x === -1) {
				x = this.width - 1;
			} else if(x === this.width) {
				x = 0;
			}
			if(y === -1) {
				y = this.height - 1;
			} else if(y === this.height) {
				y = 0;
			}

			return {x, y, i: y * this.width + x};
		}

		moveAnt(index, ant, action, rotation) {
			const p = this.offsetPos(ant, ROTATIONS[rotation][action.cell]);
			if(action.color) {
				setColourAtI(this.board, p.i, action.color);
			} else if(action.type) {
				const newAnt = {
					id: (this.nextAntID ++),
					entry: ant.entry,
					type: action.type,
					x: p.x,
					y: p.y,
					i: p.i,
					food: 0,
				};
				++ this.entryLookup.get(newAnt.entry).workerCounts[newAnt.type - 1];
				this.ants.splice(index + 1, 0, newAnt);
				this.antGrid[newAnt.i] = newAnt;
				-- ant.food;
			} else if(action.cell !== CENTRE) {
				if(foodAtI(this.board, p.i)) {
					++ ant.food;
					setFoodAtI(this.board, p.i, false);
				}
				this.antGrid[ant.i] = null;
				this.antGrid[p.i] = ant;
				ant.x = p.x;
				ant.y = p.y;
				ant.i = p.i;
			}
			if(ant.type !== QUEEN) {
				for(let i = 0; i < 9; ++ i) {
					const target = this.antGrid[this.offsetPos(ant, i).i];
					if(
						target && target.type === QUEEN &&
						transferFood(ant, target)
					) {
						break;
					}
				}
			}
		}

		generateView(target, p, entry, rotation) {
			const rot = ROTATIONS[rotation];
			let hash = 0;
			for(let i = 0; i < 9; ++ i) {
				const index = this.offsetPos(p, rot[i]).i;
				const ant = this.antGrid[index];
				const value = (
					(this.board[index] << SV_COLOUR_SHIFT) |
					(ant ? (
						ant.type |
						(ant.food << SV_ANT_FOOD_SHIFT) |
						((ant.entry === entry) ? SV_FRIEND : 0)
					) : 0)
				);
				target[i] = value;
				hash += PRIMES[i] * value;
			}
			return hash % CACHE_SIZE;
		}

		handleError(entry, index, view, action, error) {
			entry.errorInput = JSON.stringify(viewToAPI(view));
			entry.errorOutput = JSON.stringify(action);
			entry.error = (
				error + ' (gave ' + entry.errorOutput +
				' for ' + entry.errorInput + ')'
			);
			if(entry.pauseOnError) {
				this.random.rollback();
				this.currentAnt = index + 1;
				throw 'PAUSE';
			} else {
				entry.disqualified = true;
			}
		}

		stepAnt(index) {
			this.random.save();
			const ant = this.ants[index];
			const entry = this.entryLookup.get(ant.entry);
			if(entry.disqualified) {
				return;
			}

			const view = SHARED_VIEW;
			const rotation = this.random.next(4);
			const hash = this.generateView(view, ant, ant.entry, rotation);

			let error = null;
			let elapsed = 0;
			let action = findCache(entry, hash, view);

			if(action) {
				this.moveAnt(index, ant, action, rotation);
				return;
			}

			try {
				const apiView = viewToAPI(view);
				const begin = performance.now();
				action = entry.fn({view: apiView}, {consoleTarget: entry.console});
				elapsed = performance.now() - begin;
				error = checkError(action, ant, view);
			} catch(e) {
				error = entryUtils.stringifyEntryError(e);
			}

			entry.elapsedTime += elapsed;
			++ entry.codeSteps;

			if(error) {
				this.handleError(entry, index, view, action, error);
			} else {
				const viewCopy = [];
				for(let i = 0; i < 9; ++ i) {
					viewCopy[i] = view[i];
				}
				putCache(entry, hash, viewCopy, action);
				this.moveAnt(index, ant, action, rotation);
			}
		}

		// TODO: maybe extract frame/step/maxFrames/isOver/progress logic for
		// typical bot-based games into a reusable base class

		stepOneAnt() {
			if(this.frame >= this.maxFrame) {
				return;
			}
			const begin = performance.now();

			this.currentAnt = (this.currentAnt || this.ants.length) - 1;
			this.stepAnt(this.currentAnt);

			if(this.currentAnt === 0) {
				++ this.frame;
			}
			this.simulationTime += performance.now() - begin;
		}

		stepAllAnts() {
			if(this.frame >= this.maxFrame) {
				return;
			}
			const begin = performance.now();

			// Step all ants
			for(let i = (this.currentAnt || this.ants.length); (i --) > 0;) {
				this.stepAnt(i);
			}

			this.currentAnt = 0;
			++ this.frame;
			this.simulationTime += performance.now() - begin;
		}

		step(type) {
			if(type === 'single') {
				this.stepOneAnt();
			} else {
				this.stepAllAnts();
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
				currentAnt: this.currentAnt,
				simulationTime: this.simulationTime,
				board: this.board,
				teams: this.teams.map((team) => ({
					id: team.id,
					entries: team.entries.map((entry) => {
						const entryState = this.entryLookup.get(entry.id);
						return {
							id: entry.id,
							food: entryState.queen.food,
							queen: this.ants.indexOf(entryState.queen),
							workers: entryState.workerCounts,
							codeSteps: entryState.codeSteps,
							elapsedTime: entryState.elapsedTime,
							disqualified: entryState.disqualified,
							error: entryState.error,
							errorInput: entryState.errorInput,
							errorOutput: entryState.errorOutput,
							console: entryState.console,
						};
					}),
				})),
				ants: this.ants.map((ant) => ({
					id: ant.id,
					entry: ant.entry,
					type: ant.type,
					x: ant.x,
					y: ant.y,
					food: ant.food,
				})),
			};
		}
	};
});
