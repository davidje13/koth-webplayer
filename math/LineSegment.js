define(() => {
	'use strict';

	function rot90(v) {
		const t = v.y;
		v.y = -v.x;
		v.x = t;
		return v;
	}

	return class LineSegment {
		constructor(p1, p2) {
			this.p1 = p1;
			this.p2 = p2;
		}

		findCircleIntersection(centre, radius) {
			const d = this.p2.sub(this.p1);
			const D = this.p1.sub(centre).cross(this.p2.sub(centre));
			const dr2 = d.dot(d);
			const discriminant = radius * radius * dr2 - D * D;
			if(discriminant <= 0) {
				return {
					intersectionEntry: null,
					intersectionExit: null,
					fractionEntry: null,
					fractionExit: null,
				};
			}
			const factor = ((d.y >= 0) ? 1 : -1) * Math.sqrt(discriminant) / dr2;
			const p = rot90(d.mult(D / dr2)).add(centre);
			const A = p.addMult(d, -factor);
			const B = p.addMult(d, factor);
			const fA = A.sub(this.p1).dot(d) / dr2;
			const fB = B.sub(this.p1).dot(d) / dr2;
			if(fA > fB) {
				return {
					intersectionEntry: (fB >= 0 && fB <= 1) ? B : null,
					intersectionExit: (fA >= 0 && fA <= 1) ? A : null,
					fractionEntry: fB,
					fractionExit: fA,
				};
			} else {
				return {
					intersectionEntry: (fA >= 0 && fA <= 1) ? A : null,
					intersectionExit: (fB >= 0 && fB <= 1) ? B : null,
					fractionEntry: fA,
					fractionExit: fB,
				};
			}
		}

		findLineIntersection(line2) {
			// Thanks, https://stackoverflow.com/a/1968345/1180785

			const s1 = this.p2.sub(this.p1);
			const s2 = line2.p2.sub(line2.p1);
			const d = line2.p1.sub(this.p1);

			const norm = 1 / s1.cross(s2);
			const f1 = d.cross(s2) * norm;
			const f2 = d.cross(s1) * norm;

			return {
				intersection: ((
					f1 >= 0 && f1 <= 1 &&
					f2 >= 0 && f2 <= 1
				) ? this.p1.addMult(s1, f1) : null),
				fraction1: f1,
				fraction2: f2,
			};
		}

		length() {
			return this.p2.distance(this.p1);
		}
	};
});
