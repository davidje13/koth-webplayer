define(() => {
	'use strict';

	let deepCopy = null;

	function deepCopyObject(o, mapping) {
		let r = null;
		if(Array.isArray(o)) {
			r = [];
		} else {
			r = {};
		}
		mapping.set(o, r);
		for(const key of Object.keys(o)) {
			r[key] = deepCopy(o[key], mapping);
		}
		return r;
	}

	deepCopy = (o, mapping = null) => {
		if(mapping && mapping.has(o)) {
			return mapping.get(o);
		}
		if(typeof o !== 'object' || !o) {
			return o;
		}
		return deepCopyObject(o, mapping || new Map());
	};

	return {
		deepCopy,
	};
});
