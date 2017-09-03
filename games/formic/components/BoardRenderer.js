define(() => {
	'use strict';

	const FOOD_BIT = 0x08;

	const DEFAULT_COLOURS = [
		[255, 255, 255, 255],
		[255, 255,   0, 255],
		[255,   0, 255, 255],
		[  0, 255, 255, 255],
		[255,   0,   0, 255],
		[  0, 255,   0, 255],
		[  0,   0, 255, 255],
		[  0,   0,   0, 255],

		[  0,   0,   0, 255], // food
		[  0,   0,   0, 255], // ant
	];

	function hasFood(cell) {
		/* jshint -W016 */
		return cell & FOOD_BIT;
	}

	function paintArea(d, board, colours, {x0, y0, x1, y1, step}) {
		for(let y = y0; y < y1; ++ y) {
			for(let x = x0; x < x1; ++ x) {
				const p = y * step + x;
				const cell = board[p];
				const c = colours[hasFood(cell) ? 8 : cell];
				d[p * 4    ] = c[0];
				d[p * 4 + 1] = c[1];
				d[p * 4 + 2] = c[2];
				d[p * 4 + 3] = c[3];
			}
		}
	}

	function fadeOut(dat, factor = 0.9) {
		const w = dat.width;
		const h = dat.height;
		const d = dat.data;
		for(let y = 0; y < h; ++ y) {
			for(let x = 0; x < w; ++ x) {
				d[(y * w + x) * 4 + 3] *= factor;
			}
		}
	}

	function calculateZones(zones, ants, {w, h, zoneSize, framesDelta}) {
		zones.fill(0);
		const zw = Math.ceil(w / zoneSize);
		const zh = Math.ceil(h / zoneSize);
		for(let i = 0; i < ants.length; ++ i) {
			const ant = ants[i];
			const x0 = Math.floor((ant.x + w - framesDelta) / zoneSize);
			const y0 = Math.floor((ant.y + h - framesDelta) / zoneSize);
			const x1 = Math.floor((ant.x + w + framesDelta) / zoneSize);
			const y1 = Math.floor((ant.y + h + framesDelta) / zoneSize);
			for(let y = y0; y <= y1; ++ y) {
				for(let x = x0; x <= x1; ++ x) {
					zones[(y % zh) * zw + (x % zw)] = 1;
				}
			}
		}
	}

	function paintPartial(dat, board, zones, zoneSize, colours) {
		const w = dat.width;
		const h = dat.height;
		const d = dat.data;
		const zw = Math.ceil(w / zoneSize);
		const zh = Math.ceil(h / zoneSize);
		for(let y = 0; y < zh; ++ y) {
			for(let x = 0; x < zw; ++ x) {
				if(zones[y * zw + x]) {
					const xx = x * zoneSize;
					const yy = y * zoneSize;
					paintArea(d, board, colours, {
						x0: xx,
						y0: yy,
						x1: Math.min(xx + zoneSize, w),
						y1: Math.min(yy + zoneSize, h),
						step: w,
					});
				}
			}
		}
	}

	function positionAnts(dat, ants, colour) {
		const w = dat.width;
		const d = dat.data;
		for(let i = 0; i < ants.length; ++ i) {
			const p = ants[i].y * w + ants[i].x;
			d[p * 4    ] = colour[0];
			d[p * 4 + 1] = colour[1];
			d[p * 4 + 2] = colour[2];
			d[p * 4 + 3] = colour[3];
		}
	}

	return class BoardRenderer {
		constructor() {
			this.colourChoices = {};
			this.colourscheme = '';
			this.zoneSize = 10;
			this.highlightRedrawRegions = false;

			this.rawBoard = null;
			this.rawAnts = null;
			this.dat = null;
			this.zones = null;
			this.lastRenderedFrame = 0;
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
			this.lastRenderedFrame = 0;
			this.dirty = true;
		}

		repaint() {
			if(!this.rawBoard || !this.dat) {
				return;
			}

			const palette = this.getPalette();

			paintArea(this.dat.data, this.rawBoard, palette, {
				x0: 0,
				y0: 0,
				x1: this.dat.width,
				y1: this.dat.height,
				step: this.dat.width,
			});
			positionAnts(this.dat, this.rawAnts, palette[9]);
			this.dirty = false;
		}

		updateGameConfig({width, height}) {
			if(!this.dat || width !== this.dat.width || height !== this.dat.height) {
				this.dat = new ImageData(width, height);
				this.zones = new Uint8Array(
					Math.ceil(width / this.zoneSize) *
					Math.ceil(height / this.zoneSize)
				);
				this.dirty = true;
			}
		}

		updateDisplayConfig({colourscheme, highlightRedrawRegions}) {
			if(colourscheme !== this.colourscheme) {
				this.colourscheme = colourscheme;
				this.repaint();
			}
			this.highlightRedrawRegions = highlightRedrawRegions;
		}

		updateState({board, ants, frame, currentAnt}) {
			this.rawBoard = board;
			this.rawAnts = ants;

			if(!this.dat) {
				return;
			}

			const framesDelta = (
				frame - this.lastRenderedFrame +
				((currentAnt === 0) ? 0 : 1)
			);
			this.lastRenderedFrame = frame;

			const partialRender = (
				!this.dirty &&
				framesDelta < (Math.min(this.dat.width, this.dat.height) / 4)
			);

			const begin = performance.now();

			const palette = this.getPalette();

			if(partialRender) {
				if(this.highlightRedrawRegions) {
					fadeOut(this.dat);
				}

				calculateZones(this.zones, this.rawAnts, {
					w: this.dat.width,
					h: this.dat.height,
					zoneSize: this.zoneSize,
					framesDelta,
				});

				paintPartial(
					this.dat,
					this.rawBoard,
					this.zones,
					this.zoneSize,
					palette
				);
			} else {
				paintArea(this.dat.data, this.rawBoard, palette, {
					x0: 0,
					y0: 0,
					x1: this.dat.width,
					y1: this.dat.height,
					step: this.dat.width,
				});
			}
			positionAnts(this.dat, this.rawAnts, palette[9]);
			this.dirty = false;

			this.renderTime += performance.now() - begin;
			++ this.renderCount;
		}

		getImageData() {
			return this.dat;
		}
	};
});
