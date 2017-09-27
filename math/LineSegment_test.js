define(['./LineSegment', './vector'], (LineSegment, vector) => {
	'use strict';

	describe('findCircleIntersection', () => {
		it('returns the intersection point of a line and circle', () => {
			const result = new LineSegment(
				new vector.V2(0, 2),
				new vector.V2(4, 2)
			).findCircleIntersection(new vector.V2(2, 2), 1);
			expect(result.intersectionEntry, not(equals(null)));
			expect(result.intersectionEntry.x, isNear(1, 0.0001));
			expect(result.intersectionEntry.y, isNear(2, 0.0001));
			expect(result.intersectionExit, not(equals(null)));
			expect(result.intersectionExit.x, isNear(3, 0.0001));
			expect(result.intersectionExit.y, isNear(2, 0.0001));
		});

		it('returns the fractional positions along the line', () => {
			const result = new LineSegment(
				new vector.V2(0, 2),
				new vector.V2(4, 2)
			).findCircleIntersection(new vector.V2(2, 2), 1);
			expect(result.fractionEntry, isNear(0.25, 0.0001));
			expect(result.fractionExit, isNear(0.75, 0.0001));
		});

		it('returns no intersection if the line and circle do not touch', () => {
			const result = new LineSegment(
				new vector.V2(0, 4),
				new vector.V2(4, 4)
			).findCircleIntersection(new vector.V2(2, 2), 1);
			expect(result.intersectionEntry, equals(null));
			expect(result.intersectionExit, equals(null));
		});

		it('returns no intersection if the line stops before touching', () => {
			const result = new LineSegment(
				new vector.V2(0, 2),
				new vector.V2(0.5, 2)
			).findCircleIntersection(new vector.V2(2, 2), 1);
			expect(result.intersectionEntry, equals(null));
			expect(result.intersectionExit, equals(null));
		});

		it('returns fractional positions even when there is no overlap', () => {
			const result = new LineSegment(
				new vector.V2(0, 2),
				new vector.V2(0.5, 2)
			).findCircleIntersection(new vector.V2(2, 2), 1);
			expect(result.fractionEntry, isNear(1/0.5, 0.00001));
			expect(result.fractionExit, isNear(3/0.5, 0.00001));
		});

		it('returns entry intersection and no exit if the line stops short', () => {
			const result = new LineSegment(
				new vector.V2(0, 2),
				new vector.V2(2, 2)
			).findCircleIntersection(new vector.V2(2, 2), 1);
			expect(result.intersectionEntry, not(equals(null)));
			expect(result.intersectionExit, equals(null));
		});

		it('returns exit intersection and no entry if the line stops short', () => {
			const result = new LineSegment(
				new vector.V2(2, 2),
				new vector.V2(4, 2)
			).findCircleIntersection(new vector.V2(2, 2), 1);
			expect(result.intersectionEntry, equals(null));
			expect(result.intersectionExit, not(equals(null)));
		});

		it('returns no intersection for tangent lines', () => {
			const result = new LineSegment(
				new vector.V2(0, 3),
				new vector.V2(4, 3)
			).findCircleIntersection(new vector.V2(2, 2), 1);
			expect(result.intersectionEntry, equals(null));
			expect(result.intersectionExit, equals(null));
		});

		it('works with non axis-aligned lines', () => {
			const result = new LineSegment(
				new vector.V2(0, 1),
				new vector.V2(3, 4)
			).findCircleIntersection(new vector.V2(2, 2), 1);
			expect(result.intersectionEntry, not(equals(null)));
			expect(result.intersectionEntry.x, isNear(1, 0.0001));
			expect(result.intersectionEntry.y, isNear(2, 0.0001));
			expect(result.intersectionExit, not(equals(null)));
			expect(result.intersectionExit.x, isNear(2, 0.0001));
			expect(result.intersectionExit.y, isNear(3, 0.0001));
			expect(result.fractionEntry, isNear(1/3, 0.00001));
			expect(result.fractionExit, isNear(2/3, 0.00001));
		});

		it('returns entry and exit ordered according to the line direction', () => {
			let result = new LineSegment(
				new vector.V2(4, 2),
				new vector.V2(0, 2)
			).findCircleIntersection(new vector.V2(2, 2), 1);
			expect(result.intersectionEntry, not(equals(null)));
			expect(result.intersectionEntry.x, isNear(3, 0.0001));
			expect(result.intersectionEntry.y, isNear(2, 0.0001));
			expect(result.intersectionExit, not(equals(null)));
			expect(result.intersectionExit.x, isNear(1, 0.0001));
			expect(result.intersectionExit.y, isNear(2, 0.0001));

			result = new LineSegment(
				new vector.V2(2, 0),
				new vector.V2(2, 4)
			).findCircleIntersection(new vector.V2(2, 2), 1);
			expect(result.intersectionEntry, not(equals(null)));
			expect(result.intersectionEntry.x, isNear(2, 0.0001));
			expect(result.intersectionEntry.y, isNear(1, 0.0001));
			expect(result.intersectionExit, not(equals(null)));
			expect(result.intersectionExit.x, isNear(2, 0.0001));
			expect(result.intersectionExit.y, isNear(3, 0.0001));

			result = new LineSegment(
				new vector.V2(2, 4),
				new vector.V2(2, 0)
			).findCircleIntersection(new vector.V2(2, 2), 1);
			expect(result.intersectionEntry, not(equals(null)));
			expect(result.intersectionEntry.x, isNear(2, 0.0001));
			expect(result.intersectionEntry.y, isNear(3, 0.0001));
			expect(result.intersectionExit, not(equals(null)));
			expect(result.intersectionExit.x, isNear(2, 0.0001));
			expect(result.intersectionExit.y, isNear(1, 0.0001));

			result = new LineSegment(
				new vector.V2(3, 4),
				new vector.V2(0, 1)
			).findCircleIntersection(new vector.V2(2, 2), 1);
			expect(result.intersectionEntry, not(equals(null)));
			expect(result.intersectionEntry.x, isNear(2, 0.0001));
			expect(result.intersectionEntry.y, isNear(3, 0.0001));
			expect(result.intersectionExit, not(equals(null)));
			expect(result.intersectionExit.x, isNear(1, 0.0001));
			expect(result.intersectionExit.y, isNear(2, 0.0001));
		});

	});

	describe('findLineIntersection', () => {
		it('returns the intersection point of two line segments', () => {
			const result = new LineSegment(
				new vector.V2(2, 3),
				new vector.V2(4, 3)
			).findLineIntersection(new LineSegment(
				new vector.V2(3, 1),
				new vector.V2(3, 8)
			));
			expect(result.intersection, not(equals(null)));
			expect(result.intersection.x, isNear(3, 0.0001));
			expect(result.intersection.y, isNear(3, 0.0001));
		});

		it('returns the fractional position of the intersection along each line', () => {
			const result = new LineSegment(
				new vector.V2(2, 3),
				new vector.V2(4, 3)
			).findLineIntersection(new LineSegment(
				new vector.V2(3, 1),
				new vector.V2(3, 8)
			));
			expect(result.fraction1, isNear(1/2, 0.00001));
			expect(result.fraction2, isNear(2/7, 0.00001));
		});

		it('returns no intersection if the lines do not overlap', () => {
			const result = new LineSegment(
				new vector.V2(3.5, 3),
				new vector.V2(4, 3)
			).findLineIntersection(new LineSegment(
				new vector.V2(3, 1),
				new vector.V2(3, 8)
			));
			expect(result.intersection, equals(null));
		});

		it('returns fractional positions even when there is no overlap', () => {
			const result = new LineSegment(
				new vector.V2(3.5, 3),
				new vector.V2(4, 3)
			).findLineIntersection(new LineSegment(
				new vector.V2(3, 1),
				new vector.V2(3, 8)
			));
			expect(result.fraction1, isNear(-0.5 / 0.5, 0.00001));
			expect(result.fraction2, isNear(2/7, 0.00001));
		});

		it('returns no intersection for parallel lines', () => {
			const result = new LineSegment(
				new vector.V2(0, 1),
				new vector.V2(0, 2)
			).findLineIntersection(new LineSegment(
				new vector.V2(1, 1),
				new vector.V2(1, 2)
			));
			expect(result.intersection, equals(null));
		});

		it('returns no intersection for anti-parallel lines', () => {
			const result = new LineSegment(
				new vector.V2(0, 1),
				new vector.V2(0, 2)
			).findLineIntersection(new LineSegment(
				new vector.V2(1, 2),
				new vector.V2(1, 1)
			));
			expect(result.intersection, equals(null));
		});

		it('returns no intersection for overlapping parallel lines', () => {
			const result = new LineSegment(
				new vector.V2(0, 1),
				new vector.V2(0, 2)
			).findLineIntersection(new LineSegment(
				new vector.V2(0, 1),
				new vector.V2(0, 2)
			));
			expect(result.intersection, equals(null));
		});

		it('returns no intersection for zero-length lines', () => {
			const result = new LineSegment(
				new vector.V2(0, 1),
				new vector.V2(0, 1)
			).findLineIntersection(new LineSegment(
				new vector.V2(1, 1),
				new vector.V2(1, 1)
			));
			expect(result.intersection, equals(null));
		});

		it('works with non axis-aligned lines', () => {
			const result = new LineSegment(
				new vector.V2(1, 2),
				new vector.V2(3, 4)
			).findLineIntersection(new LineSegment(
				new vector.V2(1, 4),
				new vector.V2(5, 0)
			));
			expect(result.intersection, not(equals(null)));
			expect(result.intersection.x, isNear(2, 0.0001));
			expect(result.intersection.y, isNear(3, 0.0001));
			expect(result.fraction1, isNear(1 / 2, 0.00001));
			expect(result.fraction2, isNear(1 / 4, 0.00001));
		});
	});
});
