define(() => {
	'use strict';

	const DEFAULT_COLOURS = [
		[255, 255, 255, 255],
		[  0,   0,   0, 255],

		[255, 255,   0, 255], // Unknown entry
		[  0,   0, 255, 255], // Player 1
		[255,   0,   0, 255], // Player 2
	];

	return class BoardRenderer {
		constructor() {
			this.colourChoices = {};
			this.colourscheme = '';

			this.rawBoard = null;
			this.rawTeams = null;
			this.dat = null;
			this.dirty = true;
			this.renderTime = 0;
			this.renderCount = 0;
		}

		setColourChoices(colourChoices) {
			this.colourChoices = colourChoices;
			this.repaint();
		}

		getPalette() {
			const scheme = this.colourChoices[this.colourscheme];
			if(scheme) {
				return scheme.palette;
			}
			return DEFAULT_COLOURS;
		}

		clear() {
			if(this.dat) {
				this.dat.data.fill(0);
			}
			this.dirty = true;
		}

		repaint() {
			if(!this.rawBoard || !this.rawTeams || !this.dat) {
				return;
			}

			const palette = this.getPalette();

			const d = this.dat.data;
			for(let p = 0; p < this.dat.width * this.dat.height; ++ p) {
				const c = palette[this.rawBoard[p]];
				d[p * 4    ] = c[0];
				d[p * 4 + 1] = c[1];
				d[p * 4 + 2] = c[2];
				d[p * 4 + 3] = c[3];
			}
			this.rawTeams.forEach((team, teamIndex) => team.entries.forEach((entry) => {
				if(!entry.disqualified) {
					const c = palette[teamIndex + 3] || palette[2];
					entry.bots.forEach((bot) => {
						// TODO: visual indicator when carying wall
//						if(bot.hasWall) {
//						}
						const p = bot.y * this.dat.width + bot.x;
						d[p * 4    ] = c[0];
						d[p * 4 + 1] = c[1];
						d[p * 4 + 2] = c[2];
						d[p * 4 + 3] = c[3];
					});
				}
			}));
			this.dirty = false;
		}

		updateGameConfig({width, height}) {
			if(!this.dat || width !== this.dat.width || height !== this.dat.height) {
				this.dat = new ImageData(width, height);
				this.dirty = true;
			}
		}

		updateDisplayConfig({colourscheme}) {
			if(colourscheme !== this.colourscheme) {
				this.colourscheme = colourscheme;
				this.repaint();
			}
		}

		updateState({board, teams}) {
			this.rawBoard = board;
			this.rawTeams = teams;

			if(!this.dat) {
				return;
			}

			const begin = performance.now();
			this.repaint();
			this.renderTime += performance.now() - begin;
			++ this.renderCount;
		}

		getImageData() {
			return this.dat;
		}
	};
});
