define(['./Mat4'], (Mat4) => {
	'use strict';

	describe('det', () => {
		it('calculates the determinant of the matrix', () => {
			// Thanks, https://math.dartmouth.edu/archive/m8s00/public_html/handouts/matrices3/node7.html
			const data = [
				1, 0, 2, -1,
				3, 0, 0, 5,
				2, 1, 4, -3,
				1, 0, 5, 0,
			];
			const det = Mat4.of(data).det();
			expect(det, isNear(30, 0.001));
		});
	});

	describe('invert', () => {
		it('inverts the matrix', () => {
			const actual = Mat4.of([
				1, 0, 2, -1,
				3, 0, 0, 5,
				2, 1, 4, -3,
				1, 0, 5, 0,
			]).invert();

			const expected = Mat4.of([
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
			const mat = Mat4.of([
				1, 0, 2, -1,
				3, 0, 0, 5,
				2, 1, 4, -3,
				1, 0, 5, 0,
			]);
			const matInv = mat.invert();
			const matMult = mat.mult(matInv).sub(Mat4.identity());

			for(let i = 0; i < 16; ++ i) {
				expect(matMult.data[i], isNear(0, 0.001), 'Element ' + i);
			}
		});
	});
});
