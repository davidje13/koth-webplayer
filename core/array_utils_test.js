define(['./array_utils'], (array_utils) => {
	'use strict';

	const rnd = {
		next: (range) => Math.floor(Math.random() * range),
	};

	describe('makeList', () => {
		it('generates a list of the requested length', () => {
			const list = array_utils.makeList(5, null);
			expect(list.length, equals(5));
		});

		it('populates the array with the requested default value', () => {
			const list = array_utils.makeList(5, 7);
			for(let i = 0; i < 5; ++ i) {
				expect(list[i], equals(7));
			}
		});
	});

	describe('shuffleInPlace', () => {
		it('shuffles the given list using the given random source', () => {
			const list = [1, 2, 3, 4];

			array_utils.shuffleInPlace(list, {
				next: () => 0,
			});

			const expected = [2, 3, 4, 1];
			for(let i = 0; i < expected.length; ++ i) {
				expect(list[i], equals(expected[i]), 'index ' + i);
			}
		});

		it('maintains all original elements', () => {
			const original = [5, 11, 'foo', 0.1];
			const list = original.slice();

			array_utils.shuffleInPlace(list, rnd);

			expect(list.length, equals(original.length));
			for(let i = 0; i < original.length; ++ i) {
				if(list.indexOf(original[i]) === -1) {
					fail('Lost element ' + i + ' (' + original[i] + ')');
				}
			}
		});
	});
});
