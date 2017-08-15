// xorshift+ 64-bit random generator
// https://en.wikipedia.org/wiki/Xorshift

define(() => {
	'use strict';

	const B64 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_';

	function read64(s) {
		var r = 0;
		for(let i = 0; i < s.length; ++ i) {
			r = (r * 64) + B64.indexOf(s.substr(i, 1));
		}
		return r;
	}

	function make64(v, l) {
		var r = '';
		var x = v;
		for(let i = 0; i < l; ++ i) {
			r = B64[x % 64] + r;
			x = (x / 64)|0;
		}
		return r;
	}

	return class Random {
		constructor(seed) {
			this.s = new Uint32Array(4);
			this.seed(seed);
		}

		seed(seed) {
			if((typeof seed) !== 'string') {
				seed = seed.toString();
			} else {
				seed = seed.substr(1); // trim identifier letter
			}
			for(let i = 0; i < 4; ++ i) {
				this.s[i] = read64(seed.substr(i * 6, 6));
			}
		}

		next(range = 0x100000000) {
			let x0 = this.s[0];
			let x1 = this.s[1];
			const y0 = this.s[2];
			const y1 = this.s[3];
			this.s[0] = y0;
			this.s[1] = y1;
			x0 ^= (x0 << 23) | (x1 >>> 9);
			x1 ^= (x1 << 23);
			this.s[2] = x0 ^ y0 ^ (x0 >>> 17) ^ (y0 >>> 26);
			this.s[3] = x1 ^ y1 ^ (x0 << 15 | x1 >>> 17) ^ (y0 << 6 | y1 >>> 26);
			return ((this.s[3] + y1) >>> 0) % range;
		}

		makeRandomSeed(prefix = 'X') {
			let s = prefix;
			for(let i = 0; i < 4; ++ i) {
				s += make64(this.next(0x100000000), 6);
			}
			return s;
		}

		static makeRandomSeed(prefix = 'X') {
			const buffer = new Uint32Array(4);
			crypto.getRandomValues(buffer);
			let s = prefix;
			for(let i = 0; i < 4; ++ i) {
				s += make64(buffer[i], 6);
			}
			return s;
		}
	}
});
