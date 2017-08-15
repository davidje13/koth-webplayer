define(() => {
	'use strict';

	const PI2 = 2 * Math.PI;
	const iPI2 = 0.5 / Math.PI;

	return class Ellipse {
		constructor(radA, radB, lengthPrecision = 1000) {
			let l = 0;
			const segThetaRange = PI2 / lengthPrecision;
			this.cumulativeLengths = [0];
			for(let t = 0; t < lengthPrecision; ++ t) {
				const mid = PI2 * (t + 0.5) / lengthPrecision;
				const A = radA * Math.sin(mid);
				const B = radB * Math.cos(mid);
				const length = segThetaRange * Math.sqrt(A * A + B * B);
				l += length;
				this.cumulativeLengths.push(l);
			}
		}

		precision() {
			return this.cumulativeLengths.length - 1;
		}

		circumference() {
			return this.cumulativeLengths[this.precision()];
		}

		thetaFromFrac(f) {
			const count = this.precision();
			const l = (((f % 1) + 1) % 1) * this.circumference();
			let r0 = 0;
			let r1 = count;
			while(r1 > r0 + 1) {
				const mid = ((r0 + r1) / 2)|0;
				if(this.cumulativeLengths[mid] >= l) {
					r1 = mid;
				} else {
					r0 = mid;
				}
			}
			const v0 = this.cumulativeLengths[r0];
			const v1 = this.cumulativeLengths[r1];
			let v;
			if(l <= v0) {
				v = r0;
			} else if(l >= v1) {
				v = r1;
			} else {
				v = r0 + (l - v0) / (v1 - v0);
			}
			return PI2 * ((v / count) + Math.floor(f));
		}

		fracFromTheta(t) {
			const nt = t * iPI2;
			const p = (((nt % 1) + 1) % 1) * this.precision();
			const v0 = this.cumulativeLengths[ p|0   ];
			const v1 = this.cumulativeLengths[(p|0)+1];
			return (
				(v0 + (v1 - v0) * (p % 1)) / this.circumference() +
				Math.floor(nt)
			);
		}

		arcLength(theta1, theta2) {
			return (
				this.fracFromTheta(theta2) -
				this.fracFromTheta(theta1)
			) * this.circumference();
		}
	}
});
