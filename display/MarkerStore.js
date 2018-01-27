define(() => {
	'use strict';

	return class MarkerStore {
		constructor() {
			this.marks = new Map();
		}

		mark(key, {
			x, y,
			w = null, h = null,
			toX = null, toY = null,
			className,
			content = null,
			wrap = true,
			clip = true,
			tooltip = '',
		}) {
			this.marks.set(key, {
				x, y,
				w, h,
				toX, toY,
				className,
				content,
				wrap,
				clip,
				tooltip,
			});
		}

		removeMark(key) {
			this.marks.delete(key);
		}

		clear() {
			this.marks.clear();
		}
	};
});
