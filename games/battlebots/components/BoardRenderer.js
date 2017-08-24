define(() => {
	'use strict';

	const DEFAULT_COLOURS = [
		[255, 255, 255, 255],
		[255,   0,   0, 255],
		[  0,   0, 255, 255],
	];

	return class BoardRenderer {
		constructor() {
			this.colourChoices = {};
			this.colourscheme = '';

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
			if(!this.rawTeams || !this.dat) {
				return;
			}

			const palette = this.getPalette();

			const d = this.dat.data;
			let c = palette[0];
			for(let p = 0; p < this.dat.width * this.dat.height; ++ p) {
				d[p * 4    ] = c[0];
				d[p * 4 + 1] = c[1];
				d[p * 4 + 2] = c[2];
				d[p * 4 + 3] = c[3];
			}
			this.rawTeams.forEach((team) => team.entries.forEach((entry) => {
				if(entry.alive && !entry.disqualified) {
					c = palette[entry.teamIndex + 1];
					const p = entry.y * this.dat.width + entry.x;
					d[p * 4    ] = c[0];
					d[p * 4 + 1] = c[1];
					d[p * 4 + 2] = c[2];
					d[p * 4 + 3] = c[3];
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

		updateState({board, teams, frame}) {
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
	}
});
