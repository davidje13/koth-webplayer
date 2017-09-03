define(() => {
	'use strict';

	class Vec3 {
		constructor(x = 0, y = 0, z = 0) {
			this.x = x;
			this.y = y;
			this.z = z;
		}

		set(x, y, z) {
			this.x = x;
			this.y = y;
			this.z = z;
			return this;
		}

		add(v) {
			return new Vec3(
				this.x + v.x,
				this.y + v.y,
				this.z + v.z
			);
		}

		sub(v) {
			return new Vec3(
				this.x - v.x,
				this.y - v.y,
				this.z - v.z
			);
		}

		dot(v) {
			return (
				this.x * v.x +
				this.y * v.y +
				this.z * v.z
			);
		}

		cross(v) {
			return new Vec3(
				this.y * v.z - this.z * v.y,
				this.z * v.x - this.x * v.z,
				this.x * v.y - this.y * v.x
			);
		}

		length() {
			return Math.sqrt(this.dot(this));
		}

		norm() {
			const m = 1 / this.length();
			return new Vec3(
				this.x * m,
				this.y * m,
				this.z * m
			);
		}
	}

	class Mat4 {
		constructor() {
			this.data = new Float32Array(16); // col major
		}

		setCM(values) {
			for(let i = 0; i < 16; ++ i) {
				this.data[i] = values[i];
			}
			return this;
		}

		setRM(values) {
			for(let i = 0; i < 4; ++ i) {
				for(let j = 0; j < 4; ++ j) {
					this.data[i * 4 + j] = values[j * 4 + i];
				}
			}
			return this;
		}

		as3() {
			return [
				this.data[ 0], this.data[ 1], this.data[ 2],
				this.data[ 4], this.data[ 5], this.data[ 6],
				this.data[ 8], this.data[ 9], this.data[10],
			];
		}

		sub(m) {
			for(let i = 0; i < 16; ++ i) {
				this.data[i] -= m.data[i];
			}
			return this;
		}

		multScalar(s) {
			for(let i = 0; i < 16; ++ i) {
				this.data[i] *= s;
			}
			return this;
		}

		translate(x, y, z) {
			this.data[12] += x;
			this.data[13] += y;
			this.data[14] += z;
			return this;
		}

		noTranslate() {
			this.data[12] = 0;
			this.data[13] = 0;
			this.data[14] = 0;
			return this;
		}

		mult(b) {
			const result = new Mat4();
			for(let i = 0; i < 4; ++ i) {
				for(let j = 0; j < 4; ++ j) {
					let v = 0;
					for(let k = 0; k < 4; ++ k) {
						v += this.data[i * 4 + k] * b.data[k * 4 + j];
					}
					result.data[i * 4 + j] = v;
				}
			}
			return result;
		}

		transpose() {
			for(let i = 0; i < 3; ++ i) {
				for(let j = i + 1; j < 4; ++ j) {
					const t = this.data[i * 4 + j];
					this.data[i * 4 + j] = this.data[j * 4 + i];
					this.data[j * 4 + i] = t;
				}
			}
			return this;
		}

		det() {
			const d = this.data;
			/* jshint -W014 */ // tabular form is easier to work with
			return (
				+ d[ 0]*d[ 5]*d[10]*d[15] + d[ 0]*d[ 9]*d[14]*d[ 7] + d[ 0]*d[13]*d[ 6]*d[11]
				+ d[ 4]*d[ 1]*d[14]*d[11] + d[ 4]*d[ 9]*d[ 2]*d[15] + d[ 4]*d[13]*d[10]*d[ 3]
				+ d[ 8]*d[ 1]*d[ 6]*d[15] + d[ 8]*d[ 5]*d[14]*d[ 3] + d[ 8]*d[13]*d[ 2]*d[ 7]
				+ d[12]*d[ 1]*d[10]*d[ 7] + d[12]*d[ 5]*d[ 2]*d[11] + d[12]*d[ 9]*d[ 6]*d[ 3]
				- d[ 0]*d[ 5]*d[14]*d[11] - d[ 0]*d[ 9]*d[ 6]*d[15] - d[ 0]*d[13]*d[10]*d[ 7]
				- d[ 4]*d[ 1]*d[10]*d[15] - d[ 4]*d[ 9]*d[14]*d[ 3] - d[ 4]*d[13]*d[ 2]*d[11]
				- d[ 8]*d[ 1]*d[14]*d[ 7] - d[ 8]*d[ 5]*d[ 2]*d[15] - d[ 8]*d[13]*d[ 6]*d[ 3]
				- d[12]*d[ 1]*d[ 6]*d[11] - d[12]*d[ 5]*d[10]*d[ 3] - d[12]*d[ 9]*d[ 2]*d[ 7]
			);
		}

		invert() {
			// Thanks, http://www.cg.info.hiroshima-cu.ac.jp/~miyazaki/knowledge/teche23.html
			const d = this.data;
			const det = this.det();
			/* jshint -W014 */ // tabular form is easier to work with
			return Mat4.of([
				+ d[ 5]*d[10]*d[15] + d[ 9]*d[14]*d[ 7] + d[13]*d[ 6]*d[11]
				- d[ 5]*d[14]*d[11] - d[ 9]*d[ 6]*d[15] - d[13]*d[10]*d[ 7],
				+ d[ 4]*d[14]*d[11] + d[ 8]*d[ 6]*d[15] + d[12]*d[10]*d[ 7]
				- d[ 4]*d[10]*d[15] - d[ 8]*d[14]*d[ 7] - d[12]*d[ 6]*d[11],
				+ d[ 4]*d[ 9]*d[15] + d[ 8]*d[13]*d[ 7] + d[12]*d[ 5]*d[11]
				- d[ 4]*d[13]*d[11] - d[ 8]*d[ 5]*d[15] - d[12]*d[ 9]*d[ 7],
				+ d[ 4]*d[13]*d[10] + d[ 8]*d[ 5]*d[14] + d[12]*d[ 9]*d[ 6]
				- d[ 4]*d[ 9]*d[14] - d[ 8]*d[13]*d[ 6] - d[12]*d[ 5]*d[10],

				+ d[ 1]*d[14]*d[11] + d[ 9]*d[ 2]*d[15] + d[13]*d[10]*d[ 3]
				- d[ 1]*d[10]*d[15] - d[ 9]*d[14]*d[ 3] - d[13]*d[ 2]*d[11],
				+ d[ 0]*d[10]*d[15] + d[ 8]*d[14]*d[ 3] + d[12]*d[ 2]*d[11]
				- d[ 0]*d[14]*d[11] - d[ 8]*d[ 2]*d[15] - d[12]*d[10]*d[ 3],
				+ d[ 0]*d[13]*d[11] + d[ 8]*d[ 1]*d[15] + d[12]*d[ 9]*d[ 3]
				- d[ 0]*d[ 9]*d[15] - d[ 8]*d[13]*d[ 3] - d[12]*d[ 1]*d[11],
				+ d[ 0]*d[ 9]*d[14] + d[ 8]*d[13]*d[ 2] + d[12]*d[ 1]*d[10]
				- d[ 0]*d[13]*d[10] - d[ 8]*d[ 1]*d[14] - d[12]*d[ 9]*d[ 2],

				+ d[ 1]*d[ 6]*d[15] + d[ 5]*d[14]*d[ 3] + d[13]*d[ 2]*d[ 7]
				- d[ 1]*d[14]*d[ 7] - d[ 5]*d[ 2]*d[15] - d[13]*d[ 6]*d[ 3],
				+ d[ 0]*d[14]*d[ 7] + d[ 4]*d[ 2]*d[15] + d[12]*d[ 6]*d[ 3]
				- d[ 0]*d[ 6]*d[15] - d[ 4]*d[14]*d[ 3] - d[12]*d[ 2]*d[ 7],
				+ d[ 0]*d[ 5]*d[15] + d[ 4]*d[13]*d[ 3] + d[12]*d[ 1]*d[ 7]
				- d[ 0]*d[13]*d[ 7] - d[ 4]*d[ 1]*d[15] - d[ 8]*d[ 5]*d[ 3],
				+ d[ 0]*d[13]*d[ 6] + d[ 4]*d[ 1]*d[14] + d[12]*d[ 5]*d[ 2]
				- d[ 0]*d[ 5]*d[14] - d[ 4]*d[13]*d[ 2] - d[12]*d[ 1]*d[ 6],

				+ d[ 1]*d[10]*d[ 7] + d[ 5]*d[ 2]*d[11] + d[ 9]*d[ 6]*d[ 3]
				- d[ 1]*d[ 6]*d[11] - d[ 5]*d[10]*d[ 3] - d[ 9]*d[ 2]*d[ 7],
				+ d[ 0]*d[ 6]*d[11] + d[ 4]*d[10]*d[ 3] + d[ 8]*d[ 2]*d[ 7]
				- d[ 0]*d[10]*d[ 7] - d[ 4]*d[ 2]*d[11] - d[ 8]*d[ 6]*d[ 3],
				+ d[ 0]*d[ 9]*d[ 7] + d[ 4]*d[ 1]*d[11] + d[ 8]*d[ 5]*d[ 3]
				- d[ 0]*d[ 5]*d[11] - d[ 4]*d[ 9]*d[ 3] - d[ 8]*d[ 1]*d[ 7],
				+ d[ 0]*d[ 5]*d[10] + d[ 4]*d[ 9]*d[ 2] + d[ 8]*d[ 1]*d[ 6]
				- d[ 0]*d[ 9]*d[ 6] - d[ 4]*d[ 1]*d[10] - d[ 8]*d[ 5]*d[ 2],
			]).multScalar(1 / det);
		}

		static of(data) {
			return new Mat4().setRM(data);
		}

		static identity() {
			return Mat4.of([
				1, 0, 0, 0,
				0, 1, 0, 0,
				0, 0, 1, 0,
				0, 0, 0, 1,
			]);
		}

		static look(from, to, up) {
			const dz = to.sub(from).norm();
			const dx = up.cross(dz).norm();
			const dy = dz.cross(dx).norm();
			return (
				Mat4.identity()
				.translate(from.x, from.y, from.z)
				.mult(Mat4.of([
					dx.x, dx.y, dx.z, 0,
					dy.x, dy.y, dy.z, 0,
					dz.x, dz.y, dz.z, 0,
					0, 0, 0, 1,
				]))
			);
		}

		static lookObj(from, to, up) {
			const dz = to.sub(from).norm();
			const dx = up.cross(dz).norm();
			const dy = dz.cross(dx).norm();
			return Mat4.of([
				dx.x, dy.x, dz.x, from.x,
				dx.y, dy.y, dz.y, from.y,
				dx.z, dy.z, dz.z, from.z,
				0, 0, 0, 1,
			]);
		}

		static perspective(fovy, aspect, znear, zfar) {
			const scale = Math.tan(fovy);
			const x = 1 / (scale * aspect);
			const y = 1 / scale;
			const c = (zfar + znear) / (znear - zfar);
			const d = 2 * zfar * znear / (znear - zfar);
			return Mat4.of([
				x, 0, 0, 0,
				0, y, 0, 0,
				0, 0, c, d,
				0, 0, -1, 0,
			]);
		}
	}

	Mat4.Vec3 = Vec3;

	return Mat4;
});
