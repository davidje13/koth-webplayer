define([
	'require',
	'./EventObject',
	'def:./EventObject',
	'def:./workerUtilsInner',
], (
	require,
	EventObject,
	defEventObject,
	defInner
) => {
	'use strict';

	// Usage: workerUtils.make(myFunction / myScriptName);
	// myFunction executes inside the worker
	// returns the new worker (addEventListener & sendMessage to communicate)

	function escape(v) {
		return JSON.stringify(v);
	}

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
		const depstr = escape(dependencies);
		if(fn && dependencies.length > 0) {
			invocation = '() => require(' + depstr + ', ' + fn.toString() + ')';
		} else if(fn) {
			invocation = fn.toString();
		} else {
			invocation = '() => require(' + depstr + ')';
		}

		const protocol = self.rootProtocol || window.location.protocol;
		const href = self.rootHref || window.location.href;

		/* globals requireFactory */
		const src = (
			'self.rootProtocol = ' + escape(protocol) + ';\n' +
			'self.rootHref = ' + escape(href) + ';\n' +
			'self.restrictedRequire = ' + escape(self.restrictedRequire || false) + ';\n' +
			'const requireFactory = ' + requireFactory.toString() + ';\n' +
			'requireFactory();\n' +
			defEventObject.code() + '\n' +
			defInner.code() + '\n' +
			'require([' + escape(defInner.src) + '])' +
			'.then(' + invocation + ')' +
			'.then(() => require.shed());\n'
		);

		const safari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

		let worker = null;
		if(safari && protocol === 'https:') {
			worker = new Worker(
				href.substr(0, href.lastIndexOf('/') + 1) +
				'core/workerUtilsLoader.js'
			);
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
		// (this also now ties in to the use of workerUtilsLoader)
		let ready = false;
		const queueOut = [];

		worker.addEventListener('message', (event) => {
			if(event.data && event.data.requireScriptPath !== undefined) {
				const modulePath = event.data.requireScriptPath;
				if(!modulePath) {
					blockRequire = true;
					return;
				}
				if(blockRequire) {
					throw new Error('Blocked late worker require() call: ' + modulePath);
				}
				require(['def:' + modulePath], (def) => {
					worker.postMessage({
						requireScriptPath: modulePath,
						requireScriptCode: def.code(),
					});
				});
				return;
			}
			if(!ready && event.data && event.data.workerReady) {
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
		worker.addEventListener = (type, listener, opts) => {
			if(type === 'message') {
				listeners.addEventListener('message', listener);
				if(queueIn.length > 0) {
					queueIn.forEach((message) => listeners.trigger('message', [message]));
					queueIn.length = 0;
				}
			} else {
				rawAddEventListener(type, listener, opts);
			}
		};

		const rawRemoveEventListener = worker.removeEventListener;
		worker.removeEventListener = (type, listener, opts) => {
			listeners.removeEventListener(type, listener);
			rawRemoveEventListener(type, listener, opts);
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
