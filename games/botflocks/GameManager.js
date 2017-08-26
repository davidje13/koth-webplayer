define(['core/array_utils', 'fetch/entry_utils'], (array_utils, entry_utils) => {
	'use strict';

	function botNear(x, y, dist) {
		return ((bot) => Math.max(
			Math.abs(x - bot.x),
			Math.abs(y - bot.y),
		) <= dist);
	}

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

	return class GameManager {
		constructor(random, {width, height, floorHeight, flockSize, maxFrame, visibilitySquare, goalTimeLimit, teams}) {
			this.random = random;
			this.width = width|0;
			this.height = height|0;
			this.maxFrame = Math.max(maxFrame|0, 1);
			this.visibilityDist = Math.max(((visibilitySquare - 1) / 2)|0, 1);
			this.goalTimeLimit = Math.max(goalTimeLimit|0, 1);
			this.frame = 0;
			this.simulationTime = 0;
			this.goal = {x: 0, y: 0};
			this.goalLife = 0;

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
						const code = entry_utils.compile(
							'Math.random = MathRandom;\n' +
							entry.code,
							[
								'p1',
								'id',
								'eid',
								'move',
								'goal',
								'grid',
								'bots',
								'ebots',
								'getMem',
								'setMem',
								'MathRandom',
							]
						);

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
						return {
							id: entry.id,
							fn: code.fn,
							disqualified: Boolean(code.compileError),
							error: code.compileError,
							errorInput: null,
							errorOutput: null,
							p1: sideInfos.p1,
							answer_id: entry.answer_id,
							bots,
							memory: '',
							moves: 0,
							points: 0,
							codeSteps: 0,
							elapsedTime: 0,
						};
					}),
				};
			});
			this.pickNewGoal();
		}

		updateConfig({maxFrame, visibilitySquare, goalTimeLimit}) {
			this.maxFrame = Math.max(maxFrame|0, 1);
			this.visibilityDist = Math.max(((visibilitySquare - 1) / 2)|0, 1);
			this.goalTimeLimit = Math.max(goalTimeLimit|0, 1);
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
			while(true) {
				const p = this.random.next(this.width * this.height);
				x = p % this.width;
				y = (p / this.width)|0;
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

		moveBot(entry, bot, action) {
			if(!action) {
				return;
			}
			const delta = MOVES[(action - 1) % MOVES.length];
			const tx = bot.x + delta.x;
			const ty = bot.y + delta.y;
			if(tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) {
				return;
			}
			const type = Math.floor((action - 1) / MOVES.length);
			switch(type) {
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

		stepEntry(entry, enemyTeams) {
			if(entry.disqualified) {
				return;
			}

			let error = null;
			let elapsed = 0;
			let action = undefined;

			const oldRandom = Math.random;
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
					})
				})
			);
			array_utils.shuffleInPlace(enemyBots, this.random);
			const params = {
				p1: entry.p1,
				id: entry.answer_id,
				eid: anyEnemyEntry.answer_id,
				move: ++ entry.moves,
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
				memory: entry.memory,
			};
			try {
				const begin = performance.now();
				action = entry.fn(
					params.p1,
					params.id,
					params.eid,
					params.move,
					params.goal,
					(x, y) => { // grid(x, y)
						if((x|0) !== x || (y|0) !== y) {
							return -1;
						}
						if(x < 0 || y < 0 || x >= this.width || y >= this.height) {
							return -1;
						}
						const nearest = this.visibilityDist + 1;
						if(entry.bots.some(botNear(x, y, this.visibilityDist))) {
							return this.board[y * this.width + x];
						} else {
							return -1;
						}
					},
					params.bots,
					params.ebots,
					() => { // getMem()
						return entry.memory;
					},
					(msg) => { // setMem(message)
						if(typeof msg === 'string' && msg.length <= 256) {
							entry.memory = msg;
						}
					},
					() => { // Math.random replacement
						return this.random.next(0x100000000) / 0x100000000;
					},
				);
				elapsed = performance.now() - begin;

				if(!Array.isArray(action) || action.length !== entry.bots.length) {
					error = 'Invalid action: ' + action;
				} else {
					action.forEach((act, i) => {
						if((act|0) !== act || act < 0 || act > 24) {
							error = 'Invalid action for bot ' + i + ': ' + act;
						}
					});
				}
				if(!error && elapsed > 20) {
					error = 'Too long to respond: ' + elapsed + 'ms';
				}
			} catch(e) {
				error = 'Threw ' + e.toString();
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
				action.forEach((act, i) => {
					this.moveBot(entry, entry.bots[i], act);
				});
				if(this.goal.x < 0) {
					this.pickNewGoal();
				}
			}
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

			// Step all entries for team
			const team = this.teams[movingTeamIndex];
			for(let i = 0; i < team.entries.length; ++ i) {
				this.stepEntry(team.entries[i], enemyTeams);
			}
			if((-- this.goalLife) === 0) {
				this.pickNewGoal();
			}

			++ this.frame;
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
				teams: this.teams.map((team) => ({
					id: team.id,
					entries: team.entries.map((entry) => {
						return {
							id: entry.id,
							codeSteps: entry.codeSteps,
							elapsedTime: entry.elapsedTime,
							disqualified: entry.disqualified,
							error: entry.error,
							errorInput: entry.errorInput,
							errorOutput: entry.errorOutput,

							points: entry.points,
							bots: entry.bots,
						};
					}),
				})),
			};
		}
	}
});
