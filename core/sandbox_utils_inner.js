define(['require', 'document', './EventObject'], (require, document, EventObject) => {
	'use strict';

	const awaiting = new Map();

	function handleScript(event) {
		const src = event.data.require_script_src;
		const done = awaiting.get(src);
		if(!done) {
			return;
		}
		const safari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
		const script = document.createElement('script');
		if(safari && (window.rootProtocol || window.location.protocol) === 'https:') {
			// WORKAROUND: Safari considers blobs to be non-https, so blocks
			// them. No idea why, so we load directly instead (but due to
			// disallowing same-origin for the frame, we have to rely on
			// allowing *any* https request - see sandbox_utils.
			script.setAttribute('src', src + '.js');
		} else {
			script.setAttribute('src', URL.createObjectURL(new Blob(
				[event.data.require_script_blob],
				{type: 'text/javascript'}
			)));
		}
		script.addEventListener('load', () => {
			awaiting.delete(src);
			done();
		}, {once: true});
		document.getElementsByTagName('head')[0].appendChild(script);
	}

	let parent = null;
	const queueIn = [];
	const queueOut = [];

	const listeners = new EventObject();

	window.addEventListener('message', (event) => {
		if(parent === null && event.source) {
			parent = event.source;
			for(let i = 0; i < queueOut.length; ++ i) {
				self.postMessage(queueOut[i]);
			}
			queueOut.length = 0;
		}
		if(event.source !== parent) {
			return;
		}
		if(event.data && event.data.sandbox_connected) {
			return;
		}
		if(event.data && event.data.require_script_blob) {
			return handleScript(event);
		}
		if(listeners.countEventListeners('message') > 0) {
			listeners.trigger('message', [event]);
		} else {
			queueIn.push(event);
		}
	});

	const rawAddEventListener = self.addEventListener;
	self.addEventListener = (type, fn, opts) => {
		if(opts && opts._no_sandbox_intercept) {
			rawAddEventListener(type, fn, opts);
		} else if(type === 'message') {
			listeners.addEventListener(type, fn);
			if(queueIn.length > 0) {
				queueIn.forEach((message) => listeners.trigger('message', [message]));
				queueIn.length = 0;
			}
		} else {
			rawAddEventListener(type, fn, opts);
		}
	};

	const rawRemoveEventListener = self.removeEventListener;
	self.removeEventListener = (type, fn, opts) => {
		listeners.removeEventListener(type, fn);
		rawRemoveEventListener(type, fn, opts);
	};

	const rawPostMessage = self.postMessage;
	self.postMessage = (message, origin) => {
		if(origin) {
			return rawPostMessage(message, origin);
		}
		if(parent) {
			parent.postMessage(message, '*');
		} else {
			queueOut.push(message);
		}
	};

	require.replaceLoader((src, done) => {
		awaiting.set(src, done);
		self.postMessage({require_script_src: src});
	});

	const originalShed = require.shed;
	require.shed = () => {
		self.postMessage({require_script_src: null});
		originalShed();
	};
});
