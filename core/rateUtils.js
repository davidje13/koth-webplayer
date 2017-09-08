define(() => {
	'use strict';

	return {
		throttle: (fn, delay = 20) => {
			let next = 0;
			let timeout = null;
			let latestArgs = [];
			const invoke = () => {
				timeout = null;
				fn.apply(this, latestArgs);
			};
			const wrapped = function() {
				const now = Date.now();
				latestArgs = Array.prototype.slice.call(arguments);
				if(timeout === null) {
					if(now > next) {
						invoke();
						next = now + delay;
					}
					timeout = setTimeout(invoke, next - now);
				}
			};
			wrapped.abort = () => {
				clearTimeout(timeout);
				timeout = null;
			};
			return wrapped;
		},

		debounce: (fn, delay = 20) => {
			let timeout = null;
			const wrapped = function() {
				if(timeout) {
					clearTimeout(timeout);
				}
				timeout = setTimeout(() => {
					timeout = null;
					fn.apply(this, arguments);
				}, delay);
			};
			wrapped.abort = () => {
				clearTimeout(timeout);
				timeout = null;
			};
			return wrapped;
		},
	};
});
