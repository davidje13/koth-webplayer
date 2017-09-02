define(['./arrayUtils'], (arrayUtils) => {
	'use strict';

	const rnd = {
		next: (range) => Math.floor(Math.random() * range),
	};

	describe('makeList', () => {
		it('generates a list of the requested length', () => {
			const list = arrayUtils.makeList(5, null);
			expect(list.length, equals(5));
		});

		it('populates the array with the requested default value', () => {
			const list = arrayUtils.makeList(5, 7);
			for(let i = 0; i < 5; ++ i) {
				expect(list[i], equals(7));
			}
		});

		it('can generate empty lists', () => {
			const list = arrayUtils.makeList(0);
			expect(list.length, equals(0));
		});
	});

	describe('shuffleInPlace', () => {
		it('shuffles the given list using the given random source', () => {
			const list = [1, 2, 3, 4];

			arrayUtils.shuffleInPlace(list, {
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

			arrayUtils.shuffleInPlace(list, rnd);

			expect(list.length, equals(original.length));
			for(let i = 0; i < original.length; ++ i) {
				if(list.indexOf(original[i]) === -1) {
					fail('Lost element ' + i + ' (' + original[i] + ')');
				}
			}
		});

		it('leaves empty lists unchanged', () => {
			const list = [];

			arrayUtils.shuffleInPlace(list, rnd);

			expect(list.length, equals(0));
		});
	});

	describe('shuffle', () => {
		it('shuffles a copy of the given list using the given random source', () => {
			const list = [1, 2, 3, 4];

			const list2 = arrayUtils.shuffle(list, {
				next: () => 0,
			});

			const expected = [2, 3, 4, 1];
			for(let i = 0; i < expected.length; ++ i) {
				expect(list2[i], equals(expected[i]), 'index ' + i);
			}
		});

		it('does not modify the input', () => {
			const list = [1, 2, 3, 4];

			arrayUtils.shuffle(list, rnd);

			expect(list.length, equals(4));
			for(let i = 0; i < 4; ++ i) {
				expect(list[i], equals(i + 1), 'index ' + i);
			}
		});
	});

	describe('shallowEqual', () => {
		it('returns true if the given arrays compare equal by shallow comparison', () => {
			expect(
				arrayUtils.shallowEqual(['a', 'b'], ['a', 'b']),
				equals(true)
			);
		});

		it('returns true for 2 empty lists', () => {
			expect(
				arrayUtils.shallowEqual([], []),
				equals(true)
			);
		});

		it('returns false if the given arrays have different elements', () => {
			expect(
				arrayUtils.shallowEqual(['a', 'b'], ['a', 'c']),
				equals(false)
			);

			expect(
				arrayUtils.shallowEqual(['a', 'b'], ['c', 'b']),
				equals(false)
			);
		});

		it('returns false if the given arrays have different lengths', () => {
			expect(
				arrayUtils.shallowEqual(['a', 'b', 'c'], ['a', 'b']),
				equals(false)
			);

			expect(
				arrayUtils.shallowEqual(['a', 'b'], ['a', 'b', 'c']),
				equals(false)
			);
		});
	});
});
