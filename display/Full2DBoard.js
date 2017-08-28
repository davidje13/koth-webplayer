define([
	'core/EventObject',
	'./document_utils',
	'./style.css',
], (
	EventObject,
	docutil,
) => {
	'use strict';

	const EMPTY_MAP = new Map();

	return class Full2DBoard extends EventObject {
		constructor({renderer, markerStore = null, scaleX = 1, scaleY = null}) {
			super();

			this.renderer = renderer;
			this.markerStore = markerStore;
			this.scaleX = 0;
			this.scaleY = 0;

			this.renderedMarks = new Map();

			window.devicePixelRatio = 1;
			this.canvas = docutil.make('canvas');
			this.canvas.width = 0;
			this.canvas.height = 0;
			this.boardClip = docutil.make('div', {'class': 'game-board-clip'}, [this.canvas]);
			this.board = docutil.make('div', {'class': 'game-board'}, [this.boardClip]);

			this.context = this.canvas.getContext('2d');
			this.setScale(scaleX, scaleY);
		}

		_updateStyles() {
			docutil.updateStyle(this.canvas, {
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
			docutil.updateStyle(this.board, {
				'width': ((this.canvas.width * this.scaleX)|0) + 'px',
				'height': ((this.canvas.height * this.scaleY)|0) + 'px',
			});
			docutil.updateStyle(this.boardClip, {
				'width': ((this.canvas.width * this.scaleX)|0) + 'px',
				'height': ((this.canvas.height * this.scaleY)|0) + 'px',
			});
		}

		rerender() {
			const markers = this.markerStore ? this.markerStore.marks : EMPTY_MAP;

			markers.forEach((mark, key) => {
				let dom = this.renderedMarks.get(key);
				if(!dom) {
					dom = {element: docutil.make('div')};
					this.renderedMarks.set(key, dom);
				}
				const x1 = (((mark.x + 0.5) * this.scaleX)|0);
				const y1 = (((mark.y + 0.5) * this.scaleY)|0);
				docutil.updateAttrs(dom.element, {
					'class': 'mark ' + (mark.className || ''),
				});
				docutil.updateStyle(dom.element, {
					'left': x1 + 'px',
					'top': y1 + 'px',
				});
				if(mark.w !== null && mark.h !== null) {
					// TODO: wrapping
					const x2 = (((mark.x + mark.w) * this.scaleX)|0);
					const y2 = (((mark.y + mark.h) * this.scaleY)|0);
					docutil.updateStyle(dom.element, {
						'width': (x2 - x1) + 'px',
						'height': (y2 - y1) + 'px',
					});
				}
				docutil.setParent(dom.element, mark.clip ? this.boardClip : this.board);
			});

			this.renderedMarks.forEach((dom, key) => {
				if(!markers.has(key)) {
					docutil.setParent(dom.element, null);
					this.renderedMarks.delete(key);
				}
			});
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

			this.rerender();
		}

		setMarkerStore(markerStore) {
			this.markerStore = markerStore;
		}

		setScale(x, y = null) {
			if(y === null) {
				y = x;
			}
			if(this.scaleX !== x || this.scaleY !== y) {
				this.scaleX = x;
				this.scaleY = y;
				this._updateStyles();
			}
		}

		dom() {
			return this.board;
		}
	}
});
