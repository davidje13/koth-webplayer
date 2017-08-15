define(['core/document_utils', 'core/EventObject'], (docutil, EventObject) => {
	'use strict';

	return class Full2DBoard extends EventObject {
		constructor(renderer, scale = 1) {
			super();

			this.renderer = renderer;
			this.scaleX = 0;
			this.scaleY = 0;

			this.marks = new Map();

			window.devicePixelRatio = 1;
			this.canvas = docutil.make('canvas');
			this.canvas.width = 0;
			this.canvas.height = 0;
			this.boardClip = docutil.make('div', {'class': 'game-board-clip'}, [this.canvas]);
			this.board = docutil.make('div', {'class': 'game-board'}, [this.boardClip]);

			this.context = this.canvas.getContext('2d');
			this.setScale(scale);
		}

		_repaintMark(mark) {
			if(!mark.element) {
				mark.element = docutil.make('div');
			}
			const x1 = ((mark.x * this.scaleX)|0);
			const y1 = ((mark.y * this.scaleY)|0);
			docutil.update_attrs(mark.element, {
				'class': 'mark ' + (mark.className || ''),
			});
			docutil.update_style(mark.element, {
				'left': x1 + 'px',
				'top': y1 + 'px',
			});
			if(mark.w !== undefined && mark.h !== undefined) {
				// TODO: wrapping
				const x2 = (((mark.x + mark.w) * this.scaleX)|0);
				const y2 = (((mark.y + mark.h) * this.scaleY)|0);
				docutil.update_style(mark.element, {
					'width': (x2 - x1) + 'px',
					'height': (y2 - y1) + 'px',
				});
			}
			docutil.set_parent(mark.element, mark.clip ? this.boardClip : this.board);
		}

		_updateStyles() {
			docutil.update_style(this.canvas, {
				'width': (this.canvas.width * this.scaleX) + 'px',
				'height': (this.canvas.height * this.scaleY) + 'px',
//				'width': (this.canvas.width / 2) + 'px',
//				'height': (this.canvas.height / 2) + 'px',
//				'transform': (
//					'scale(' + (this.scaleX * 2) + ',' + (this.scaleY * 2) + ') ' +
//					'rotateX(0.0000001deg)'
//				),
//				'marginRight': -((this.canvas.width * (1 - this.scaleX * 2) / 2)|0) + 'px',
//				'marginBottom': -((this.canvas.height * (1 - this.scaleY * 2) / 2)|0) + 'px',
			});
			docutil.update_style(this.boardClip, {
				'width': ((this.canvas.width * this.scaleX)|0) + 'px',
				'height': ((this.canvas.height * this.scaleY)|0) + 'px',
			});
			this.marks.forEach((mark) => this._repaintMark(mark));
		}

		repaint() {
			const data = this.renderer.getImageData();
			if(data) {
				if(
					data.width !== this.canvas.width ||
					data.height !== this.canvas.height
				) {
					this.canvas.width = data.width;
					this.canvas.height = data.height;
					this._updateStyles();
				}
				this.context.putImageData(data, 0, 0);
			}
		}

		setScale(x, y = null) {
			if(y === null) {
				y = x;
			}
			this.scaleX = x;
			this.scaleY = y;
			this._updateStyles();
		}

		mark(key, {x, y, w, h, className, wrap = true, clip = true}) {
			if(x === undefined || y === undefined) {
				this.removeMark(key);
				return;
			}
			let o = this.marks.get(key);
			if(!o) {
				this.marks.set(key, o = {
					x: null,
					y: null,
					w: null,
					h: null,
					className: null,
					clipped: null,
				});
			}
			o.x = x;
			o.y = y;
			o.w = w;
			o.h = h;
			o.className = className;
			o.wrap = wrap;
			o.clip = clip;
			this._repaintMark(o);
		}

		removeMark(key) {
			const mark = this.marks.get(key);
			if(mark) {
				docutil.set_parent(mark.element, null)
				this.marks.delete(key);
			}
		}

		removeAllMarks() {
			this.marks.forEach((mark, key) => this.removeMark(key));
		}

		dom() {
			return this.board;
		}
	}
});
