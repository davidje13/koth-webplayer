define(['./Ellipse'], (Ellipse) => {
	'use strict';

	describe('circumference', () => {
		it('calculates the circumference of the ellipse', () => {
			const circActual = new Ellipse(5, 8).circumference();
			expect(circActual, isNear(41.38628, 0.000005));
		});

		it('is near to the analytical value for circles', () => {
			for(let r = 0; r < 10; r += 0.1) {
				const circExpected = 2 * Math.PI * r;
				const circActual = new Ellipse(r, r).circumference();
				expect(circActual, isNear(circExpected, 0.0001), 'Radius ' + r);
			}
		});

		it('is near to the analytical value for flat ellipses (lines)', () => {
			for(let r = 0; r < 10; r += 0.1) {
				const circExpected = 4 * r;
				const circActual = new Ellipse(r, 0).circumference();
				expect(circActual, isNear(circExpected, 0.0001), 'Radius ' + r + ', 0');
			}
			for(let r = 0; r < 10; r += 0.1) {
				const circExpected = 4 * r;
				const circActual = new Ellipse(0, r).circumference();
				expect(circActual, isNear(circExpected, 0.0001), 'Radius 0, ' + r);
			}
		});
	});
});
