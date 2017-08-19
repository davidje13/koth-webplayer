define(['./Ellipse'], (Ellipse) => {
	'use strict';

	describe('circumference', () => {
		it('calculates the circumference of the ellipse', () => {
			const actual = new Ellipse(5, 8).circumference();
			expect(actual, isNear(41.38628, 0.000005));
		});

		it('is near to the analytical value for circles', () => {
			for(let r = 0; r < 10; r += 0.1) {
				const circExpected = 2 * Math.PI * r;
				const actual = new Ellipse(r, r).circumference();
				expect(actual, isNear(circExpected, 0.0001), 'Radius ' + r);
			}
		});

		it('is near to the analytical value for flat ellipses (lines)', () => {
			for(let r = 0; r < 10; r += 0.1) {
				const circExpected = 4 * r;
				const actual = new Ellipse(r, 0).circumference();
				expect(actual, isNear(circExpected, 0.0001), 'Radius ' + r + ', 0');
			}
			for(let r = 0; r < 10; r += 0.1) {
				const circExpected = 4 * r;
				const actual = new Ellipse(0, r).circumference();
				expect(actual, isNear(circExpected, 0.0001), 'Radius 0, ' + r);
			}
		});
	});

	describe('fracFromTheta', () => {
		it('calculates the fraction of the circumference reached at a given theta', () => {
			const actual = new Ellipse(5, 8).fracFromTheta(Math.PI * 0.25);
			expect(actual, isNear(0.14296, 0.000005));
		});

		it('reverses thetaFromFrac', () => {
			const ellipse = new Ellipse(5, 8);
			for(let i = -4; i < 6; i += 0.1) {
				const t = Math.PI * i;
				expect(ellipse.fracFromTheta(ellipse.thetaFromFrac(t)), isNear(t, 0.000005));
			}
		});

		it('loops around', () => {
			const actual = new Ellipse(5, 8).fracFromTheta(Math.PI * 2.25);
			expect(actual, isNear(1.14296, 0.000005));
		});

		it('does not fail when given extreme inputs', () => {
			const actual = new Ellipse(5, 8).fracFromTheta(-2.220446049250313e-16);
			expect(actual, isNear(0, 0.000005));
		});
	});
});
