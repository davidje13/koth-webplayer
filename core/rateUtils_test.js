define(['./rateUtils'], (rateUtils) => {
	'use strict';

	describe('throttle', () => {
		it('calls the throttled function immediately on the first call', () => {
			let called = 0;
			const func = () => {
				++ called;
			};
			const throttled = rateUtils.throttle(func);
			throttled();
			expect(called, equals(1));
		});

		itAsynchronously('waits before making a second call', (done) => {
			let called = 0;
			const func = () => {
				++ called;
			};
			const throttled = rateUtils.throttle(func, 10);
			throttled();
			throttled();
			expect(called, equals(1));
			setTimeout(() => {
				expect(called, equals(2));
				done();
			}, 20);
		});

		itAsynchronously('combines calls made while waiting', (done) => {
			let called = 0;
			const func = () => {
				++ called;
			};
			const throttled = rateUtils.throttle(func, 10);
			throttled();
			throttled();
			throttled();
			expect(called, equals(1));
			setTimeout(() => {
				expect(called, equals(2));
				done();
			}, 20);
		});

		itAsynchronously('invokes the function with the latest arguments', (done) => {
			let latestArgs = [];
			const func = (a, b) => {
				latestArgs = [a, b];
			};
			const throttled = rateUtils.throttle(func, 10);
			throttled(1, 2);
			throttled(3, 4);
			throttled(5, 6);
			expect(latestArgs[0], equals(1));
			expect(latestArgs[1], equals(2));
			setTimeout(() => {
				expect(latestArgs[0], equals(5));
				expect(latestArgs[1], equals(6));
				done();
			}, 20);
		});
	});

	describe('debounce', () => {
		itAsynchronously('waits before making any call', (done) => {
			let called = 0;
			const func = () => {
				++ called;
			};
			const debounced = rateUtils.debounce(func, 10);
			debounced();
			expect(called, equals(0));
			setTimeout(() => {
				expect(called, equals(1));
				done();
			}, 20);
		});

		itAsynchronously('combines calls made while waiting', (done) => {
			let called = 0;
			const func = () => {
				++ called;
			};
			const debounced = rateUtils.debounce(func, 10);
			debounced();
			debounced();
			expect(called, equals(0));
			setTimeout(() => {
				expect(called, equals(1));
				done();
			}, 20);
		});

		itAsynchronously('invokes the function with the latest arguments', (done) => {
			let latestArgs = [];
			const func = (a, b) => {
				latestArgs = [a, b];
			};
			const debounced = rateUtils.debounce(func, 10);
			debounced(1, 2);
			debounced(3, 4);
			setTimeout(() => {
				expect(latestArgs[0], equals(3));
				expect(latestArgs[1], equals(4));
				done();
			}, 20);
		});
	});
});
