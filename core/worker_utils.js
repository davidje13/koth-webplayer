// Usage: worker_utils.make(myFunction / myScriptName);
// myFunction executes inside the worker
// returns the new worker (addEventListener & sendMessage to communicate)

define(['require', './EventObject', 'def:./EventObject', 'def:./worker_utils_inner'], (require, EventObject, EventObject_def, inner_def) => {
	'use strict';

	function make(dependencies, fn) {
		if(typeof dependencies === 'function') {
			fn = dependencies;
			dependencies = [];
		}
		if(typeof dependencies === 'string') {
			dependencies = [dependencies];
		}

		const queueIn = [];
		const listeners = new EventObject();

		let invocation;
		if(fn && dependencies.length > 0) {
			invocation = '() => require(' + JSON.stringify(dependencies) + ', ' + fn.toString() + ')';
		} else if(fn) {
			invocation = fn.toString();
		} else {
			invocation = '() => require(' + JSON.stringify(dependencies) + ')';
		}

		const protocol = self.rootProtocol || window.location.protocol;
		const href = self.rootHref || window.location.href;

		const src = (
			'self.rootProtocol = ' + JSON.stringify(protocol) + ';\n' +
			'self.rootHref = ' + JSON.stringify(href) + ';\n' +
			'self.restrictedScriptSrc = ' + JSON.stringify(self.restrictedScriptSrc || false) + ';\n' +
			'const require_factory = ' + require_factory.toString() + ';\n' +
			'require_factory();\n' +
			EventObject_def.code() + '\n' +
			inner_def.code() + '\n' +
			'require([' + JSON.stringify(inner_def.src) + '])' +
			'.then(' + invocation + ')' +
			'.then(() => require.shed());\n'
		);

		const safari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

		let worker = null;
		if(safari && protocol === 'https:') {
			worker = new Worker(href.substr(0, href.lastIndexOf('/') + 1) + 'core/worker_utils_loader.js');
			worker.postMessage({src});
		} else {
			worker = new Worker(URL.createObjectURL(new Blob(
				[src],
				{type: 'text/javascript'}
			)));
		}

		let blockRequire = false;

		// WORKAROUND (Safari): messages aren't queued properly, so we have
		// to queue them ourselves until the worker declares itself ready
		// (this also now ties in to the use of worker_utils_loader)
		let ready = false;
		const queueOut = [];

		worker.addEventListener('message', (event) => {
			if(event.data && event.data.require_script_src !== undefined) {
				const src = event.data.require_script_src;
				if(!src) {
					blockRequire = true;
					return;
				}
				if(blockRequire) {
					throw new Error('Blocked late worker require() call: ' + src);
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
