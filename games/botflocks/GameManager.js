define([
	'core/arrayUtils',
	'fetch/entryUtils',
], (
	arrayUtils,
	entryUtils
) => {
	'use strict';

	const MOVES = [
		{x:-1, y:-1},
		{x: 0, y:-1},
		{x: 1, y:-1},
		{x:-1, y: 0},
		{x: 1, y: 0},
		{x:-1, y: 1},
		{x: 0, y: 1},
		{x: 1, y: 1},
	];

	function botNear(x, y, dist) {
		return ((bot) => (Math.max(
			Math.abs(x - bot.x),
			Math.abs(y - bot.y)
		) <= dist));
	}

	function interpretAction(bot, action, width, height) {
		if(!action) {
			return {type: -1, tx: 0, ty: 0};
		}
		const delta = MOVES[(action - 1) % MOVES.length];
		const tx = bot.x + delta.x;
		const ty = bot.y + delta.y;
		if(tx < 0 || ty < 0 || tx >= width || ty >= height) {
			return {type: -1, tx: 0, ty: 0};
		}
		const type = Math.floor((action - 1) / MOVES.length);
		return {type, tx, ty};
	}

	function makeAPIExtras(entry, {console}, {width, height, board, visibilityDist}) {
		let sendSet = new Set();
		let sendGrid = [];
		entry.bots.forEach((bot) => {
			//For whatever reason, the board is stored in column-major order
			//Hence the iteration order
			for (let dy = -Math.floor(visibilityDist); dy <= visibilityDist; dy++) {
				if (dy+bot.y < 0) {
					continue;
				} else if (dy+bot.y >= height) {
					break;
				}
				for (let dx = -Math.floor(visibilityDist); dx <= visibilityDist; dx++) {
					if (dx+bot.x < 0) {
						continue;
					} else if (dx+bot.x >= width) {
						break;
					}
					if (!sendSet.has(`${bot.x+dx}/${bot.y+dy}`)) {
						sendGrid.push([bot.x+dx, bot.y+dy, board[(bot.y+dy)*width+bot.x+dx]]);
						sendSet.add(`${bot.x+dx}/${bot.y+dy}`);
					}
				}
			}
		});
		return {
			gridView: sendGrid,
			consoleTarget: console,
		};
	}

	function checkError(bots, actions, elapsed) {
		if(!Array.isArray(actions) || actions.length !== bots.length) {
			return 'Invalid action: ' + actions;
		}
		for(let i = 0; i < actions.length; ++ i) {
			const action = actions[i];
			if(Math.round(action) !== action || action < 0 || action > 24) {
				return 'Invalid action for bot ' + i + ': ' + action;
			}
		}
		if(elapsed > 20) {
			return 'Too long to respond: ' + elapsed + 'ms';
		}
		return '';
	}

	return class GameManager {
		constructor(random, {
			width,
			height,
			floorHeight,
			flockSize,
			maxFrame,
			visibilitySquare,
			goalTimeLimit,
			teams,
		}) {
			this.random = random;
			this.width = Math.round(width);
			this.height = Math.round(height);
			this.maxFrame = Math.max(Math.round(maxFrame), 1);
			this.visibilityDist = Math.max(Math.floor((visibilitySquare - 1) / 2), 1);
			this.goalTimeLimit = Math.max(Math.round(goalTimeLimit), 1);
			this.currentEntry = 0;
			this.frame = 0;
			this.simulationTime = 0;
			this.goal = {x: 0, y: 0};
			this.goalLife = 0;
			this.entryLookup = new Map();

			const area = this.width * this.height;

			this.board = new Uint8Array(area);

			for(let y = height - floorHeight; y < height; ++ y) {
				for(let x = 0; x < width; ++ x) {
					this.board[y * width + x] = 1;
				}
			}

			let sideInfos = [
				{p1: true, x: 0, y: height - floorHeight - 1, dx: 1, dy: 0},
				{p1: false, x: width - 1, y: height - floorHeight - 1, dx: -1, dy: 0},
			];
			this.teams = teams.map((team, teamIndex) => {
				const sideInfo = sideInfos[teamIndex % 2];
				return {
					id: team.id,
					entries: team.entries.map((entry) => {
						const bots = [];
						for(let i = 0; i < flockSize; ++ i) {
							bots.push({
								x: sideInfo.x,
								y: sideInfo.y,
								hasWall: false,
							});
							sideInfo.x += sideInfo.dx;
							sideInfo.y += sideInfo.dy;
						}
						const o = {
							id: entry.id,
							fn: null,
							pauseOnError: false,
							disqualified: false,
							error: null,
							errorInput: null,
							errorOutput: null,
							console: [],
							p1: sideInfos.p1,
							answerID: null,
							bots,
							moves: 0,
							points: 0,
							codeSteps: 0,
							elapsedTime: 0,
						};
						this.entryLookup.set(entry.id, o);
						this.updateEntry(entry);
						return o;
					}),
				};
			});
			this.pickNewGoal();
		}

		updateEntry({id, code = null, pauseOnError = null, disqualified = null, answerID = null}) {
			const entry = this.entryLookup.get(id);
			if(!entry) {
				throw new Error('Attempt to modify an entry which was not registered in the game');
			}
			if(code !== null) {
				let prevMem = (entry.getMem)?entry.getMem():'';
				const compiledCode = entryUtils.compile({
					initCode: `
						Math.random = MathRandom;
						let mem = prevMem;
						this.getMem = ()=>{return mem};
						this.setMem = (newMem) => {
							if (typeof newMem === 'string') {
								mem = newMem.slice(0, 256);
							}
						};
					`,
					initParams: {
						MathRandom: this.random.floatGenerator(),
						prevMem,
					},
				}, {
					run: {
						code: code,
						paramNames: [
							'p1',
							'id',
							'eid',
							'move',
							'goal',
							'bots',
							'ebots',
							'getMem',
							'setMem',
						],
						pre: `
							let gridArray = [];
							extras.gridView.forEach((ent) => {
								if (!gridArray.hasOwnProperty(ent[0])) {
									gridArray[ent[0]] = [];
								}
								gridArray[ent[0]][ent[1]] = ent[2];
							});
							let grid = (x, y) => {
								let testValEnt = gridArray[x];
								let testVal = testValEnt?testValEnt[y]:undefined;
								return (testVal === undefined)?-1:testVal;
							};
						`,
					},
					getMem: {
						code: `
							return getMem();
						`,
						paramNames: [
							'getMem',
						],
					},
				});
				entry.fn = compiledCode.fns.run;
				entry.getMem = compiledCode.fns.getMem;
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
			if(answerID !== null) {
				entry.answerID = answerID;
			}
		}

		updateConfig({maxFrame, visibilitySquare, goalTimeLimit}) {
			this.maxFrame = Math.max(Math.round(maxFrame), 1);
			this.visibilityDist = Math.max(Math.floor((visibilitySquare - 1) / 2), 1);
			this.goalTimeLimit = Math.max(Math.round(goalTimeLimit), 1);
		}

		botAt(x, y) {
			return this.teams.some((team) =>
				team.entries.some((entry) =>
					entry.bots.some((bot) =>
						(bot.x === x && bot.y === y)
					)
				)
			);
		}

		pickNewGoal() {
			let x = 0;
			let y = 0;
			for (;;) {
				const p = this.random.next(this.width * this.height);
				x = p % this.width;
				y = Math.floor(p / this.width);
				if(!this.botAt(x, y)) {
					break;
				}
			}
			this.goal.x = x;
			this.goal.y = y;
			this.goalLife = this.goalTimeLimit;
		}

		wallAt(x, y) {
			if(x < 0 || y < 0 || x >= this.width || y >= this.height) {
				return false;
			}
			return this.board[y * this.width + x] === 1;
		}

		getEntryParams(entry, enemyTeams) {
			const enemyBots = [];
			let anyEnemyEntry = null;
			enemyTeams.forEach((enemyTeam) =>
				enemyTeam.entries.forEach((enemyEntry) => {
					if(!anyEnemyEntry) {
						anyEnemyEntry = enemyEntry;
					}
					enemyEntry.bots.forEach((enemyBot) => {
						if(entry.bots.some(botNear(enemyBot.x, enemyBot.y, this.visibilityDist))) {
							enemyBots.push({
								x: enemyBot.x,
								y: enemyBot.y,
								hasWall: enemyBot.hasWall,
							});
						}
					});
				})
			);
			arrayUtils.shuffleInPlace(enemyBots, this.random);
			return {
				p1: entry.p1,
				id: entry.answerID,
				eid: anyEnemyEntry.answerID,
				move: entry.moves + 1,
				goal: {
					x: this.goal.x,
					y: this.goal.y,
				},
				bots: entry.bots.map((bot) => ({
					x: bot.x,
					y: bot.y,
					hasWall: bot.hasWall,
				})),
				ebots: enemyBots,
				memory: entry.getMem(),
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

		moveBot(entry, bot, action) {
			const {type, tx, ty} = interpretAction(bot, action, this.width, this.height);
			switch(type) {
			case -1: // NoOp
				break;
			case 0: // Move
				if(!this.wallAt(tx, ty) && MOVES.some((d) => this.wallAt(tx + d.x, ty + d.y))) {
					bot.x = tx;
					bot.y = ty;
					if(bot.x === this.goal.x && bot.y === this.goal.y) {
						++ entry.points;
						this.goal.x = -1; // Mark for repositioning
					}
				}
				break;
			case 1: // Grab
				if(!bot.hasWall && this.wallAt(tx, ty)) {
					bot.hasWall = true;
					this.board[ty * this.width + tx] = 0;
				}
				break;
			case 2: // Place
				if(bot.hasWall && !this.wallAt(tx, ty)) {
					bot.hasWall = false;
					this.board[ty * this.width + tx] = 1;
				}
				break;
			}
		}

		moveEntry(entry, actions) {
			actions.forEach((action, i) => {
				this.moveBot(entry, entry.bots[i], action);
			});
			if(this.goal.x < 0) {
				this.pickNewGoal();
			}
		}

		stepEntry(entry, enemyTeams) {
			this.random.save();
			if(entry.disqualified) {
				return false;
			}

			const params = this.getEntryParams(entry, enemyTeams);

			let error = null;
			let elapsed = 0;
			let action = null;

			const oldRandom = Math.random;
			try {
				const begin = performance.now();
				action = entry.fn(
					params,
					makeAPIExtras(entry, {
						console: entry.console,
					}, {
						width: this.width,
						height: this.height,
						board: this.board,
						visibilityDist: this.visibilityDist,
					})
				);
				elapsed = performance.now() - begin;

				error = checkError(entry.bots, action, elapsed);
			} catch(e) {
				error = entryUtils.stringifyEntryError(e);
			}
			Math.random = oldRandom;

			entry.elapsedTime += elapsed;
			++ entry.codeSteps;

			if(error) {
				this.handleError(entry, params, action, error);
			} else {
				this.moveEntry(entry, action);
			}
			++ entry.moves;

			return true;
		}

		endFrame() {
			if((-- this.goalLife) === 0) {
				this.pickNewGoal();
			}
			++ this.frame;
			this.currentEntry = 0;
		}

		step(type) {
			if(this.frame >= this.maxFrame) {
				return;
			}
			const begin = performance.now();

			const movingTeamIndex = (this.frame % this.teams.length);
			const enemyTeams = [];
			this.teams.forEach((team, index) => {
				if(index !== movingTeamIndex) {
					enemyTeams.push(team);
				}
			});

			// Step entries for team
			const team = this.teams[movingTeamIndex];
			for(; this.currentEntry < team.entries.length; ++ this.currentEntry) {
				const moved = this.stepEntry(team.entries[this.currentEntry], enemyTeams);
				if(moved && type === 'single') {
					break;
				}
			}
			if(this.currentEntry === team.entries.length) {
				this.endFrame();
			}
			this.simulationTime += performance.now() - begin;
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
				board: this.board,
				target: this.goal,
				teams: this.teams.map((teamState) => ({
					id: teamState.id,
					entries: teamState.entries.map((entryState) => {
						return {
							id: entryState.id,
							codeSteps: entryState.codeSteps,
							elapsedTime: entryState.elapsedTime,
							disqualified: entryState.disqualified,
							error: entryState.error,
							errorInput: entryState.errorInput,
							errorOutput: entryState.errorOutput,
							console: entryState.console,

							points: entryState.points,
							bots: entryState.bots,
						};
					}),
				})),
			};
		}
	};
});
