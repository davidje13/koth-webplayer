define([
	'display/documentUtils',
], (
	docutil
) => {
	'use strict';

	const DEFAULT_COLOURS = [
		{
			background:   [  0,   0,   0, 255],
			sunOutline:   [255, 255, 255, 255],
			sunFill:      [255, 255, 255, 255],
		},
		{ // Unknown player
			outline:      [128, 128, 128, 255],
			fill:         [  0,   0,   0, 128],
			flameOutline: [255, 255, 255, 255],
			flameFill:    [255, 255, 255, 128],
			deadFill:     [128, 128, 128, 255],
			missile:      [255, 255, 255, 255],
		},
		{ // Player 1
			outline:      [255,   0,   0, 255],
			fill:         [255,   0,   0, 128],
			flameOutline: [255, 255, 255, 255],
			flameFill:    [255, 255, 255, 128],
			deadFill:     [255, 128, 128, 255],
			missile:      [255, 255, 255, 255],
		},
		{ // Player 2
			outline:      [  0,   0, 255, 255],
			fill:         [  0,   0, 255, 128],
			flameOutline: [255, 255, 255, 255],
			flameFill:    [255, 255, 255, 128],
			deadFill:     [128, 128, 255, 255],
			missile:      [255, 255, 255, 255],
		},
	];

	function toRGBA(col) {
		return ('rgba(' +
			col[0] + ',' +
			col[1] + ',' +
			col[2] + ',' +
			(col[3] / 255) + ')'
		);
	}

	function drawPath(ctx, scale, path, {x, y, rotation}) {
		const s = Math.sin(rotation);
		const c = Math.cos(rotation);
		for(let i = 0; i < path.length; ++ i) {
			const p = path[i];
			const xx = (x + p[0] * c - p[1] * s) * scale;
			const yy = (y + p[0] * s + p[1] * c) * scale;
			if(i === 0) {
				ctx.moveTo(xx, yy);
			} else {
				ctx.lineTo(xx, yy);
			}
		}
		ctx.closePath();
	}

	function paintPath(ctx, scale, {fill, stroke}) {
		if(fill) {
			ctx.fillStyle = toRGBA(fill);
			ctx.fill();
		}
		if(stroke) {
			const strokeCol = toRGBA(stroke);
			ctx.strokeStyle = strokeCol;
			ctx.lineWidth = 1 * scale;
			ctx.shadowBlur = 3 * scale;
			ctx.shadowColor = strokeCol;
			ctx.stroke();
			ctx.shadowBlur = 0;
			ctx.shadowColor = 'transparent';
		}
	}

	return class BoardRenderer {
		constructor() {
			this.colourChoices = {};
			this.colourscheme = '';

			this.rawTeams = null;
			this.frame = 0;
			this.shapes = null;
			this.sun = null;
			this.canvas = docutil.make('canvas');
			this.canvas.width = 0;
			this.canvas.height = 0;
			this.context = this.canvas.getContext('2d');
			this.dat = null;
			this.renderTime = 0;
			this.renderCount = 0;
			this.scale = window.originalDevicePixelRatio;
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
			this.rawTeams = null;
			this.shapes = null;
			this.sun = null;
			this.frame = 0;
			if(this.dat) {
				this.dat.data.fill(0);
			}
		}

		drawFlame(entry, cols, pos) {
			const ctx = this.context;
			const scale = this.scale;
			const shapes = this.shapes;
			const flame = shapes.flame;

			ctx.beginPath();
			if(entry.leftWing && entry.rightWing && flame) {
				drawPath(ctx, scale, flame[this.frame % flame.length], pos);
			} else {
				if(entry.leftWing) {
					const flameL = shapes.leftFlame;
					drawPath(ctx, scale, flameL[this.frame % flameL.length], pos);
				}
				if(entry.rightWing) {
					const flameR = shapes.rightFlame;
					drawPath(ctx, scale, flameR[this.frame % flameR.length], pos);
				}
			}
			paintPath(ctx, scale, {fill: cols.flameFill, stroke: cols.flameOutline});
		}

		drawShip(entry, cols, pos) {
			const ctx = this.context;
			const scale = this.scale;
			const shapes = this.shapes;

			ctx.beginPath();
			if(entry.leftWing && entry.rightWing) {
				if(shapes.all) {
					drawPath(ctx, scale, shapes.all, pos);
				} else {
					drawPath(ctx, scale, shapes.nose, pos);
					drawPath(ctx, scale, shapes.leftWing, pos);
					drawPath(ctx, scale, shapes.rightWing, pos);
				}
			} else if(entry.leftWing) {
				if(shapes.noseLeftWing) {
					drawPath(ctx, scale, shapes.noseLeftWing, pos);
				} else {
					drawPath(ctx, scale, shapes.nose, pos);
					drawPath(ctx, scale, shapes.leftWing, pos);
				}
			} else if(entry.rightWing) {
				if(shapes.noseRightWing) {
					drawPath(ctx, scale, shapes.noseRightWing, pos);
				} else {
					drawPath(ctx, scale, shapes.nose, pos);
					drawPath(ctx, scale, shapes.rightWing, pos);
				}
			} else {
				drawPath(ctx, scale, shapes.nose, pos);
			}
			paintPath(ctx, scale, {
				fill: entry.alive ? cols.fill : cols.deadFill,
				stroke: cols.outline,
			});
		}

		drawEntry(entry, cols, {dx = 0, dy = 0} = {}) {
			const w = this.canvas.width;
			const h = this.canvas.height;

			const pos = {
				x: entry.x + dx * w / this.scale,
				y: entry.y + dy * h / this.scale,
				rotation: entry.rotation,
			};

			if(entry.hyperspace) {
				return;
			}

			if(entry.engine) {
				this.drawFlame(entry, cols, pos);
			}
			this.drawShip(entry, cols, pos);
		}

		drawMissile(missile, cols, {dx = 0, dy = 0} = {}) {
			const w = this.canvas.width;
			const h = this.canvas.height;
			const ctx = this.context;

			ctx.beginPath();
			ctx.moveTo(
				missile.ox * this.scale + dx * w,
				missile.oy * this.scale + dy * h
			);
			ctx.lineTo(
				missile.x * this.scale + dx * w,
				missile.y * this.scale + dy * h
			);
			paintPath(ctx, this.scale, {stroke: cols.missile});
		}

		drawEntryWrapped(entry, cols) {
			for(let dx = -1; dx <= 1; ++ dx) {
				for(let dy = -1; dy <= 1; ++ dy) {
					this.drawEntry(entry, cols, {dx, dy});
				}
			}
		}

		drawMissileWrapped(missile, cols) {
			for(let dx = -1; dx <= 1; ++ dx) {
				for(let dy = -1; dy <= 1; ++ dy) {
					this.drawMissile(missile, cols, {dx, dy});
				}
			}
		}

		repaint() {
			if(!this.context || this.canvas.width === 0) {
				return;
			}

			const palette = this.getPalette();

			const w = this.canvas.width;
			const h = this.canvas.height;
			const ctx = this.context;
			ctx.globalCompositeOperation = 'copy';
			ctx.fillStyle = toRGBA(palette[0].background);
			ctx.fillRect(0, 0, w, h);

			ctx.globalCompositeOperation = 'source-over';

			if(this.rawTeams && this.shapes) {
				this.rawTeams.forEach((team, teamIndex) => team.entries.forEach((entry) => {
					const cols = palette[teamIndex + 2] || palette[1];
					entry.activeMissiles.forEach((missile) =>
						this.drawMissileWrapped(missile, cols));
				}));
				this.rawTeams.forEach((team, teamIndex) => team.entries.forEach((entry) => {
					const cols = palette[teamIndex + 2] || palette[1];
					this.drawEntryWrapped(entry, cols);
				}));
			}

			if(this.sun) {
				ctx.beginPath();
				ctx.arc(
					this.sun.x * this.scale,
					this.sun.y * this.scale,
					this.sun.radius * this.scale,
					0, Math.PI * 2
				);
				paintPath(ctx, this.scale, {
					fill: palette[0].sunFill,
					stroke: palette[0].sunOutline,
				});
			}

			this.dat = ctx.getImageData(0, 0, w, h);
		}

		updateGameConfig({width, height, sun}) {
			this.sun = {x: sun.x, y: sun.y, radius: sun.radius};
			if(!this.dat || width !== this.dat.width || height !== this.dat.height) {
				const w = width * this.scale;
				const h = height * this.scale;
				this.canvas.width = w;
				this.canvas.height = h;
				this.dat = this.context.getImageData(0, 0, w, h);
			}
		}

		updateDisplayConfig({colourscheme, shapes}) {
			this.shapes = shapes;
			if(colourscheme !== this.colourscheme) {
				this.colourscheme = colourscheme;
				this.repaint();
			}
		}

		updateState({teams, frame}) {
			this.rawTeams = teams;
			this.frame = frame;

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
