define(() => {
	'use strict';

	// sort() defaults to string sort
	const numericSort = (a, b) => (a - b);

	const numericSortTagged = (a, b) => (a.val - b.val);

	//Used to compute the significance of the Mann-Whitney U test
	//Since we are comparing adjacently ranked entries, ties are sure to
	//abound. Therefore, the approximate distribution is used to avoid the
	//computationally intensive task of exhaustively enumerating the sampling
	//distribution of U.
	function mwMean(a, b) {
		return a*b/2;
	}

	function mwStdev(a, b, ties) {
		const tieMap = ties.map(t => (t*t*t-t)/(a+b)/(a+b-1));
		const correction = tieMap.reduce((x,y)=>x+y, 0);
		return Math.sqrt(a*b*(a+b+1-correction)/12);
	}

	//Approximation of the normal distribution CDF from the specified z to infinity
	//Close enough for out purposes

	//Magic constants derived from
	//https://stackoverflow.com/questions/14846767/std-normal-cdf-normal-cdf-or-error-function
	const a1 =  0.254829592;
	const a2 = -0.284496736;
	const a3 =  1.421413741;
	const a4 = -1.453152027;
	const a5 =  1.061405429;

	function normalCdf(z) {
		if (!isFinite(z)) {
			return 0.5;
		}
		const t = 1/(1+0.231641888*Math.abs(z));
		const erf = 1-(((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t*Math.exp(-z*z/2);
		return (1 +  ((z<0)?erf:(-erf)))/2;
	}

	function firstPosCount(combinedResults, baseIndex, i) {
		let counter = 0;
		for (let j = baseIndex; j < i; j++) {
			if (combinedResults[j].tag === 1) {
				counter++;
			}
		}
		return counter;
	}

	function rankSum(combinedResults) {
		// Find ties, and assign them the same average rank
		// Visualization:
		// [0,1,1,2,3...
		//  . ^
		//    . ^
		//    .   ^
		//        . ^
		let baseIndex = 0;
		let knownTies = [];
		let rank1Sum = 0;
		for (let i = 1; i < combinedResults.length; i++) {
			if (combinedResults[baseIndex].val < combinedResults[i].val) {
				if (i-baseIndex > 1) {
					knownTies.push(i-baseIndex);
				}
				const averageRank = (baseIndex + i + 1)/2; //Convert from indices to ranks
				rank1Sum += averageRank*firstPosCount(combinedResults, baseIndex, i);
				baseIndex = i;
			}
		}
		//At the end, take the remaining indices and label them accordingly
		if (combinedResults.length - baseIndex > 1) {
			knownTies.push(combinedResults.length - baseIndex);
		}
		const averageRank = (baseIndex + combinedResults.length)/2;
		rank1Sum += averageRank*firstPosCount(combinedResults, baseIndex, combinedResults.length);
		return {
			rankSum: rank1Sum,
			knownTies,
		};
	}

	return {
		normalCdf,

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

		mwTest: (results1, results2) => {
			//Mann-Whitney's U test. Though it is tempting to try to conduct
			//paired comparison tests within shared games, matchup interactions
			//are a thing, and might sidetrack a statistic intended only to
			//determine pairwise ranking significance.
			const l1 = results1.length;
			const l2 = results2.length;
			if(l1 + l2 === 0) {
				return 1;
			}
			const taggedResults1 = results1.map(x=>({val:x, tag:1}));
			const taggedResults2 = results2.map(x=>({val:x, tag:2}));
			const combinedResults = taggedResults1.concat(taggedResults2);
			combinedResults.sort(numericSortTagged);

			const rankCombine = rankSum(combinedResults);
			const averageExpectedRank = l1*(l1+1)/2;
			const U = rankCombine.rankSum - averageExpectedRank;
			if (Math.abs(U - mwMean(l1, l2)) > 0.5) {
				//.5 difference here is continuity correction
				let z = Math.abs(U - mwMean(l1, l2) - 0.5)/mwStdev(l1, l2, rankCombine.knownTies);
				return Math.min(normalCdf(z)*2, 1);
			} else {
				return 1;
			}
		},
	};
});
