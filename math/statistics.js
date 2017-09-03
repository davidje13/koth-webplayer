define(() => {
	'use strict';

	// sort() defaults to string sort
	const numericSort = (a, b) => (a - b);

	return {
		ksTest: (results1, results2) => {
			// Thanks, https://en.wikipedia.org/wiki/Kolmogorov%E2%80%93Smirnov_test
			const l1 = results1.length;
			const l2 = results2.length;
			if(l1 + l2 === 0) {
				return 1;
			}
			const sortedResults1 = results1.slice();
			const sortedResults2 = results2.slice();
			const all = results1.concat(results2);
			sortedResults1.sort(numericSort);
			sortedResults2.sort(numericSort);
			all.sort(numericSort);
			let v = null;
			let p1 = 0;
			let p2 = 0;
			let maxDiff2 = 0;
			for(let i = 0; i < all.length; ++ i) {
				if(all[i] !== v) {
					v = all[i];
				}
				while(p1 < l1 && sortedResults1[p1] === v) {
					++ p1;
				}
				while(p2 < l2 && sortedResults2[p2] === v) {
					++ p2;
				}
				const diff = (p1 / l1) - (p2 / l2);
				maxDiff2 = Math.max(maxDiff2, diff * diff);
			}

			return Math.min(Math.exp(-2 * maxDiff2 * (l1 * l2) / (l1 + l2)) * 2, 1);
		},
	};
});
