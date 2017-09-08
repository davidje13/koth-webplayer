define([
	'display/documentUtils'
], (
	docutil
) => {
	'use strict';

	const QUEEN = 5;
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
		/* jshint -W016 */ // allow bitwise operation
		return cell & FOOD_BIT;
	}

	function colourOf(cell) {
		/* jshint -W016 */ // allow bitwise operation
		return cell & ~FOOD_BIT;
	}

	function mod(a, b) {
		return (((a % b) + b) % b);
	}

	return class ZoomedBoard {
		constructor({
			width = 1,
			height = null,
			scaleX = 1,
			scaleY = null,
			x = null,
			y = null,
		}) {
			this.colourChoices = {};
			this.colourscheme = '';
			this.x = null;
			this.y = null;
			this.width = 0;
			this.height = 0;
			this.scaleX = 0;
			this.scaleY = 0;

			window.devicePixelRatio = 1;
			this.canvas = docutil.make('canvas');
			this.canvas.width = 0;
			this.canvas.height = 0;
			this.board = docutil.make('div', {'class': 'zoomed-board'}, [this.canvas]);
			this.context = this.canvas.getContext('2d');
			this.dat = null;
			this.boardWidth = 0;
			this.boardHeight = 0;
			this.rawBoard = null;
			this.rawAnts = null;
			this.renderedMarks = new Map();
			this.renderTime = 0;
			this.renderCount = 0;
			this.setScale(scaleX, scaleY);
			this.setFocus(x, y);
			this.setSize(width, height);
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

		setSize(width, height = null) {
			if(height === null) {
				height = width;
			}
			if(this.width !== width || this.height !== height) {
				this.dat = new ImageData(width, height);
				this.width = width;
				this.height = height;
				this.canvas.width = width;
				this.canvas.height = height;
				this.repaint();
			}
		}

		setScale(scaleX, scaleY = null) {
			if(scaleY === null) {
				scaleY = scaleX;
			}
			if(this.scaleX !== scaleX || this.scaleY !== scaleY) {
				this.scaleX = scaleX;
				this.scaleY = scaleY;
				this.rerender();
			}
		}

		setFocus(x = null, y = null) {
			if(x === null || y === null) {
				x = null;
				y = null;
			}
			if(this.x !== x || this.y !== y) {
				this.x = x;
				this.y = y;
				this.repaint();
				return true;
			}
			return false;
		}

		hasFocus() {
			return this.x !== null;
		}

		clear() {
			this.rawBoard = null;
			this.rawAnts = null;
			this.repaint();
		}

		updateGameConfig({width, height}) {
			this.boardWidth = width;
			this.boardHeight = height;
		}

		updateDisplayConfig({colourscheme}) {
			if(colourscheme !== this.colourscheme) {
				this.colourscheme = colourscheme;
				this.repaint();
			}
		}

		updateState({board, ants}) {
			this.rawBoard = board;
			this.rawAnts = ants;

			if(!this.dat) {
				return;
			}

			const begin = performance.now();
			this.repaint();
			this.renderTime += performance.now() - begin;
			++ this.renderCount;
		}

		repaint() {
			if(!this.dat) {
				return;
			}

			if(this.x === null || !this.rawBoard) {
				this.dat.data.fill(0);
			} else {
				const palette = this.getPalette();
				const d = this.dat.data;
				const ww = this.boardWidth;
				const hh = this.boardHeight;
				const x0 = mod(Math.round(this.x - this.width / 2), ww);
				const y0 = mod(Math.round(this.y - this.height / 2), hh);
				for(let y = 0; y < this.height; ++ y) {
					for(let x = 0; x < this.width; ++ x) {
						const p = ((y + y0) % hh) * ww + (x + x0) % ww;
						const cell = this.rawBoard[p];
						const c = palette[colourOf(cell)];
						const l = (y * this.width + x) * 4;
						d[l    ] = c[0];
						d[l + 1] = c[1];
						d[l + 2] = c[2];
						d[l + 3] = c[3];
					}
				}
			}
			this.context.putImageData(this.dat, 0, 0);
			this.rerender();
		}

		populateMarkers(markers) {
			const ww = this.boardWidth;
			const hh = this.boardHeight;
			const x0 = mod(Math.round(this.x - this.width / 2), ww);
			const y0 = mod(Math.round(this.y - this.height / 2), hh);

			for(let y = 0; y < this.height; ++ y) {
				for(let x = 0; x < this.width; ++ x) {
					const p = ((y + y0) % hh) * ww + (x + x0) % ww;
					const cell = this.rawBoard[p];
					if(hasFood(cell)) {
						markers.set(x + '-' + y, {x, y, className: 'food-cell'});
					}
				}
			}

			this.rawAnts.forEach((ant) => {
				const x = mod(ant.x - x0, this.boardWidth);
				const y = mod(ant.y - y0, this.boardHeight);
				if(x < this.width && y < this.height) {
					let className = '';
					if(ant.type === QUEEN) {
						className = 'queen-cell';
					} else if(ant.food) {
						className = 'laden-worker-cell';
					} else {
						className = 'worker-cell';
					}
					markers.set(x + '-' + y, {x, y, className});
				}
			});
		}

		rerender() {
			docutil.updateStyle(this.canvas, {
				'width': Math.round(this.width * this.scaleX) + 'px',
				'height': Math.round(this.height * this.scaleY) + 'px',
			});
			docutil.updateStyle(this.board, {
				'width': Math.round(this.width * this.scaleX) + 'px',
				'height': Math.round(this.height * this.scaleY) + 'px',
			});

			const markers = new Map();

			if(this.x !== null && this.rawBoard && this.rawAnts) {
				this.populateMarkers(markers);
			}

			markers.forEach((mark, key) => {
				let dom = this.renderedMarks.get(key);
				if(!dom) {
					dom = {
						element: docutil.make('div'),
					};
					this.renderedMarks.set(key, dom);
				}
				docutil.updateAttrs(dom.element, {
					'class': 'mark ' + (mark.className || ''),
				});
				docutil.updateStyle(dom.element, {
					'left': (mark.x * this.scaleX) + 'px',
					'top': (mark.y * this.scaleY) + 'px',
					'width': this.scaleX + 'px',
					'height': this.scaleY + 'px',
					'fontSize': this.scaleY + 'px',
				});
				docutil.setParent(dom.element, this.board);
			});

			this.renderedMarks.forEach((dom, key) => {
				if(!markers.has(key)) {
					docutil.setParent(dom.element, null);
					this.renderedMarks.delete(key);
				}
			});
		}

		dom() {
			return this.board;
		}
	};
});
