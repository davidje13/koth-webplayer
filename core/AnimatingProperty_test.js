define(['./AnimatingProperty'], (AnimatingProperty) => {
	'use strict';

	describe('set', () => {
		itAsynchronously('updates its value to the given value', (done) => {
			const prop = new AnimatingProperty(null, 0, 100);

			prop.set(1);

			expect(prop.getValue(), not(equals(1)));
			expect(prop.getTarget(), equals(1));

			setTimeout(() => {
				expect(prop.getValue(), equals(1));
				done();
			}, 120);
		});

		itAsynchronously('invokes the given callback each frame', (done) => {
			let args = [];
			const callback = (value, animating) => {
				args.push({value, animating});
			};
			const prop = new AnimatingProperty(callback, 0, 100);

			prop.set(1);

			setTimeout(() => {
				expect(args.length, isGreaterThan(2));
				expect(args[0].value, isLowerThan(args[1].value));
				expect(args[0].animating, equals(true));
				expect(args[args.length - 1].animating, equals(false));
				done();
			}, 120);
		});

		it('updates its value to the given value instantly if requested', () => {
			const prop = new AnimatingProperty(null, 0, 100);

			prop.set(1, {animated: false});

			expect(prop.getValue(), equals(1));
			expect(prop.getTarget(), equals(1));
		});
	});
});
