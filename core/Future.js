define(() => {
	'use strict';

	return class Future {
		constructor() {
			this.state = 0;
			this.v = null;
			this.captured = null;
			this.p = new Promise((resolve, reject) => {
				if(this.state === 1) {
					resolve(self.v);
				} else if(this.state === 2) {
					reject(self.v);
				} else {
					self.captured = {resolve, reject};
				}
			});
		}

		promise() {
			return this.p;
		}

		resolve(v) {
			if(this.captured) {
				this.captured.resolve(v);
			} else {
				this.state = 1;
				this.v = v;
			}
		}

		reject(v) {
			if(this.captured) {
				this.captured.reject(v);
			} else {
				this.state = 2;
				this.v = v;
			}
		}
	}
});
