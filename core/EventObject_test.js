define(['./EventObject'], (EventObject) => {
	'use strict';

	describe('trigger', () => {
		it('invokes registered listeners', () => {
			const o = new EventObject();
			let triggered = 0;
			o.addEventListener('foo', () => {
				++ triggered;
			});

			o.trigger('foo');

			expect(triggered, equals(1));
		});

		it('invokes with the given parameters', () => {
			const o = new EventObject();
			let capturedParam1 = null;
			let capturedParam2 = null;
			o.addEventListener('foo', (param1, param2) => {
				capturedParam1 = param1;
				capturedParam2 = param2;
			});

			o.trigger('foo', ['a', 'b']);

			expect(capturedParam1, equals('a'));
			expect(capturedParam2, equals('b'));
		});

		it('only invokes relevant callbacks', () => {
			const o = new EventObject();
			let triggered = 0;
			o.addEventListener('foo', () => {
				++ triggered;
			});

			o.trigger('bar');

			expect(triggered, equals(0));
		});

		it('forwards to registered objects', () => {
			const o = new EventObject();
			let capturedType = null;
			o.addEventForwarding({trigger: (type) => {
				capturedType = type;
			}});

			o.trigger('bar');

			expect(capturedType, equals('bar'));
		});

		it('forwards with the given parameters', () => {
			const o = new EventObject();
			let capturedParams = null;
			o.addEventForwarding({trigger: (type, params) => {
				capturedParams = params;
			}});

			o.trigger('bar', ['a', 'b']);

			expect(capturedParams[0], equals('a'));
			expect(capturedParams[1], equals('b'));
		});
	});

	describe('countEventListeners', () => {
		it('returns the number of event listeners of a given type', () => {
			const o = new EventObject();
			o.addEventListener('foo', () => {});
			o.addEventListener('foo', () => {});
			expect(o.countEventListeners('foo'), equals(2));
		});

		it('does not count unrequested types', () => {
			const o = new EventObject();
			o.addEventListener('foo', () => {});
			o.addEventListener('foo', () => {});
			o.addEventListener('bar', () => {});
			expect(o.countEventListeners('bar'), equals(1));
		});

		it('returns 0 for events which have no listeners', () => {
			const o = new EventObject();
			expect(o.countEventListeners('foo'), equals(0));
		});
	});

	describe('removeEventListener', () => {
		it('removes the requested listener', () => {
			const o = new EventObject();
			let triggered = 0;
			const fn = () => {
				++ triggered;
			};

			o.addEventListener('foo', fn);
			o.trigger('foo');
			expect(triggered, equals(1));

			triggered = 0;
			o.removeEventListener('foo', fn);
			o.trigger('foo');
			expect(triggered, equals(0));
		});

		it('leaves other listeners', () => {
			const o = new EventObject();
			let triggered = 0;
			const fn1 = () => {
			};
			const fn2 = () => {
				++ triggered;
			};

			o.addEventListener('foo', fn1);
			o.addEventListener('foo', fn2);
			o.removeEventListener('foo', fn1);
			o.trigger('foo');
			expect(triggered, equals(1));
		});

		it('leaves other listener types', () => {
			const o = new EventObject();
			let triggered = 0;
			const fn = () => {
				++ triggered;
			};

			o.addEventListener('foo', fn);
			o.addEventListener('bar', fn);
			o.removeEventListener('foo', fn);
			o.trigger('bar');
			expect(triggered, equals(1));
		});

		it('silently ignores non-existent listeners', () => {
			const o = new EventObject();
			o.removeEventListener('foo', () => {});
		});
	});

	describe('removeAllEventListeners', () => {
		it('removes all listeners for the requested type', () => {
			const o = new EventObject();
			let triggered = 0;
			const fn = () => {
				++ triggered;
			};

			o.addEventListener('foo', fn);
			o.trigger('foo');
			expect(triggered, equals(1));

			triggered = 0;
			o.removeAllEventListeners('foo');
			o.trigger('foo');
			expect(triggered, equals(0));
		});

		it('leaves other listener types', () => {
			const o = new EventObject();
			let triggered = 0;
			const fn = () => {
				++ triggered;
			};

			o.addEventListener('foo', fn);
			o.addEventListener('bar', fn);
			o.removeAllEventListeners('foo');
			o.trigger('bar');
			expect(triggered, equals(1));
		});

		it('silently ignores non-existent types', () => {
			const o = new EventObject();
			o.removeAllEventListeners('foo');
		});

		it('removes all listener types when given no argument', () => {
			const o = new EventObject();
			let triggered = 0;
			const fn = () => {
				++ triggered;
			};

			o.addEventListener('foo', fn);
			o.addEventListener('bar', fn);
			o.removeAllEventListeners();
			o.trigger('foo');
			o.trigger('bar');
			expect(triggered, equals(0));
		});
	});
});
