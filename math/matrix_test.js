define(['./matrix'], (matrix) => {
	'use strict';

	// Thanks, https://math.dartmouth.edu/archive/m8s00/public_html/handouts/matrices3/node7.html
	describe('M4', () => {
		describe('det', () => {
			it('calculates the determinant of the matrix', () => {
				const data = [
					1, 0, 2, -1,
					3, 0, 0, 5,
					2, 1, 4, -3,
					1, 0, 5, 0,
				];
				const det = matrix.M4.of(data).det();
				expect(det, isNear(30, 0.001));
			});
		});

		describe('invert', () => {
			it('inverts the matrix', () => {
				const actual = matrix.M4.of([
					1, 0, 2, -1,
					3, 0, 0, 5,
					2, 1, 4, -3,
					1, 0, 5, 0,
				]).invert();

				const expected = matrix.M4.of([
					5/6, 1/6, 0, -1/3,
					-2.5, 0.1, 1, 0.2,
					-1/6, -1/30, 0, 4/15,
					-0.5, 0.1, 0, 0.2,
				]);

				for(let i = 0; i < 16; ++ i) {
					expect(actual.data[i], isNear(expected.data[i], 0.001), 'Element ' + i);
				}
			});

			it('produces the multiplicative inverse', () => {
				const mat = matrix.M4.of([
					1, 0, 2, -1,
					3, 0, 0, 5,
					2, 1, 4, -3,
					1, 0, 5, 0,
				]);
				const matInv = mat.invert();
				const matMult = mat.mult(matInv).sub(matrix.M4.identity());

				for(let i = 0; i < 16; ++ i) {
					expect(matMult.data[i], isNear(0, 0.001), 'Element ' + i);
				}
			});
		});
	});
});
