define(['./webglUtils'], (webglUtils) => {
	'use strict';

	describe('nextPoT', () => {
		it('returns a power-of-two >= the given value', () => {
			expect(webglUtils.nextPoT(10), equals(16));
		});

		it('returns powers-of-two unchanged (up to 32-bits)', () => {
			let v = 1;
			for(let i = 0; i < 32; ++ i) {
				expect(webglUtils.nextPoT(v), equals(v), 'input ' + v);
				v *= 2;
			}
		});

		it('returns 0 for 0', () => {
			expect(webglUtils.nextPoT(0), equals(0));
		});
	});
});
