// Usage: worker_utils.make(myFunction / myScriptName);
// myFunction executes inside the worker
// returns the new worker (addEventListener & sendMessage to communicate)

define(['require', './EventObject', 'def:./EventObject', 'def:./worker_utils_inner'], (require, EventObject, EventObject_def, inner_def) => {
	'use strict';

	function make(fn) {
		const queueIn = [];
		const listeners = new EventObject();

		let invocation;
		if(typeof fn === 'function') {
			invocation = fn.toString();
		} else {
			invocation = '() => require([' + JSON.stringify(fn) + '])';
		}

		const src = (
			'const require_factory = ' + require_factory.toString() + ';\n' +
			'require_factory();\n' +
			EventObject_def.code() + '\n' +
			inner_def.code() + '\n' +
			'require([' + JSON.stringify(inner_def.src) + '])' +
			'.then(' + invocation + ')' +
			'.then(() => require.shed());\n'
		);

		const worker = new Worker(URL.createObjectURL(new Blob(
			[src],
			{type: 'text/javascript'}
		)));

		let blockRequire = false;

		// WORKAROUND: Some browsers don't queue messages properly, so we have
		// to queue them ourselves until the worker declares itself ready
		let ready = false;
		const queueOut = [];

		worker.addEventListener('message', () => {
			if(event.data && event.data.require_script_src !== undefined) {
				const src = event.data.require_script_src;
				if(!src) {
					blockRequire = true;
					return;
				}
				if(blockRequire) {
					throw 'Blocked late worker require() call: ' + src;
				}
				require(['def:' + src], (def) => {
					worker.postMessage({
						require_script_src: src,
						require_script_blob: def.code(),
					});
				});
				return;
			}
			if(!ready && event.data && event.data.worker_ready) {
				ready = true;
				queueOut.forEach((message) => worker.postMessage(message));
				queueOut.length = 0;
				return;
			}
			if(listeners.countEventListeners('message') > 0) {
				listeners.trigger('message', [event]);
			} else {
				queueIn.push(event);
			}
		});

		const rawAddEventListener = worker.addEventListener;
		worker.addEventListener = (type, fn, opts) => {
			if(type === 'message') {
				listeners.addEventListener('message', fn);
				if(queueIn.length > 0) {
					queueIn.forEach((message) => listeners.trigger('message', [message]));
					queueIn.length = 0;
				}
			} else {
				rawAddEventListener(type, fn, opts);
			}
		};

		const rawRemoveEventListener = worker.removeEventListener;
		worker.removeEventListener = (type, fn, opts) => {
			listeners.removeEventListener(type, fn);
			rawRemoveEventListener(type, fn, opts);
		};

		// WORKAROUND (see 'ready' notes above for details)
		const rawPostMessage = worker.postMessage.bind(worker);
		worker.postMessage = (message) => {
			if(ready) {
				rawPostMessage(message);
			} else {
				queueOut.push(message);
			}
		};

		return worker;
	}

	return {
		make,
	};
});
