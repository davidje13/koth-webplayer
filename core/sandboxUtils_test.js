define(['./sandboxUtils'], (sandboxUtils) => {
	'use strict';

	describe('make', () => {
		itAsynchronously('runs the given code in an iframe', (done) => {
			const sandboxed = sandboxUtils.make(() => {
				self.addEventListener('message', (o) => {
					self.postMessage(o.data + '-processed');
				});
			});
			sandboxed.addEventListener('message', (o) => {
				expect(o.data, equals('input-processed'));
				done();
			});
			sandboxed.postMessage('input');
		});

		itAsynchronously('sandboxes the iframe', (done) => {
			// Can't find any programatic way to verify this; the best seems to
			// be to detect whether an alert() is displayed or not (by counting
			// the elapsed time - alert() is blocking), but Safari doesn't
			// support alert-blocking in sandboxed frames yet...
			done();
		});

		itAsynchronously('loads the requested dependencies', (done) => {
			const sandboxed = sandboxUtils.make(['core/arrayUtils'], (arrayUtils) => {
				self.addEventListener('message', (o) => {
					self.postMessage(arrayUtils.makeList(o.data.length, o.data.content));
				});
			});
			sandboxed.addEventListener('message', (o) => {
				expect(o.data.length, equals(2));
				done();
			});
			sandboxed.postMessage({length: 2, content: 'a'});
		});
	});
});
