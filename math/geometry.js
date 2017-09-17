define(() => {
	'use strict';

	class Vec2 {
		constructor(x = 0, y = 0) {
			this.x = x;
			this.y = y;
		}

		set(x, y) {
			this.x = x;
			this.y = y;
			return this;
		}

		add(v) {
			return new Vec2(
				this.x + v.x,
				this.y + v.y
			);
		}

		addMult(v, m) {
			return new Vec2(
				this.x + v.x * m,
				this.y + v.y * m
			);
		}

		sub(v) {
			return new Vec2(
				this.x - v.x,
				this.y - v.y
			);
		}

		dot(v) {
			return this.x * v.x + this.y * v.y;
		}

		cross(v) {
			return this.x * v.y - this.y * v.x;
		}

		length() {
			return Math.sqrt(this.dot(this));
		}

		norm() {
			const m = 1 / this.length();
			return new Vec2(
				this.x * m,
				this.y * m
			);
		}
	}

	class LineSegment {
		constructor(p1, p2) {
			this.p1 = p1;
			this.p2 = p2;
		}
	}

	return {
		Vec2,
		LineSegment,
		findIntersection: (l1, l2) => {
			// Thanks, https://stackoverflow.com/a/1968345/1180785

			const s1 = l1.p2.sub(l1.p1);
			const s2 = l2.p2.sub(l2.p1);
			const d = l2.p1.sub(l1.p1);

			const norm = 1 / s1.cross(s2);
			const f1 = d.cross(s2) * norm;
			const f2 = d.cross(s1) * norm;

			return {
				intersection: ((
					f1 >= 0 && f1 <= 1 &&
					f2 >= 0 && f2 <= 1
				) ? l1.p1.addMult(s1, f1) : null),
				fraction1: f1,
				fraction2: f2,
			};
		},
	};
});
