define([
	'core/EventObject',
	'terminal-kit',
	'node/logger',
	'node/ProcessWorker',
	'node/DisplayCommons',
], (
	EventObject,
	termkit,
	logger,
	ProcessWorker,
	DisplayCommons
) => {
	'use strict';
	/* globals process */
	class GameProgress {
		constructor(name, seed, parentLogArea) {
			this.name = name;
			this.progress = 0;
			this.logArea = parentLogArea.openHandle(name);
			this.logArea.log('Seed ' + seed);
		}

		updateProgress(progress, scores) {
			this.progress = progress;
			if (progress >= 1) {
				this.logArea.log({progress, scores}, 'info');
			}
		}
	}

	class MatchSummary {
		constructor({name = 'Match', seed = '', teams}, parentLogArea) {
			this.name = name;
			this.teamScores = new Map();
			this.progress = 0;
			this.logArea = parentLogArea.openHandle(this.name);
			this.logArea.log('Seed ' + seed);
		}

		addGame(seed, name) {
			this.logArea.log('Creating ' + name);
			let game = new GameProgress(name, seed, this.logArea);
			return game;
		}

		updateProgress(progress, scores) {
			//First, determine which scores go into which boxes
			this.progress = progress;
			scores.teams.forEach((gameTeamScore) => {
				this.teamScores.set(gameTeamScore.id, gameTeamScore.score);
			});
			if (progress >= 1) {
				this.logArea.log({progress, scores}, 'info');
			} else {
				this.logArea.log({progress, scores}, 'silly');
			}
		}
	}

	return class MatchwiseSummary extends EventObject {
		constructor({
			name = 'Tournament',
			seed = '',
			quiet = false,
			disqualifyReaction = null,
			errorReaction = null,
		}) {
			super();
			this.name = name;
			this.phase = 0;
			this.tournamentSeed = 'T' + seed;
			this.pendingMatches = [];
			this.currentMatches = [];
			this.pastMatches = [];
			this.teams = [];
			this.progress = 0;
			this.quiet = quiet;
			this.teamTable = new Map();
			this.ttyLoopRunning = false;
			this.logArea = logger.topLevel.openHandle(name);
			this.logArea.log('Seed T' + seed);
			this.disqualifyReaction = disqualifyReaction;
			this.errorReaction = errorReaction;
			process.nextTick(this.ttyInit.bind(this));
		}

		ttyLayHeaders() {
			//Get the easy ones out of the way
			this.ttyInfo.header.put({
				attr: DisplayCommons.tournamentHeaderAttr,
				x: 0, y: 0,
			}, '%s', (' ').repeat(this.ttyInfo.width));
			this.ttyInfo.header.put({
				attr: DisplayCommons.tournamentHeaderAttr,
				x: 0, y: 0,
			}, '%s', this.name);
			let nameWidth = termkit.stringWidth(this.name);
			let seedWidth = termkit.stringWidth(this.tournamentSeed);
			if (nameWidth + seedWidth < this.ttyInfo.width) {
				this.ttyInfo.header.put({
					attr: DisplayCommons.tournamentHeaderAttr,
					x: this.ttyInfo.width - seedWidth, y: 0,
				}, '%s', this.tournamentSeed);
			}
			if (nameWidth + seedWidth < this.ttyInfo.width-27) {
				this.ttyInfo.header.put({
					attr: DisplayCommons.tournamentHeaderAttr,
					x: this.ttyInfo.width - seedWidth - 26, y: 0,
				}, '%s', DisplayCommons.getProgressString(this.progress, this.phase, 200));
			}
			let numActive = ProcessWorker.getActiveWorkerCount();
			let numInactive = ProcessWorker.getInactiveWorkerCount();
			if (nameWidth + seedWidth < this.ttyInfo.width-28-(numActive+numInactive)*4) {
				this.ttyInfo.header.put({
					attr: DisplayCommons.tournamentHeaderAttr,
					x: this.ttyInfo.width - seedWidth - 27 - (numActive+numInactive)*4, y: 0,
				}, '%s', DisplayCommons.spinIndicator[this.phase].repeat(numActive));
				this.ttyInfo.header.put({
					attr: DisplayCommons.tournamentHeaderAttr,
					x: this.ttyInfo.width - seedWidth - 27 - numInactive*4, y: 0,
				}, '%s', '[  ]'.repeat(numInactive));
			}
		}

		ttyLayoutNames() {
			//Called when an entry changes
			let maxWidth = 6;
			for (let team of this.teamTable) {
				for (let entry of team[1].entries) {
					if (termkit.stringWidth(entry.title) > maxWidth) {
						maxWidth = termkit.stringWidth(entry.title);
					}
				}
			}
			return maxWidth;
		}

		ttyLaySubheaders() {
			this.ttyInfo.header.put({
				attr: DisplayCommons.subheaderAttr1,
				x: 0, y: 1,
			}, '%s', (' ').repeat(this.ttyInfo.nameLength));
			this.ttyInfo.header.put({
				attr: DisplayCommons.subheaderAttr1,
				x: 0, y: 1,
			}, 'Player');
			this.ttyInfo.header.put({
				attr: DisplayCommons.subheaderAttr2,
				x: this.ttyInfo.nameLength, y: 1,
			}, '%s', (' ').repeat(6));
			this.ttyInfo.header.put({
				attr: DisplayCommons.subheaderAttr1,
				x: this.ttyInfo.nameLength+6, y: 1,
			}, '%s', (' ').repeat(6));
			this.ttyInfo.header.put({
				attr: DisplayCommons.subheaderAttr2,
				x: this.ttyInfo.nameLength, y: 1,
			}, '%s', '  Mean');
			this.ttyInfo.header.put({
				attr: DisplayCommons.subheaderAttr1,
				x: this.ttyInfo.nameLength+6, y: 1,
			}, '%s', '   M-W');
			let xIndex = this.ttyInfo.nameLength+12;
			let n = 0;
			for (let i = 0; i < this.currentMatches.length; i++) {
				if (xIndex >= this.ttyInfo.width) {
					break;
				}
				let thisAttr = (n%2===1)?
					DisplayCommons.subheaderAttr3:
					DisplayCommons.subheaderAttr4;
				this.ttyInfo.header.put({attr: thisAttr, x:xIndex, y:1}, '%s', (' ').repeat(6));
				this.ttyInfo.header.put({
						attr: thisAttr,
						x: xIndex, y: 1,
					},
					'%s',
					DisplayCommons.getProgressString(
						this.currentMatches[i].progress,
						this.phase
					)
				);
				this.ttyInfo.header.put({
					attr: thisAttr,
					x: xIndex+6-termkit.stringWidth(this.currentMatches[i].name), y: 1,
				}, '%s', this.currentMatches[i].name);
				xIndex += 6;
				n++;
			}
			for (let i = 0; i < this.pastMatches.length; i++) {
				if (xIndex >= this.ttyInfo.width) {
					break;
				}
				let thisAttr = (n%2===1)?
					DisplayCommons.subheaderAttr5:
					DisplayCommons.subheaderAttr6;
				this.ttyInfo.header.put({attr: thisAttr, x:xIndex, y:1}, '%s', (' ').repeat(4));
				this.ttyInfo.header.put({
					attr: thisAttr,
					x: xIndex+4-termkit.stringWidth(this.pastMatches[i].name),
					y: 1,
				},'%s', this.pastMatches[i].name);
				xIndex += 4;
				n++;
			}
			if (xIndex < this.ttyInfo.width) {
				this.ttyInfo.header.put({
					attr: DisplayCommons.bgAttr,
					x: xIndex,
					y: 1,
				}, '%s', (' ').repeat(this.ttyInfo.width-xIndex));
			}
		}

		ttyTranscribe() {
			this.ttyInfo.buffer.resize({
				x: 1, y: 1,
				width: this.ttyInfo.width, height: this.ttyInfo.height,
			});
			this.ttyInfo.buffer.fill({attr: DisplayCommons.bgAttr, char: ' '});
			this.ttyInfo.header.resize({x: 0, y: 0, width: this.ttyInfo.width, height:2,});
			this.ttyInfo.header.fill({attr: DisplayCommons.bgAttr, char:' '});
			this.ttyInfo.middle.resize({
				x: 0, y: 2,
				width: this.ttyInfo.width, height:this.ttyInfo.height-2,
			});
			this.ttyInfo.middle.fill({attr: DisplayCommons.bgAttr, char:' '});
			this.ttyLayHeaders();
			this.ttyLaySubheaders();
			this.ttyInfo.header.draw({x: 0, y: 0});
			let yIndex = 0;
			let obj = this;
			this.teams.sort(function(a,b) {
				let cand1 = obj.teamTable.get(b.id).score - obj.teamTable.get(a.id).score;
				if (isFinite(cand1) && cand1 !== 0) {
					return cand1;
				}
				let cand2 = obj.teamTable.get(a.id).certainty - obj.teamTable.get(b.id).certainty;
				if (isFinite(cand2) && cand2 !== 0) {
					return cand2;
				}
				return (a.id < b.id)?1:-1;
			});
			let numOrder = 0;
			for (let team of this.teams) {
				if (yIndex >= this.ttyInfo.height) {
					break;
				}
				this.ttyInfo.teamBlocks.get(team.id).transcribe({
					yIndex: yIndex,
					currentGames: this.currentMatches,
					pastGames: this.pastMatches,
					maxLength: this.ttyInfo.width,
					attrPhase: (numOrder+1)%2,
					nameLength: this.ttyInfo.nameLength,
				});
				yIndex += this.teamTable.get(team.id).entries.length;
				numOrder++;
			}
			this.ttyInfo.middle.draw({x: 0, y: 2});
			//Confusingly, the buffer dumping area is off by one
			//This is the only place where the adjustment is made,
			//everyone else can zero-index freely
			this.ttyInfo.buffer.draw({x: 1, y: 1});
		}

		ttyUpdateLoop() {
			if (this.ttyFire === true) {
				if (!this.quiet) {
					this.ttyTranscribe();
				}
				if (this.progress < 1) {
					setTimeout(this.ttyUpdateLoop.bind(this), 100);
					this.phase = (this.phase+1)%8;
				} else {
					this.logArea.log('Tournament ended');
					this.cleanup();
					this.ttyLoopRunning = false;
				}
			}
		}

		cleanup() {
			if (!this.quiet) {
				termkit.terminal.removeListener('resize', this.resize);
				termkit.terminal.hideCursor(false);
				termkit.terminal.fullscreen(false);
			}
			process.off('exit', this.cleanExit);
		}

		cleanExit() {
			this.cleanup();
			termkit.terminal.processExit();
		}

		ttyResize(width, height) {
			this.ttyInfo.width = width;
			this.ttyInfo.height = height;
			this.ttyTranscribe();
		}

		ttyInit() {
			if (this.ttyFire === undefined) {
				this.ttyFire = true;
				if (!this.quiet) {
					let terminal = termkit.terminal;
					this.ttyInfo = {};
					this.ttyInfo.width = terminal.width;
					this.ttyInfo.height = terminal.height;
					let buf = termkit.ScreenBuffer.create({
						dst: terminal, x: 0, y: 0,
					});
					this.ttyInfo.buffer = buf;
					this.ttyInfo.header = termkit.ScreenBuffer.create({
						dst: buf, x: 0, y: 0, height: 2,
					});
					this.ttyInfo.middle = termkit.ScreenBuffer.create({
						dst: buf, x: 0, y: 0, height: terminal.height-2,
					});
					this.ttyInfo.nameLength = this.ttyLayoutNames();
					this.ttyInfo.teamBlocks = new Map();
					for (let team of this.teams) {
						this.ttyInfo.teamBlocks.set(team.id, new DisplayCommons.TeamBlock(
							team.id,
							this.teamTable,
							this.ttyInfo.middle,
							this.disqualifyReaction,
							this.errorReaction
						));
					}
					process.on('exit', this.cleanExit.bind(this));
					terminal.fullscreen();
					terminal.hideCursor();
					terminal.addListener('resize', this.ttyResize.bind(this));
				} else {
					this.ttyInfo = null;
				}
			}
		}

		createMatch(options) {
			this.ttyInit();
			for (let team of options.teams) {
				if (!this.teamTable.has(team.id)) {
					this.teams.push(team);
					this.teamTable.set(team.id, {
						score: 0,
						certainty: 0,
						entries: team.entries,
					});
					if (this.ttyInfo) {
						this.ttyInfo.nameLength = this.ttyLayoutNames();
						this.ttyInfo.teamBlocks.set(team.id, new DisplayCommons.TeamBlock(
							team.id,
							this.teamTable,
							this.ttyInfo.middle,
							this.disqualifyReaction,
							this.errorReaction
						));
					}
				}
			}
			this.logArea.log('Creating ' + options.name);
			let newMatch = new MatchSummary(options, this.logArea);
			this.pendingMatches.push(newMatch);
			return newMatch;
		}

		checkStatuses() {
			while (this.pendingMatches.length > 0) {
				let candidateIndex = this.pendingMatches.findIndex((element) => {
					return element.progress > 0;
				});
				if (candidateIndex >= 0) {
					let candidate = this.pendingMatches[candidateIndex];
					this.logArea.log(candidate.name + ' started', 'verbose');
					this.currentMatches.unshift(candidate);
					this.pendingMatches.splice(candidateIndex, 1);
				} else {
					break;
				}
			}
			while (this.currentMatches.length > 0) {
				let candidateIndex = this.currentMatches.findIndex((element) => {
					return element.progress >= 1;
				});
				if (candidateIndex >= 0) {
					let candidate = this.currentMatches[candidateIndex];
					this.logArea.log(candidate.name + ' completed', 'verbose');
					this.pastMatches.unshift(candidate);
					this.currentMatches.splice(candidateIndex, 1);
				} else {
					break;
				}
			}
		}

		updateProgress(progress, scores) {
			for (let team of scores[0].teams) {
				if (this.teamTable.has(team.id)) {
					Object.assign(this.teamTable.get(team.id), {
						score: team.score,
						certainty: team.certainty,
					});
				}
			}
			this.progress = progress;
			this.checkStatuses();
			if (!this.ttyLoopRunning) {
				this.ttyLoopRunning = true;
				this.ttyUpdateLoop();
			}
			if (progress >= 1) {
				this.logArea.log({progress, scores}, 'info');
			} else {
				this.logArea.log({progress, scores}, 'silly');
			}
		}
	};
});
