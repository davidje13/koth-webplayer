define(['./worker_utils'], (worker_utils) => {
	'use strict';

	describe('make', () => {
		itAsynchronously('runs the given code in a web worker thread', (done) => {
			const thread = worker_utils.make(() => {
				self.addEventListener('message', (o) => {
					self.postMessage(o.data + '-processed');
				});
			});
			thread.addEventListener('message', (o) => {
				expect(o.data, equals('input-processed'));
				done();
			});
			thread.postMessage('input');
		});

		itAsynchronously('loads the requested dependencies', (done) => {
			const thread = worker_utils.make(['core/array_utils'], (array_utils) => {
				self.addEventListener('message', (o) => {
					self.postMessage(array_utils.makeList(o.data.length, o.data.content));
				});
			});
			thread.addEventListener('message', (o) => {
				expect(o.data.length, equals(2));
				done();
			});
			thread.postMessage({length: 2, content: 'a'});
		});

		itAsynchronously('blocks post-initialisation requests for more dependencies', (done) => {
			const thread = worker_utils.make(() => {
				const capturedRequire = self.require;
				self.addEventListener('message', (o) => {
					if(typeof self.require === 'function') {
						self.postMessage('self.require was not removed');
						return;
					}
					try {
						capturedRequire(['core/array_utils'], (array_utils) => {
							self.postMessage('require call was not blocked');
						});
					} catch(e) {
						self.postMessage('success');
					}
				});
			});
			thread.addEventListener('message', (o) => {
				if(o.data !== 'success') {
					fail(o.data);
				}
				done();
			});
			setTimeout(() => { // WORKAROUND (Safari)
				thread.postMessage();
			}, 100);
		});
	});
});
