define(() => {
	'use strict';

	return class LineSegment {
		constructor(p1, p2) {
			this.p1 = p1;
			this.p2 = p2;
		}

		findIntersection(line2) {
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
			return this.p2.sub(this.p1).length();
		}
	};
});
