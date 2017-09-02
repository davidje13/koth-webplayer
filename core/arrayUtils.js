define(() => {
	'use strict';

	function shuffleInPlace(list, random) {
		// Thanks, https://stackoverflow.com/a/6274381/1180785
		for(let i = list.length; (i --) > 0;) {
			const r = random.next(i + 1);
			[list[i], list[r]] = [list[r], list[i]];
		}
	}

	return {
		makeList: (length, initialValue) => {
			const r = [];
			r.length = length;
			r.fill(initialValue);
			return r;
		},

		shuffleInPlace,

		shuffle: (list, random) => {
			const copy = list.slice();
			shuffleInPlace(copy, random);
			return copy;
		},

		shallowEqual: (a1, a2) => {
			return (
				a1.length === a2.length &&
				a1.every((v, i) => (a2[i] === v))
			);
		},
	};
});
