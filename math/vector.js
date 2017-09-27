define(() => {
	'use strict';

	class V2 {
		constructor(x, y) {
			this.x = x;
			this.y = y;
		}

		add(v) {
			return new V2(
				this.x + v.x,
				this.y + v.y
			);
		}

		addMult(v, m) {
			return new V2(
				this.x + v.x * m,
				this.y + v.y * m
			);
		}

		sub(v) {
			return new V2(
				this.x - v.x,
				this.y - v.y
			);
		}

		mult(m) {
			return new V2(
				this.x * m,
				this.y * m
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

		distance(b) {
			return Math.sqrt(
				(this.x - b.x) * (this.x - b.x) +
				(this.y - b.y) * (this.y - b.y)
			);
		}

		norm(len = 1) {
			const m = len / this.length();
			return new V2(
				this.x * m,
				this.y * m
			);
		}
	}

	class V3 {
		constructor(x, y, z) {
			this.x = x;
			this.y = y;
			this.z = z;
		}

		add(v) {
			return new V3(
				this.x + v.x,
				this.y + v.y,
				this.z + v.z
			);
		}

		addMult(v, m) {
			return new V3(
				this.x + v.x * m,
				this.y + v.y * m,
				this.z + v.z * m
			);
		}

		sub(v) {
			return new V3(
				this.x - v.x,
				this.y - v.y,
				this.z - v.z
			);
		}

		mult(m) {
			return new V3(
				this.x * m,
				this.y * m,
				this.z * m
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
			return new V3(
				this.y * v.z - this.z * v.y,
				this.z * v.x - this.x * v.z,
				this.x * v.y - this.y * v.x
			);
		}

		length() {
			return Math.sqrt(this.dot(this));
		}

		distance(b) {
			return Math.sqrt(
				(this.x - b.x) * (this.x - b.x) +
				(this.y - b.y) * (this.y - b.y) +
				(this.z - b.z) * (this.z - b.z)
			);
		}

		norm(len = 1) {
			const m = len / this.length();
			return new V3(
				this.x * m,
				this.y * m,
				this.z * m
			);
		}
	}

	return {
		V2,
		V3,
	};
});
