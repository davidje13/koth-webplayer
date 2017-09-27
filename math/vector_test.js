define(['./vector'], (vector) => {
	'use strict';

	describe('V2', () => {
		it('represents a 2D vector', () => {
			const vec = new vector.V2(10, 20);
			expect(vec.x, equals(10));
			expect(vec.y, equals(20));
		});

		describe('dot', () => {
			it('calculates the dot-product', () => {
				const v1 = new vector.V2(4, 5);
				const v2 = new vector.V2(6, 7);
				expect(v1.dot(v2), equals(4 * 6 + 5 * 7));
			});
		});

		describe('cross', () => {
			it('calculates the 2D cross-product', () => {
				const v1 = new vector.V2(4, 5);
				const v2 = new vector.V2(6, 7);
				expect(v1.cross(v2), equals(4 * 7 - 5 * 6));
			});
		});

		describe('add', () => {
			it('returns a new vector', () => {
				const v1 = new vector.V2(4, 5);
				const v2 = new vector.V2(6, 7);
				const vec = v1.add(v2);
				expect(vec.x, equals(10));
				expect(vec.y, equals(12));
			});

			it('does not modify the input vectors', () => {
				const v1 = new vector.V2(4, 5);
				const v2 = new vector.V2(6, 7);
				v1.add(v2);
				expect(v1.x, equals(4));
				expect(v1.y, equals(5));
				expect(v2.x, equals(6));
				expect(v2.y, equals(7));
			});
		});

		describe('sub', () => {
			it('returns a new vector', () => {
				const v1 = new vector.V2(4, 5);
				const v2 = new vector.V2(6, 7);
				const vec = v1.sub(v2);
				expect(vec.x, equals(-2));
				expect(vec.y, equals(-2));
			});

			it('does not modify the input vectors', () => {
				const v1 = new vector.V2(4, 5);
				const v2 = new vector.V2(6, 7);
				v1.sub(v2);
				expect(v1.x, equals(4));
				expect(v1.y, equals(5));
				expect(v2.x, equals(6));
				expect(v2.y, equals(7));
			});
		});

		describe('length', () => {
			it('returns the length of the vector', () => {
				const vec = new vector.V2(3, 4);
				expect(vec.length(), isNear(5, 0.0001));
			});
		});

		describe('distance', () => {
			it('returns the distance between two vectors', () => {
				const vec1 = new vector.V2(4, 5);
				const vec2 = new vector.V2(1, 1);
				expect(vec1.distance(vec2), isNear(5, 0.0001));
			});
		});

		describe('norm', () => {
			it('returns a normalised vector (length = 1)', () => {
				const v = new vector.V2(3, 4);
				const vec = v.norm();
				expect(vec.x, isNear(0.6, 0.00001));
				expect(vec.y, isNear(0.8, 0.00001));
			});

			it('does not modify the input vector', () => {
				const v = new vector.V2(3, 4);
				v.norm();
				expect(v.x, equals(3));
				expect(v.y, equals(4));
			});
		});
	});
});
