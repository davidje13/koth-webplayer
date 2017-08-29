define(() => {
	'use strict';

	return class MarkerStore {
		constructor() {
			this.marks = new Map();
		}

		mark(key, {x, y, w = null, h = null, className, content = null, wrap = true, clip = true}) {
			this.marks.set(key, {x, y, w, h, className, content, wrap, clip});
		}

		removeMark(key) {
			this.marks.delete(key);
		}

		clear() {
			this.marks.clear();
		}
	}
});
