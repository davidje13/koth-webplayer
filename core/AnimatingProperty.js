define(() => {
	'use strict';

	return class AnimatingProperty {
		constructor(callback, value, animationTime = 1000) {
			this.value = value;
			this.target = value;
			this.callback = callback;
			this.animFrame = null;
			this.lastFrame = 0;
			this.animationTime = animationTime;

			this._animate = this._animate.bind(this);
		}

		_animate() {
			this.animFrame = null;
			const now = Date.now();
			const delta = now - this.lastFrame;
			this.lastFrame = now;

			let complete = false;
			if(this.value < this.target) {
				this.value += delta / this.animationTime;
				if(this.value >= this.target) {
					complete = true;
				}
			} else {
				this.value -= delta / this.animationTime;
				if(this.value <= this.target) {
					complete = true;
				}
			}
			if(complete) {
				this.value = this.target;
				if(this.callback) {
					this.callback(this.value, false);
				}
			} else {
				this.animFrame = requestAnimationFrame(this._animate);
				if(this.callback) {
					this.callback(this.value, true);
				}
			}
		}

		getValue() {
			return this.value;
		}

		getTarget() {
			return this.target;
		}

		isAnimating() {
			return Boolean(this.animFrame);
		}

		set(target, {animated = true} = {}) {
			if(this.target === target) {
				return;
			}
			this.target = target;
			if(animated) {
				if(!this.animFrame) {
					this.lastFrame = Date.now();
					this.animFrame = requestAnimationFrame(this._animate);
				}
			} else {
				if(this.animFrame) {
					cancelAnimationFrame(this.animFrame);
					this.animFrame = null;
				}
				this.value = this.target;
				if(this.callback) {
					this.callback(this.value, false);
				}
			}
		}
	};
});
