define([
	'terminal-kit',
], (
	termkit
) => {
	'use strict';
	//Stuff that is shared between the two display kinds

	const spinIndicator = ['[⠡⠀]','[⠁⠂]','[⠐⠈]','[⠀⠌]','[⠀⢂]','[⠠⢀]','[⡀⠄]','[⡐⠀]'];
	const progressBar = ['⠀', '⠁','⠃','⠇','⡇','⡏','⡟','⡿','⣿'];

	const bgAttr = termkit.ScreenBuffer.object2attr({defaultBgColor: true});

	const fillAttr1 = termkit.ScreenBuffer.object2attr({bgColor: 52});
	const fillAttr2 = termkit.ScreenBuffer.object2attr({bgColor: 88});
	const fillAttr3 = termkit.ScreenBuffer.object2attr({bgColor: 17});
	const fillAttr4 = termkit.ScreenBuffer.object2attr({bgColor: 18});
	const fillAttr5 = termkit.ScreenBuffer.object2attr({bgColor: 232});
	const fillAttr6 = termkit.ScreenBuffer.object2attr({bgColor: 235});

	const fillAttrStrike1 = termkit.ScreenBuffer.object2attr({bgColor: 52, strike: true});
	const fillAttrStrike2 = termkit.ScreenBuffer.object2attr({bgColor: 88, strike: true});
	const fillAttrStrike5 = termkit.ScreenBuffer.object2attr({bgColor: 232, strike: true});
	const fillAttrStrike6 = termkit.ScreenBuffer.object2attr({bgColor: 235, strike: true});

	class TeamBlock {
		constructor(id, lookup, dest, dqReaction, errReaction) {
			this.teamID = id;
			this.lookupTable = lookup;
			this.height = this.lookupTable.get(this.teamID).entries.length;
			this.buffer = termkit.ScreenBuffer.create({
				dst: dest,
				height: this.height,
				width: 0,
				x: 0,
				y: 0,
			});
			this.attrPhase = 0;
			this.disqualifyReaction = dqReaction;
			this.errorReaction = errReaction;
		}

		isDisqualified() {
			let entry = this.lookupTable.get(this.teamID);
			if (entry.disqualified && this.disqualifyReaction !== 'ignore') {
				return true;
			} else if (entry.error && this.errorReaction !== 'ignore') {
				return true;
			} else {
				return false;
			}
		}

		getOnPhaseBegin() {
			if (this.isDisqualified()) {
				return (this.attrPhase===0)?fillAttr5:fillAttr6;
			} else {
				return (this.attrPhase===0)?fillAttr1:fillAttr2;
			}
		}

		getOffPhaseBegin() {
			if (this.isDisqualified()) {
				return (this.attrPhase===1)?fillAttr5:fillAttr6;
			} else {
				return (this.attrPhase===1)?fillAttr1:fillAttr2;
			}
		}

		getOnPhaseMiddle() {
			if (this.isDisqualified()) {
				return (this.attrPhase===0)?fillAttr5:fillAttr6;
			} else {
				return (this.attrPhase===0)?fillAttr3:fillAttr4;
			}
		}

		getOffPhaseMiddle() {
			if (this.isDisqualified()) {
				return (this.attrPhase===1)?fillAttr5:fillAttr6;
			} else {
				return (this.attrPhase===1)?fillAttr3:fillAttr4;
			}
		}

		layGrid(currentGames, pastGames, nameLength) {
			/* jshint maxstatements: 60 */
			/* jshint maxcomplexity: 20 */
			const onPhaseBegin = this.getOnPhaseBegin();
			const offPhaseBegin = this.getOffPhaseBegin();
			const onPhaseMiddle = this.getOnPhaseMiddle();
			const offPhaseMiddle = this.getOffPhaseMiddle();
			const onPhaseEnd = (this.attrPhase===0)?fillAttr5:fillAttr6;
			const offPhaseEnd = (this.attrPhase===1)?fillAttr5:fillAttr6;
			let xIndex = 0;
			for (let i = 0; i < nameLength; i++) {
				this.buffer.put({
					x: xIndex,
					y: 0,
					direction: 'down',
					attr: onPhaseBegin,
				}, '%s', (' ').repeat(this.height));
				xIndex++;
				if (xIndex > this.buffer.width) {
					return;
				}
			}
			for (let i = 0; i < 6; i++) {
				this.buffer.put({
					x: xIndex,
					y: 0,
					direction: 'down',
					attr: offPhaseBegin,
				}, '%s', (' ').repeat(this.height));
				xIndex++;
				if (xIndex > this.buffer.width) {
					return;
				}
			}
			for (let i = 0; i < 6; i++) {
				this.buffer.put({
					x: xIndex,
					y: 0,
					direction: 'down',
					attr: onPhaseBegin,
				}, '%s', (' ').repeat(this.height));
				xIndex++;
				if (xIndex > this.buffer.width) {
					return;
				}
			}
			let n = 0;
			for (let k = 0; k < currentGames.length; k++) {
				for (let i = 0; i < 6; i++) {
					this.buffer.put({
						x: xIndex,
						y: 0,
						direction: 'down',
						attr: (n%2===1)?onPhaseMiddle:offPhaseMiddle,
					}, '%s', (' ').repeat(this.height));
					xIndex++;
					if (xIndex > this.buffer.width) {
						return;
					}
				}
				n++;
			}
			for (let k = 0; k < pastGames.length; k++) {
				for (let i = 0; i < 4; i++) {
					this.buffer.put({
						x: xIndex,
						y: 0,
						direction: 'down',
						attr: (n%2===1)?onPhaseEnd:offPhaseEnd,
					}, '%s', (' ').repeat(this.height));
					xIndex++;
					if (xIndex > this.buffer.width) {
						return;
					}
				}
				n++;
			}
		}

		layScores(currentGames, pastGames, nameLength) {
			/* jshint maxstatements: 60 */
			/* jshint maxcomplexity: 20 */
			const onPhaseBegin = this.getOnPhaseBegin();
			const offPhaseBegin = this.getOffPhaseBegin();
			const onPhaseMiddle = this.getOnPhaseMiddle();
			const offPhaseMiddle = this.getOffPhaseMiddle();
			let onPhaseBeginStrike;
			if (this.isDisqualified()) {
				onPhaseBeginStrike = (this.attrPhase===0)?fillAttrStrike5:fillAttrStrike6;
			} else {
				onPhaseBeginStrike = (this.attrPhase===0)?fillAttrStrike1:fillAttrStrike2;
			}
			const onPhaseEnd = (this.attrPhase===0)?fillAttr5:fillAttr6;
			const offPhaseEnd = (this.attrPhase===1)?fillAttr5:fillAttr6;

			let i = 0;
			for (let entry of this.lookupTable.get(this.teamID).entries) {
				this.buffer.put({
					attr: (entry.error || entry.disqualified)?
						onPhaseBeginStrike:
						onPhaseBegin,
					x: 0,
					y: i,
				}, '%s', entry.title);
				i++;
			}
			let centerIndex = Math.floor(this.height/2);
			let avgStr = this.lookupTable.get(this.teamID).score.toFixed(2);
			this.buffer.put({
				attr: offPhaseBegin,
				x: nameLength+6-termkit.stringWidth(avgStr),
				y: centerIndex,
			}, '%s', avgStr);
			let certainStr = (this.lookupTable.get(this.teamID).certainty*100).toFixed(1);
			this.buffer.put({
				attr: onPhaseBegin,
				x: nameLength+12-termkit.stringWidth(certainStr),
				y: centerIndex,
			}, '%s', certainStr);
			let xIndex = nameLength + 12;
			let n = 0;
			for (let runningGame of currentGames) {
				if (xIndex >= this.buffer.width) {
					break;
				}
				if (runningGame.teamScores.has(this.teamID)) {
					const teamScoreString = runningGame.teamScores.get(this.teamID).toFixed(0);
					this.buffer.put({
						attr: (n%2===1)?onPhaseMiddle:offPhaseMiddle,
						x: xIndex + 6 - termkit.stringWidth(teamScoreString),
						y: centerIndex,
					}, '%s', teamScoreString);
				}
				xIndex += 6;
				n++;
			}
			for (let runningGame of pastGames) {
				if (xIndex >= this.buffer.width) {
					break;
				}
				if (runningGame.teamScores.has(this.teamID)) {
					const teamScoreString = runningGame.teamScores.get(this.teamID).toFixed(0);
					this.buffer.put({
						attr: (n%2===1)?onPhaseEnd:offPhaseEnd,
						x: xIndex + 4 - termkit.stringWidth(teamScoreString),
						y: centerIndex,
					}, '%s', teamScoreString);
				}
				xIndex += 4;
				n++;
			}
		}

		transcribe({
			yIndex,
			currentGames,
			pastGames,
			maxLength,
			attrPhase,
			nameLength
		}) {
			//Put together results
			const height = this.lookupTable.get(this.teamID).entries.length;
			if (isFinite(height) && height >= 0) {
				this.height = height;
				this.attrPhase = attrPhase;
				this.buffer.resize({x: 0, y: 0, width: maxLength, height: height});
				this.buffer.fill({attr:bgAttr, char:' '});
				this.layGrid(currentGames, pastGames, nameLength);
				this.layScores(currentGames, pastGames, nameLength);
				this.buffer.draw({x: 0, y: yIndex});
			} else {
				//If something supremely wrong, throw
				throw new Error(height);
			}
		}
	}

	return {
		spinIndicator,
		progressBar,
		bgAttr,
		tournamentHeaderAttr: termkit.ScreenBuffer.object2attr({bgColor: 16}),
		matchHeaderAttr: termkit.ScreenBuffer.object2attr({bgColor: 54}),
		subheaderAttr1: termkit.ScreenBuffer.object2attr({bgColor: 22}),
		subheaderAttr2: termkit.ScreenBuffer.object2attr({bgColor: 28}),
		subheaderAttr3: termkit.ScreenBuffer.object2attr({bgColor: 22}),
		subheaderAttr4: termkit.ScreenBuffer.object2attr({bgColor: 28}),
		subheaderAttr5: termkit.ScreenBuffer.object2attr({bgColor: 238}),
		subheaderAttr6: termkit.ScreenBuffer.object2attr({bgColor: 242}),

		getProgressString: function(part, phase, whole=8) {
			let numDotsTotal = part*whole;
			if (numDotsTotal > 0 && numDotsTotal < whole && phase < 4) {
				numDotsTotal++;
			}
			let numFullSections = Math.floor(numDotsTotal/8);
			let numDots = Math.floor(numDotsTotal % 8);

			return progressBar[8].repeat(numFullSections) + progressBar[numDots];
		},
		TeamBlock,
	};
});
