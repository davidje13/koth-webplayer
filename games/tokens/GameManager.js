define([
	'fetch/entryUtils',
], (
	entryUtils
) => {
	'use strict';

	function checkError(action) {
		if(typeof action !== 'string') {
			return 'Invalid action: ' + action;
		}
		if(['UP', 'DOWN', 'RIGHT', 'LEFT', 'EAT', 'PASS'].indexOf(action) === -1) {
			return 'Unknown action: ' + action;
		}
		return '';
	}

	return class GameManager {
		constructor(random, {
			seed,
			teams,
			minSize,
			maxSize,
			maxValue,
			maxThinkingTime,
			bonusGrowth,
			fillFactor,
			idleTimeoutFactor,
			colourNames,
		}) {
			this.random = random;

			this.size = random.next(maxSize + 1 - minSize) + minSize;
			this.board = new Uint8Array(this.size * this.size);
			this.idleTimeout = Math.ceil(this.size * idleTimeoutFactor);
			this.maxThinkingTime = maxThinkingTime;
			this.bonusGrowth = bonusGrowth;
			this.colourNames = colourNames;
			this.colourCount = colourNames.length;

			const startX = random.next(this.size);
			const startY = random.next(this.size);
			const tokenCount = Math.round(this.size * fillFactor);
			for(let i = 0; i < tokenCount; ++ i) {
				// Challenge specifies that overlaps can occurr
				const tokenX = random.next(this.size);
				const tokenY = random.next(this.size);
				const tokenColour = random.next(this.colourCount);
				const tokenValue = random.next(maxValue) + 1;
				this.board[tokenY * this.size + tokenX] = (
					tokenValue * this.colourCount + tokenColour
				);
			}

			this.teams = teams;
			this.bots = [];
			this.entryLookup = new Map();
			this.lastCaptureFrame = 0;
			this.frame = 0;
			this.currentIndex = 0;
			this.over = false;

			teams.forEach((team, teamIndex) => team.entries.forEach((entry) => {
				const bot = {
					id: this.bots.length,
					entry: entry.id,
					team: team.id,
					score: 0,
					lastColour: null,
					lastBonus: 0,
					x: startX,
					y: startY,
				};

				this.entryLookup.set(entry.id, {
					id: entry.id,
					obj: null,
					pauseOnError: false,
					disqualified: false,
					error: null,
					errorInput: null,
					errorOutput: null,
					console: [],
					bot,
					first: teamIndex === 0,
					codeSteps: 0,
					elapsedTime: 0,
				});
				this.bots.push(bot);
				this.updateEntry(entry);
			}));
		}

		updateEntry({id, code = null, pauseOnError = null, disqualified = null}) {
			const entry = this.entryLookup.get(id);
			entry.code = code;
			if(!entry) {
				throw new Error('Attempt to modify an entry which was not registered in the game');
			}
			if(code !== null) {
				const compiledCode = entryUtils.compile({
					initCode: `
						this._f = ${code};
						this._obj = {};
						this._expand = (val) => {
							'use strict';
							if (val === undefined) {
								return undefined;
							} else if (val === -1) {
								return false;
							} else {
								return {
									color: colours[val%colours.length],
									points: Math.floor(val/colours.length)
								};
							}
						};
					`,
					initParams: {
						colours: this.colourNames,
					},
					initSloppy: true,
				}, {
					init: {
						code: 'Object.assign(_obj, new _f(first));',
						paramNames: ['_f', '_obj', 'first'],
					},
					run: {
						//Expands a packed representation of the board in place
						//rather than transferring the whole thing
						pre: `
							let board = extras.b.map((column) => (
								column.map((elm) => (params._expand(elm)))
							));
							Object.assign(params.state, {tokens: board});
						`,
						code: 'return _obj.yourMove(state);',
						paramNames: ['_obj', '_expand', 'state'],
					},
				});
				if(compiledCode.compileError) {
					entry.disqualified = true;
					entry.error = compiledCode.compileError;
				} else {
					const oldRandom = Math.random;
					Math.random = this.random.floatGenerator();
					try {
						compiledCode.fns.init(entry.first);
						entry.fn = compiledCode.fns.run;
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

		updateConfig({idleTimeoutFactor, maxThinkingTime, bonusGrowth}) {
			this.idleTimeout = Math.ceil(this.size * idleTimeoutFactor);
			this.maxThinkingTime = maxThinkingTime;
			this.bonusGrowth = bonusGrowth;
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

		botToAPI(bot) {
			return {
				pos: [bot.x, bot.y],
				score: bot.score,
				colorBonus: bot.lastBonus,
				lastColor: this.colourNames[bot.lastColour],
			};
		}

		colourOf(token) {
			return token % this.colourCount;
		}

		valueOf(token) {
			return Math.floor(token / this.colourCount);
		}

		boardToAPI() {
			const tokens = [];
			for(let x = 0; x < this.size; ++ x) {
				const column = [];
				for(let y = 0; y < this.size; ++ y) {
					const token = this.board[y * this.size + x];
					if(token) {
						column.push(token);
					} else {
						column.push(-1);
					}
				}
				tokens.push(column);
			}
			return tokens;
		}

		consumeToken(bot) {
			const p = bot.y * this.size + bot.x;
			const token = this.board[p];
			if(!token) {
				return;
			}
			const c = this.colourOf(token);
			if(c === bot.lastColour) {
				bot.lastBonus += this.bonusGrowth;
				bot.score += bot.lastBonus;
			} else {
				bot.lastBonus = 0;
			}
			bot.lastColour = c;
			bot.score += this.valueOf(token);
			this.board[p] = 0;
			this.lastCaptureFrame = this.frame;
			if(this.remainingTokens() === 0) {
				this.over = true;
			}
		}

		moveBot(bot, action) {
			switch(action) {
			case 'UP':
				if(bot.y > 0) {
					-- bot.y;
				}
				break;
			case 'DOWN':
				if(bot.y < this.size - 1) {
					++ bot.y;
				}
				break;
			case 'RIGHT':
				if(bot.x < this.size - 1) {
					++ bot.x;
				}
				break;
			case 'LEFT':
				if(bot.x > 0) {
					-- bot.x;
				}
				break;
			case 'EAT':
				this.consumeToken(bot);
				break;
			}
		}

		stepBot(bot) {
			this.random.save();

			const entry = this.entryLookup.get(bot.entry);
			if(entry.disqualified || this.over) {
				return;
			}

			const params = {
				player1: this.botToAPI(this.bots[0]),
				player2: this.botToAPI(entry.first ? this.bots[1] : bot),
			};
			let action = null;
			let error = null;
			let elapsed = 0;

			const oldRandom = Math.random;
			Math.random = this.random.floatGenerator();
			try {
				const begin = performance.now();
				action = entry.fn({state: params}, {
					b: this.boardToAPI(),
					consoleTarget: entry.console,
				});
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
				this.moveBot(bot, action);
			}
		}

		step(type) {
			if(this.over) {
				return;
			}
			if(type === 'single') {
				this.stepBot(this.bots[this.currentIndex]);
				++ this.currentIndex;
				if(this.currentIndex >= this.bots.length) {
					this.currentIndex = 0;
					++ this.frame;
				}
			} else {
				for(; this.currentIndex < this.bots.length; ++ this.currentIndex) {
					this.stepBot(this.bots[this.currentIndex]);
				}
				this.currentIndex = 0;
				++ this.frame;
			}
			if(this.frame > this.lastCaptureFrame + this.idleTimeout) {
				this.over = true;
			}
		}

		isOver() {
			return this.over;
		}

		remainingTokens() {
			let count = 0;
			for(let i = 0; i < this.size * this.size; ++ i) {
				if(this.board[i]) {
					++ count;
				}
			}
			return count;
		}

		estimatedProgress() {
			if(this.over) {
				return 1;
			}
			const remainingFramesGuess = Math.max(
				1,
				this.remainingTokens() * this.size -
				(this.frame - this.lastCaptureFrame)
			);
			return this.frame / (this.frame + remainingFramesGuess);
		}

		getState() {
			return {
				// Framework data
				over: this.isOver(),
				progress: this.estimatedProgress(),

				// Game specific data
				frame: this.frame,
				board: this.board,
				size: this.size,
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

							x: entryState.bot.x,
							y: entryState.bot.y,
							score: entryState.bot.score,
							lastColour: entryState.bot.lastColour,
							lastBonus: entryState.bot.lastBonus,
						};
					}),
				})),
			};
		}
	};
});
