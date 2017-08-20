// Usage: sandbox_utils.make(myFunction / myScriptName);
// myFunction executes inside the sandbox
// Returns a worker-like object which permits communication
// (addEventListener & sendMessage), and destruction (terminate)

define(['require', 'document', './EventObject', 'def:./EventObject', 'def:./sandbox_utils_inner'], (require, document, EventObject, EventObject_def, inner_def) => {
	'use strict';

	const STATE_LOADING = 0;
	const STATE_READY = 1;
	const STATE_KILLED = 2;

	const B64 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_';
	function makeNonce() {
		const buffer = new Uint8Array(16);
		crypto.getRandomValues(buffer);
		let r = '';
		for(let i = 0; i < buffer.length; ++ i) {
			r += B64[buffer[i] % 64];
		}
		return r;
	}

	class IFrame extends EventObject {
		constructor(postMessageFn, terminateFn) {
			super();
			this.postMessageFn = postMessageFn;
			this.terminateFn = terminateFn;
		}

		postMessage(message) {
			this.postMessageFn(message);
		}

		terminate() {
			this.terminateFn();
		}
	};

	function make(dependencies, fn) {
		if(typeof dependencies === 'function') {
			fn = dependencies;
			dependencies = [];
		}
		if(typeof dependencies === 'string') {
			dependencies = [dependencies];
		}

		// Thanks, https://stackoverflow.com/a/23522755/1180785
		const safari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

		// WORKAROUNDS:
		// * Chrome doesn't allow relaxing script-src inside an iframe, so we
		//   have to use blob: to load all scripts from outside (we can also
		//   use this to eval competitor code where needed)
		// * Safari considers blob: to be a non-https resource, so blocks it,
		//   but it does allow relaxing script-src. So we allow content from
		//   our detected domain and also allow unsafe-eval for competitor code
		const protocol = self.rootProtocol || window.location.protocol;
		const href = self.rootHref || window.location.href;
		const needUnsafeEval = safari;
		let remoteDomain = 'blob:';
		let blockRequire = false;
		if(safari && protocol !== 'file:') {
			const p = href.indexOf('/', href.indexOf('//') + 2);
			remoteDomain = (p !== -1) ? href.substr(0, p) : href;
			blockRequire = true;
		}

		// WORKAROUND (Safari): web workers are totally unusable in non-origin
		// environments since they block blob URLs and all non-self URLs. So
		// for Safari we have to sacrafice some more security thanks to their
		// insistence on security.
		const needsSameOrigin = (safari && protocol === 'https:');

		const iframe = document.createElement('iframe');
		let state = STATE_LOADING;
		const queueIn = [];

		const postMessage = (message) => {
			if(state === STATE_READY) {
				iframe.contentWindow.postMessage(message, '*');
			} else {
				queueIn.push(message);
			}
		}

		const terminate = () => {
			state = STATE_KILLED;
			if(iframe && iframe.parentNode) {
				iframe.parentNode.removeChild(iframe);
				window.removeEventListener('message', messageListener);
			}
		}

		const o = new IFrame(postMessage, terminate);

		function handleScriptRequest(event) {
			const src = event.data.require_script_src;
			if(!src) {
				blockRequire = true;
				return;
			}
			if(blockRequire) {
				throw 'Blocked late sandbox require() call: ' + src;
			}
			require(['def:' + src], (def) => {
				postMessage({
					require_script_src: src,
					require_script_blob: def.code(),
				});
			});
		}

		function messageListener(event) {
			if(
				event.origin !== (needsSameOrigin ? remoteDomain : 'null') ||
				event.source !== iframe.contentWindow
			) {
				return;
			}
			if(event.data && event.data.require_script_src !== undefined) {
				return handleScriptRequest(event);
			}
			o.trigger('message', [event]);
		}

		let invocation;
		if(fn && dependencies.length > 0) {
			invocation = '() => require(' + JSON.stringify(dependencies) + ', ' + fn.toString() + ')';
		} else if(fn) {
			invocation = fn.toString();
		} else {
			invocation = '() => require(' + JSON.stringify(dependencies) + ')';
		}

		const src = (
			'self.rootProtocol = ' + JSON.stringify(protocol) + ';\n' +
			'self.rootHref = ' + JSON.stringify(href) + ';\n' +
			'self.restrictedScriptSrc = ' + JSON.stringify(!blockRequire) + ';\n' +
			'const require_factory = ' + require_factory.toString() + ';\n' +
			'require_factory();\n' +
			EventObject_def.code() + '\n' +
			inner_def.code() + '\n' +
			'require([' + JSON.stringify(inner_def.src) + '])' +
			'.then(' + invocation + ');\n'
		);

		const nonce = makeNonce();

		const html = (
			'<html>\n' +
			'<head>\n' +
			'<meta charset="utf-8">\n' +
			'<meta http-equiv="content-security-policy" content="' +
			"script-src 'nonce-" + nonce + "' " + remoteDomain +
			(needUnsafeEval ? " 'unsafe-eval'" : '') + ";" +
			"style-src 'none';" +
			'">\n' +
			'<script nonce="' + nonce + '">' + src + '</script>\n' +
			'</head>\n' +
			'<body>\n' +
			'</body>\n' +
			'</html>\n'
		);

		iframe.setAttribute(
			'sandbox',
			'allow-scripts' +
			(needsSameOrigin ? ' allow-same-origin' : '')
		);
		iframe.style.display = 'none';
		iframe.setAttribute('src', URL.createObjectURL(new Blob(
			[html],
			{type: 'text/html'}
		)));

		iframe.addEventListener('error', (event) => {
			o.trigger('error', [event]);
		});

		iframe.addEventListener('load', () => {
			if(state === STATE_KILLED) {
				return;
			}
			state = STATE_READY;
			postMessage({sandbox_connected: true});
			queueIn.forEach(postMessage);
			queueIn.length = 0;
		}, {once: true});

		window.addEventListener('message', messageListener, {
			_no_sandbox_intercept: true,
		});

		document.body.appendChild(iframe);

		return o;
	}

	return {
		make,
	};
});
