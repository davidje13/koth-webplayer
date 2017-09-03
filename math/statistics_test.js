define(['./statistics'], (statistics) => {
	'use strict';

	describe('ksTest', () => {
		it('calculates the alpha value for the two-sample Kolmogorov-Smirnov test', () => {
			// Data from http://influentialpoints.com/Training/kolmogorov-smirnov_test.htm
			const sample1 = [45, 87, 123, 120, 70];
			const sample2 = [51, 51, 71, 49, 42, 56, 37, 47, 51, 58, 78];
			const expectedD = 0.6182;
			const expectedAlpha = 0.145;

			const alpha = statistics.ksTest(sample1, sample2);
			const D = (
				Math.sqrt(-0.5 * Math.log(alpha / 2)) *
				Math.sqrt(
					(sample1.length + sample2.length) /
					(sample1.length * sample2.length)
				)
			);

			expect(D, isNear(expectedD, 0.00005));
			expect(alpha, isNear(expectedAlpha, 0.0005));
		});

		it('returns 1 (not distinct) for identical distributions', () => {
			const sample = [0, 1, 2, 3];
			const alpha = statistics.ksTest(sample, sample);
			expect(alpha, equals(1));
		});

		it('returns close to 0 (distinct) for very different distributions', () => {
			const sample1 = [0, 0, 0, 0];
			const sample2 = [1, 1, 1, 1];
			const alpha = statistics.ksTest(sample1, sample2);
			expect(alpha, isLowerThan(0.05));
		});

		it('becomes more confident with more samples', () => {
			const sample1a = [0, 0, 0, 0];
			const sample2a = [1, 1, 1, 1];
			const sample1b = [0, 0, 0, 0, 0, 0, 0, 0];
			const sample2b = [1, 1, 1, 1, 1, 1, 1, 1];
			const alpha1 = statistics.ksTest(sample1a, sample2a);
			const alpha2 = statistics.ksTest(sample1b, sample2b);
			expect(alpha2, isLowerThan(alpha1));
		});

		it('returns 1 (not distinct) if no input is given', () => {
			const alpha = statistics.ksTest([], []);
			expect(alpha, equals(1));
		});
	});
});
