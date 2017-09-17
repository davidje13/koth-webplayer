define(['./geometry'], (geometry) => {
	'use strict';

	describe('findIntersection', () => {
		it('returns the intersection point of two line segments', () => {
			const result = geometry.findIntersection(
				new geometry.LineSegment(
					new geometry.Vec2(2, 3),
					new geometry.Vec2(4, 3)
				),
				new geometry.LineSegment(
					new geometry.Vec2(3, 1),
					new geometry.Vec2(3, 8)
				)
			);
			expect(result.intersection, not(equals(null)));
			expect(result.intersection.x, isNear(3, 0.0001));
			expect(result.intersection.y, isNear(3, 0.0001));
		});

		it('returns the fractional position of the intersection along each line', () => {
			const result = geometry.findIntersection(
				new geometry.LineSegment(
					new geometry.Vec2(2, 3),
					new geometry.Vec2(4, 3)
				),
				new geometry.LineSegment(
					new geometry.Vec2(3, 1),
					new geometry.Vec2(3, 8)
				)
			);
			expect(result.fraction1, isNear(1/2, 0.00001));
			expect(result.fraction2, isNear(2/7, 0.00001));
		});

		it('returns no intersection if the lines do not overlap', () => {
			const result = geometry.findIntersection(
				new geometry.LineSegment(
					new geometry.Vec2(3.5, 3),
					new geometry.Vec2(4, 3)
				),
				new geometry.LineSegment(
					new geometry.Vec2(3, 1),
					new geometry.Vec2(3, 8)
				)
			);
			expect(result.intersection, equals(null));
		});

		it('returns fractional positions even when there is no overlap', () => {
			const result = geometry.findIntersection(
				new geometry.LineSegment(
					new geometry.Vec2(3.5, 3),
					new geometry.Vec2(4, 3)
				),
				new geometry.LineSegment(
					new geometry.Vec2(3, 1),
					new geometry.Vec2(3, 8)
				)
			);
			expect(result.fraction1, isNear(-0.5 / 0.5, 0.00001));
			expect(result.fraction2, isNear(2/7, 0.00001));
		});

		it('returns no intersection for parallel lines', () => {
			const result = geometry.findIntersection(
				new geometry.LineSegment(
					new geometry.Vec2(0, 1),
					new geometry.Vec2(0, 2)
				),
				new geometry.LineSegment(
					new geometry.Vec2(1, 1),
					new geometry.Vec2(1, 2)
				)
			);
			expect(result.intersection, equals(null));
		});

		it('returns no intersection for anti-parallel lines', () => {
			const result = geometry.findIntersection(
				new geometry.LineSegment(
					new geometry.Vec2(0, 1),
					new geometry.Vec2(0, 2)
				),
				new geometry.LineSegment(
					new geometry.Vec2(1, 2),
					new geometry.Vec2(1, 1)
				)
			);
			expect(result.intersection, equals(null));
		});

		it('returns no intersection for overlapping parallel lines', () => {
			const result = geometry.findIntersection(
				new geometry.LineSegment(
					new geometry.Vec2(0, 1),
					new geometry.Vec2(0, 2)
				),
				new geometry.LineSegment(
					new geometry.Vec2(0, 1),
					new geometry.Vec2(0, 2)
				)
			);
			expect(result.intersection, equals(null));
		});

		it('returns no intersection for zero-length lines', () => {
			const result = geometry.findIntersection(
				new geometry.LineSegment(
					new geometry.Vec2(0, 1),
					new geometry.Vec2(0, 1)
				),
				new geometry.LineSegment(
					new geometry.Vec2(1, 1),
					new geometry.Vec2(1, 1)
				)
			);
			expect(result.intersection, equals(null));
		});

		it('works with non axis-aligned lines', () => {
			const result = geometry.findIntersection(
				new geometry.LineSegment(
					new geometry.Vec2(1, 2),
					new geometry.Vec2(3, 4)
				),
				new geometry.LineSegment(
					new geometry.Vec2(1, 4),
					new geometry.Vec2(5, 0)
				)
			);
			expect(result.intersection, not(equals(null)));
			expect(result.intersection.x, isNear(2, 0.0001));
			expect(result.intersection.y, isNear(3, 0.0001));
			expect(result.fraction1, isNear(1 / 2, 0.00001));
			expect(result.fraction2, isNear(1 / 4, 0.00001));
		});

	});
});
