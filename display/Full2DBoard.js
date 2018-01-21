define([
	'core/EventObject',
	'./documentUtils',
	'./style.css',
], (
	EventObject,
	docutil
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
			this.dataScale = 1;
			this.hasBitmap = Boolean(renderer.getImageData);

			this.renderedMarks = new Map();

			if(this.hasBitmap) {
				this.canvas = docutil.make('canvas');
				this.canvas.width = 0;
				this.canvas.height = 0;
				this.context = this.canvas.getContext('2d');
			} else {
				this.canvas = {width: 0, height: 0};
			}
			this.boardClip = docutil.make('div', {'class': 'game-board-clip'}, [
				this.hasBitmap ? this.canvas : null,
			]);
			this.board = docutil.make('div', {'class': 'game-board'}, [this.boardClip]);

			this.boardClip.addEventListener('mousemove', (event) => {
				const bounds = this.boardClip.getBoundingClientRect();
				this.trigger('hover', [
					(event.clientX - bounds.left) / this.scaleX,
					(event.clientY - bounds.top) / this.scaleY,
				]);
			});

			this.boardClip.addEventListener('mouseleave', () => {
				this.trigger('hoveroff');
			});

			this.boardClip.addEventListener('click', () => {
				const bounds = this.boardClip.getBoundingClientRect();
				this.trigger('click', [
					(event.clientX - bounds.left) / this.scaleX,
					(event.clientY - bounds.top) / this.scaleY,
				]);
			});

			this.setScale(scaleX, scaleY);
		}

		_updateStyles() {
			const mx = this.scaleX / this.dataScale;
			const my = this.scaleY / this.dataScale;
			if(this.hasBitmap) {
				docutil.updateStyle(this.canvas, {
					'width': (this.canvas.width * mx) + 'px',
					'height': (this.canvas.height * my) + 'px',
				});
			}
			docutil.updateStyle(this.board, {
				'width': Math.round(this.canvas.width * mx) + 'px',
				'height': Math.round(this.canvas.height * my) + 'px',
			});
			docutil.updateStyle(this.boardClip, {
				'width': Math.round(this.canvas.width * mx) + 'px',
				'height': Math.round(this.canvas.height * my) + 'px',
			});
		}

		_positionMarkElements(mark, dom, {x, y, cx, cy}, styles) {
			docutil.updateStyle(dom.elements[0], Object.assign({
				'left': x + 'px',
				'top': y + 'px',
			}, styles));
			if(!mark.wrap) {
				dom.visible = 1;
				return;
			}
			const w = this.canvas.width * this.scaleX / this.dataScale;
			const h = this.canvas.height * this.scaleY / this.dataScale;
			const dx = (cx > w / 2) ? -w : w;
			const dy = (cy > h / 2) ? -h : h;
			docutil.updateStyle(dom.elements[1], Object.assign({
				'left': (x + dx) + 'px',
				'top': y + 'px',
			}, styles));
			docutil.updateStyle(dom.elements[2], Object.assign({
				'left': x + 'px',
				'top': (y + dy) + 'px',
			}, styles));
			docutil.updateStyle(dom.elements[3], Object.assign({
				'left': (x + dx) + 'px',
				'top': (y + dy) + 'px',
			}, styles));
			dom.visible = 4;
		}

		_updateLineMark(mark, dom) {
			const x1 = Math.floor((mark.x + 0.5) * this.scaleX);
			const y1 = Math.floor((mark.y + 0.5) * this.scaleY);
			const x2 = Math.floor((mark.toX + 0.5) * this.scaleX);
			const y2 = Math.floor((mark.toY + 0.5) * this.scaleY);
			const l = Math.sqrt(
				(x2 - x1) * (x2 - x1) +
				(y2 - y1) * (y2 - y1)
			);
			const x = (x1 + x2 - l) * 0.5;
			const y = (y1 + y2) * 0.5;
			this._positionMarkElements(mark, dom, {x, y, cx: x, cy: y}, {
				'transform': 'rotate(' + Math.atan2(
					y2 - y1,
					x2 - x1
				) + 'rad)',
				'width': l + 'px',
			});
		}

		_updateBoxMark(mark, dom) {
			const x1 = Math.floor(mark.x * this.scaleX);
			const y1 = Math.floor(mark.y * this.scaleY);
			const x2 = Math.floor((mark.x + mark.w) * this.scaleX);
			const y2 = Math.floor((mark.y + mark.h) * this.scaleY);
			this._positionMarkElements(mark, dom, {
				x: x1,
				y: y1,
				cx: (x1 + x2) / 2,
				cy: (y1 + y2) / 2,
			}, {
				'width': (x2 - x1) + 'px',
				'height': (y2 - y1) + 'px',
			});
		}

		_updatePointMark(mark, dom) {
			const x1 = Math.floor((mark.x + 0.5) * this.scaleX);
			const y1 = Math.floor((mark.y + 0.5) * this.scaleY);
			docutil.updateStyle(dom.elements[0], {
				'left': x1 + 'px',
				'top': y1 + 'px',
			});
			dom.visible = 1;
		}

		_updateMark(mark, dom) {
			if(mark.toX !== null && mark.toY !== null) {
				this._updateLineMark(mark, dom);
			} else if(mark.w !== null && mark.h !== null) {
				this._updateBoxMark(mark, dom);
			} else {
				this._updatePointMark(mark, dom);
			}
			if(typeof mark.content === 'string') {
				docutil.updateText(dom.text, mark.content);
				docutil.setParent(dom.textHold, dom.elements[0]);
			} else if(mark.content) {
				docutil.setParent(mark.content, dom.elements[0]);
			} else {
				dom.elements.forEach((element) => docutil.empty(element));
			}
			const className = 'mark ' + (mark.className || '');
			const container = mark.clip ? this.boardClip : this.board;
			for(let i = 0; i < dom.visible; ++ i) {
				docutil.updateAttrs(dom.elements[i], {'class': className});
				docutil.setParent(dom.elements[i], container);
			}
			for(let i = dom.visible; i < dom.elements.length; ++ i) {
				docutil.setParent(dom.elements[i], null);
			}
		}

		rerender() {
			const markers = this.markerStore ? this.markerStore.marks : EMPTY_MAP;

			markers.forEach((mark, key) => {
				let dom = this.renderedMarks.get(key);
				if(!dom) {
					const elements = [];
					for(let i = 0; i < 4; ++ i) {
						elements.push(docutil.make('div'));
					}
					dom = {
						elements,
						textHold: docutil.make('span'),
						text: docutil.text(),
						visible: 0,
					};
					dom.textHold.appendChild(dom.text);
					this.renderedMarks.set(key, dom);
				}
				this._updateMark(mark, dom);
			});

			this.renderedMarks.forEach((dom, key) => {
				if(!markers.has(key)) {
					dom.elements.forEach((element) => docutil.setParent(element, null));
					this.renderedMarks.delete(key);
				}
			});
		}

		repaint() {
			if(!this.hasBitmap) {
				const {width, height} = this.renderer.getSize();
				if(
					width !== this.canvas.width ||
					height !== this.canvas.height
				) {
					this.canvas.width = width;
					this.canvas.height = height;
					this._updateStyles();
				}
				this.rerender();
				return;
			}

			const data = this.renderer.getImageData();
			if(data) {
				const dataScale = this.renderer.scale || 1;
				if(
					data.width !== this.canvas.width ||
					data.height !== this.canvas.height ||
					dataScale !== this.dataScale
				) {
					this.canvas.width = data.width;
					this.canvas.height = data.height;
					this.dataScale = dataScale;
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
	};
});
