define([
	'core/EventObject',
	'core/rateUtils',
	'./documentUtils',
	'./style.css',
], (
	EventObject,
	rateUtils,
	docutil
) => {
	'use strict';

	const VERTICAL = {};
	const HORIZONTAL = {};

	class SplitView extends EventObject {
		constructor(panes, config) {
			super();

			this.redraw = this.redraw.bind(this);
			this._throttledRedraw = rateUtils.throttle(this.redraw);
			this._beginDrag = this._beginDrag.bind(this);
			this._drag = this._drag.bind(this);
			this._endDrag = this._endDrag.bind(this);

			this.dragPos = 0;
			this.dragScale = 0;
			this.dragMin = 0;
			this.dragIndex = 0;
			this.debouncedUpdate = null;
			this.panes = [];
			this.handles = [];
			this.sizes = [];
			this.minFrac = 0.1;
			this.className = '';
			this.direction = VERTICAL;
			this.fixedSize = true;
			this.hold = docutil.make('div');
			this.setPanes(panes, config);
		}

		_totalFrac() {
			let sum = 0;
			for(let i = 0; i < this.panes.length; ++ i) {
				sum += this.sizes[i];
			}
			return sum;
		}

		_beginDrag(e) {
			const size = this.hold.getBoundingClientRect();
			const sz = ((this.direction === VERTICAL) ? size.height : size.width);
			if(sz > 0) {
				this.dragPos = ((this.direction === VERTICAL) ? e.pageY : e.pageX);
				const sum = this._totalFrac();
				this.dragScale = sum / sz;
				this.dragMin = this.minFrac * sum;
				this.dragIndex = Number(e.target.getAttribute('data-index'));
				window.addEventListener('mousemove', this._drag);
				window.addEventListener('mouseup', this._endDrag);
			}
			e.preventDefault();
		}

		_drag(e) {
			const pos = ((this.direction === VERTICAL) ? e.pageY : e.pageX);
			const delta = (pos - this.dragPos) * this.dragScale;
			const limit = this.dragMin;
			let i = this.dragIndex;
			let d = delta;
			while(i >= 0) {
				this.sizes[i] += d;
				if(this.sizes[i] < limit) {
					d = this.sizes[i] - limit;
					this.sizes[i] = limit;
					-- i;
				} else {
					d = 0;
					break;
				}
			}
			d -= delta;
			i = this.dragIndex + 1;
			while(i < this.sizes.length) {
				this.sizes[i] += d;
				if(this.sizes[i] < limit) {
					d = this.sizes[i] - limit;
					this.sizes[i] = limit;
					++ i;
				} else {
					d = 0;
					break;
				}
			}
			this.sizes[this.dragIndex] += d;
			this.dragPos = pos;
			this._throttledRedraw();
			e.preventDefault();
		}

		_endDrag(e) {
			this._drag(e);
			window.removeEventListener('mousemove', this._drag);
			window.removeEventListener('mouseup', this._endDrag);
			e.preventDefault();
		}

		redraw() {
			this._throttledRedraw.abort();
			const totalSize = this._totalFrac();
			let sum = 0;
			this.panes.forEach((element, index) => {
				const cur = this.sizes[index] / totalSize;
				if(!this.fixedSize) {
					docutil.updateStyle(element, {
						'top': undefined,
						'height': undefined,
					});
				} else if(this.direction === VERTICAL) {
					docutil.updateStyle(element, {
						'top': (sum * 100) + '%',
						'height': (cur * 100) + '%',
					});
				} else {
					docutil.updateStyle(element, {
						'left': (sum * 100) + '%',
						'width': (cur * 100) + '%',
					});
				}
				sum += cur;
			});
			sum = 0;
			this.handles.forEach((handle, index) => {
				sum += this.sizes[index] / totalSize;
				if(this.direction === VERTICAL) {
					docutil.updateStyle(handle, {'top': (sum * 100) + '%'});
				} else {
					docutil.updateStyle(handle, {'left': (sum * 100) + '%'});
				}
			});
			this.trigger('resize');
		}

		rebuild() {
			docutil.empty(this.hold);
			this.handles.forEach((handle) =>
				handle.removeEventListener('mousedown', this._beginDrag));
			this.handles.length = 0;

			docutil.updateAttrs(this.hold, {
				'class': (
					this.className +
					' split-view' +
					(this.fixedSize ? ' fixed-size' : '') +
					(this.direction === VERTICAL ? ' vert' : ' horiz')
				),
			});
			this.panes.forEach((element) => this.hold.appendChild(element));
			if(this.fixedSize) {
				for(let index = 0; index < this.panes.length - 1; ++ index) {
					const handle = docutil.make('div', {'class': 'handle', 'data-index': index});
					handle.addEventListener('mousedown', this._beginDrag);
					this.handles.push(handle);
					this.hold.appendChild(handle);
				}
			}
			this.redraw();
		}

		setPanes(panes, {direction, fixedSize, className} = {}) {
			this.panes.length = 0;
			panes.forEach((pane, index) => {
				let element = pane;
				if(pane.element) {
					element = pane.element;
					if(pane.fraction) {
						this.sizes[index] = pane.fraction;
					}
				}
				this.panes.push(element);
				if(this.sizes.length <= index) {
					this.sizes.push(1);
				}
			});
			if(direction !== undefined) {
				this.direction = direction;
			}
			if(fixedSize !== undefined) {
				this.fixedSize = fixedSize;
			}
			if(className !== undefined) {
				this.className = className;
			}

			this.rebuild();
		}

		dom() {
			return this.hold;
		}
	}

	SplitView.VERTICAL = VERTICAL;
	SplitView.HORIZONTAL = HORIZONTAL;

	return SplitView;
});
