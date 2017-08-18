define(() => {
	'use strict';

	return class MarkerTypes3D {
		constructor() {
			this.pointerTypes = new Map();
			this.regionTypes = new Map();
		}

		registerPointer(className, {model = null, prog = null, params = null}) {
			this.pointerTypes.set(className, {model, prog, params});
		}
	}
});
