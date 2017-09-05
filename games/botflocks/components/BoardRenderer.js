define(() => {
	'use strict';

	const DEFAULT_COLOURS = [
		[255, 255, 255, 255],
		[  0,   0,   0, 255],

		[255, 255,   0, 255], // Unknown entry
		[  0,   0, 255, 255], // Player 1
		[255,   0,   0, 255], // Player 2
	];

	function renderBlock(d, x, y, c, {scale, width}) {
		const p0 = (y * width * scale + x) * scale;
		for(let yy = 0; yy < scale; ++ yy) {
			for(let xx = 0; xx < scale; ++ xx) {
				const p = p0 + yy * width * scale + xx;
				d[p * 4    ] = c[0];
				d[p * 4 + 1] = c[1];
				d[p * 4 + 2] = c[2];
				d[p * 4 + 3] = c[3];
			}
		}
	}

	function renderPoint(d, x, y, c, {scale, width}) {
		const p = (
			Math.floor((y + 0.5) * scale) * width * scale +
			Math.floor((x + 0.5) * scale)
		);
		d[p * 4    ] = c[0];
		d[p * 4 + 1] = c[1];
		d[p * 4 + 2] = c[2];
		d[p * 4 + 3] = c[3];
	}

	return class BoardRenderer {
		constructor() {
			this.colourChoices = {};
			this.colourscheme = '';

			this.rawBoard = null;
			this.rawTeams = null;
			this.dat = null;
			this.width = 0;
			this.height = 0;
			this.dirty = true;
			this.renderTime = 0;
			this.renderCount = 0;
			this.scale = 3;
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
			for(let y = 0; y < this.height; ++ y) {
				for(let x = 0; x < this.width; ++ x) {
					const c = palette[this.rawBoard[y * this.width + x]];
					renderBlock(d, x, y, c, this);
				}
			}
			this.rawTeams.forEach((team, teamIndex) => team.entries.forEach((entry) => {
				if(!entry.disqualified) {
					const c = palette[teamIndex + 3] || palette[2];
					entry.bots.forEach((bot) => {
						renderBlock(d, bot.x, bot.y, c, this);
						if(bot.hasWall) {
							renderPoint(d, bot.x, bot.y, palette[1], this);
						}
					});
				}
			}));
			this.dirty = false;
		}

		updateGameConfig({width, height}) {
			if(
				!this.dat ||
				width !== this.width ||
				height !== this.height
			) {
				this.width = width;
				this.height = height;
				this.dat = new ImageData(
					width * this.scale,
					height * this.scale
				);
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
