define(['core/array_utils', 'fetch/entry_utils'], (array_utils, entry_utils) => {
	'use strict';

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
		if(queen.team === worker.team && worker.food > 0) {
			// Give food to own queen
			++ queen.food;
			-- worker.food;
			return true;
		}
		if(queen.team !== worker.team && queen.food > 0 && worker.food < 1) {
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
				food: Boolean(v & SV_FOOD),
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

	function findCache(team, hash, view) {
		const v = team.cacheView[hash];
		if(v && checkEqualView(v, view)) {
			return team.cacheAct[hash];
		}
		return null;
	}

	function putCache(team, hash, view, action) {
		team.cacheView[hash] = view;
		team.cacheAct[hash] = action;
	}

	function checkError(action, ant, view) {
		if(typeof action !== 'object') {
			return 'Returned ' + (typeof action);
		}
		if(typeof action.cell !== 'number') {
			return 'Returned action.cell of type ' + (typeof action.cell);
		}
		if((action.cell|0) !== action.cell) {
			return 'Returned non-integer action.cell: ' + action.cell;
		}
		if(action.cell < 0 || action.cell > 8) {
			return 'Returned out-of-range action.cell: ' + action.cell;
		}
		if(action.color) {
			if(action.type) {
				return 'Returned both color and type';
			}
			if(typeof action.color !== 'number') {
				return 'Returned action.color of type ' + (typeof action.color);
			}
			if((action.color|0) !== action.color) {
				return 'Returned non-integer action.color: ' + action.color;
			}
			if(action.color < 1 || action.color > 8) {
				return 'Returned out-of-range action.color: ' + action.color;
			}
		} else if(action.type) {
			if(typeof action.type !== 'number') {
				return 'Returned action.type of type ' + (typeof action.type);
			}
			if((action.type|0) !== action.type) {
				return 'Returned non-integer action.type: ' + action.type;
			}
			if(action.type < 1 || action.type > WORKER_TYPES) {
				return 'Returned out-of-range action.type: ' + action.type;
			}
			if(ant.type !== QUEEN) {
				return 'Non-queen cannot create workers';
			}
			if(!ant.food) {
				return 'No food left to create workers';
			}
			if(view[action.cell] & (SV_ANT_TYPE | SV_FOOD)) {
				return 'Cannot spawn ant on non-empty square';
			}
		} else {
			if(action.cell !== CENTRE && view[action.cell] & SV_ANT_TYPE) {
				return 'Cannot move to non-empty square';
			}
			if(ant.type !== QUEEN && ant.food && view[action.cell] & SV_FOOD) {
				return 'Cannot move to food while carrying food';
			}
		}

		return '';
	}

	return class GameManager {
		constructor(random, {width, height, foodRatio, maxFrame, entries}) {
			this.random = random;
			this.width = width|0;
			this.height = height|0;
			this.maxFrame = Math.max(maxFrame|0, 1);
			const area = this.width * this.height;
			this.frame = 0;
			this.currentAnt = 0;
			this.simulationTime = 0;
			this.board = new Uint8Array(area);
			this.antGrid = array_utils.makeList(area, null);
			this.entries = [];
			this.ants = [];
			this.nextAntID = 0;

			const foodCount = (area * foodRatio)|0;
			const queenCount = entries.length;

			// Randomly position all food & queens without overlaps
			// (inefficient, but predictable performance regardless of coverage)
			const positions = [];
			let remaining = foodCount + queenCount;
			for(let i = 0; i < area; ++ i) {
				if(this.random.next(area - i) < remaining) {
					positions.push(i);
					-- remaining;
				}
			}

			// Take queenCount positions for queens; the rest will be food
			for(let i = 0; i < queenCount; ++ i) {
				const positionIndex = this.random.next(positions.length);
				const startIndex = positions.splice(positionIndex, 1)[0];

				const code = entry_utils.compile(entries[i].code, ['view']);
				const queen = {
					id: (this.nextAntID ++),
					team: i,
					type: QUEEN,
					x: startIndex % this.width,
					y: (startIndex / this.width)|0,
					i: startIndex,
					food: 0,
				};
				this.entries.push({
					id: i,
					fn: code.fn,
					cacheView: array_utils.makeList(CACHE_SIZE, null),
					cacheAct: array_utils.makeList(CACHE_SIZE, null),
					active: !code.compileError,
					error: code.compileError,
					errorInput: null,
					errorOutput: null,
					queen,
					workerCounts: array_utils.makeList(WORKER_TYPES, 0),
					antSteps: 0,
					elapsedTime: 0,
				});
				this.ants.push(queen);
				this.antGrid[queen.i] = queen;
			}

			// Ensure random competitor order
			array_utils.shuffleInPlace(this.ants, this.random);

			// All remaining positions are food
			for(let i = 0; i < positions.length; ++ i) {
				setFoodAtI(this.board, positions[i], true);
			}
		}

		updateConfig({maxFrame}) {
			this.maxFrame = Math.max(maxFrame|0, 1);
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
					team: ant.team,
					type: action.type,
					x: p.x,
					y: p.y,
					i: p.i,
					food: 0,
				};
				++ this.entries[newAnt.team].workerCounts[newAnt.type - 1];
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

		generateView(target, p, team, rotation) {
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
						((ant.team === team) ? SV_FRIEND : 0)
					) : 0)
				);
				target[i] = value;
				hash += PRIMES[i] * value;
			}
			return hash % CACHE_SIZE;
		}

		stepAnt(index) {
			const ant = this.ants[index];
			const team = this.entries[ant.team];
			if(!team.active) {
				return;
			}
			const view = SHARED_VIEW;
			const rotation = this.random.next(4);
			const hash = this.generateView(view, ant, ant.team, rotation);
			let action = findCache(team, hash, view);
			if(!action) {
				let error = null;
				let elapsed = 0;
				try {
					const apiView = viewToAPI(view);
					const begin = performance.now();
					action = team.fn(apiView);
					elapsed = performance.now() - begin;
					error = checkError(action, ant, view);
				} catch(e) {
					error = e.toString();
				}
				if(error) {
					team.active = false;
					team.error = error;
					team.errorInput = JSON.stringify(viewToAPI(view));
					team.errorOutput = JSON.stringify(action);
					return;
				}
				const viewCopy = [];
				for(let i = 0; i < 9; ++ i) {
					viewCopy[i] = view[i];
				}
				putCache(team, hash, viewCopy, action);
				team.elapsedTime += elapsed;
				++ team.antSteps;
			}
			this.moveAnt(index, ant, action, rotation);
		}

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
			if(type === 'ant') {
				this.stepOneAnt();
			} else {
				this.stepAllAnts();
			}
		}

		getState() {
			return {
				frame: this.frame,
				over: this.frame >= this.maxFrame,
				currentAnt: this.currentAnt,
				simulationTime: this.simulationTime,
				board: this.board,
				entries: this.entries.map((entry) => ({
					id: entry.id,
					food: entry.queen.food,
					queen: this.ants.indexOf(entry.queen),
					workers: entry.workerCounts,
					antSteps: entry.antSteps,
					elapsedTime: entry.elapsedTime,
					active: entry.active,
					error: entry.error,
					errorInput: entry.errorInput,
					errorOutput: entry.errorOutput,
				})),
				ants: this.ants.map((ant) => ({
					id: ant.id,
					team: ant.team.id,
					type: ant.type,
					x: ant.x,
					y: ant.y,
					food: ant.food,
				})),
			};
		}
	}
});
