define([
	'core/workerUtils',
	'path:./loaderWorker',
], (
	workerUtils,
	pathLoaderWorker
) => {
	'use strict';

	/* jshint worker: true */

	function unescapeHTML(code) {
		// TODO: ideally would not require access to the DOM
		// Thanks, https://stackoverflow.com/a/7394787/1180785
		const o = window.document.createElement('textarea');
		o.innerHTML = code;
		return o.value;
	}

	function parseEntry(entry, index) {
		return {
			id: 'E' + index,
			answerID: entry.answerID,
			userName: entry.userName,
			userID: entry.userID,
			title: unescapeHTML(entry.title),
			code: unescapeHTML(entry.code),
			enabled: entry.enabled,
			pauseOnError: false,
		};
	}

	return {
		compile: (code, parameters, pre = '') => {
			// Wrap code in function which blocks access to obviously dangerous
			// globals (this wrapping cannot be relied on as there may be other
			// ways to access global scope, but should prevent accidents - other
			// measures must be used to prevent malice)
			const src = (
				// All prelude is rendered on 1 line so that line numbers in
				// reported errors are easy to rectify
				'"use strict";' +
				'self.tempFn = function(parameters, extras) {' +
					'const self = undefined;' +
					'const window = undefined;' +
					'const require = undefined;' +
					'const requireFactory = undefined;' +
					'const define = undefined;' +
					'const addEventListener = undefined;' +
					'const removeEventListener = undefined;' +
					'const postMessage = undefined;' +
					'const Date = undefined;' +
					'const performance = undefined;' +
					'const console = (extras.consoleTarget ?' +
					'((({consoleTarget, consoleLimit = 100, consoleItemLimit = 1024}) => {' +
						'const dolog = (type, values) => {' +
							'consoleTarget.push({' +
								'type,' +
								'value: Array.prototype.map.call(values, (v) => {' +
									'if(v && v.message) {' +
										'return String(v.message);' +
									'}' +
									'try {' +
										'return JSON.stringify(v);' +
									'} catch(e) {' +
										'return String(v);' +
									'}' +
								'}).join(" ").substr(0, consoleItemLimit),' +
							'});' +
							'if(consoleTarget.length > consoleLimit) {' +
								'consoleTarget.shift();' +
							'}' +
						'};' +
						'return {' +
							'clear: () => {consoleTarget.length = 0;},' +
							'info: function() {dolog("info", arguments);},' +
							'log: function() {dolog("log", arguments);},' +
							'warn: function() {dolog("warn", arguments);},' +
							'error: function() {dolog("error", arguments);},' +
						'};' +
					'})(extras)) : undefined);' +
					pre +
					'extras = undefined;' +
					'return (function({' + parameters.join(',') + '}) {\n' +
						code + '\n' +
					'}).call(parameters["this"] || {}, parameters);' +
				'};\n'
			);

			let fn = null;
			let compileError = null;

			const begin = performance.now();
			try {
				importScripts(URL.createObjectURL(new Blob(
					[src],
					{type: 'text/javascript'}
				)));
				fn = self.tempFn.bind({});
				self.tempFn = null;
			} catch(e) {
				// WORKAROUND (Safari): blobs inaccessible when run
				// from the filesystem, so fall-back to a nasty eval
				if(e.toString().includes('DOM Exception 19')) {
					try {
						/* jshint evil: true */
						eval(src);
						fn = self.tempFn.bind({});
						self.tempFn = null;
					} catch(e2) {
						compileError = e2.message || e2.toString();
					}
				} else {
					compileError = e.message || e.toString();
				}
			}
			const compileTime = performance.now() - begin;

			return {fn, compileError, compileTime};
		},

		stringifyEntryError: (e) => {
			if(typeof e !== 'object') {
				return 'Threw ' + String(e);
			}
			if(e.stack) {
				const stack = e.stack;
				const m = stack.match(/:([0-9]+):([0-9]+)?/);
				if(m) {
					return (
						'Threw ' + e.message +
						' (line ' + (m[1] - 1) + ' column ' + (m[2] || 0) + ')'
					);
				} else {
					return 'Threw ' + e.stack;
				}
			}
			if(e.message) {
				return 'Threw ' + e.message;
			}
			return 'Threw ' + e.toString();
		},

		load: (site, qid, progressCallback) => {
			const loaderWorker = workerUtils.make(pathLoaderWorker);

			return new Promise((resolve, reject) => {
				loaderWorker.addEventListener('message', (event) => {
					const data = event.data;
					if(data.error) {
						loaderWorker.terminate();
						reject(data.error);
						return;
					}
					if(!data.entries) {
						if(progressCallback) {
							progressCallback(data.loaded, data.total);
						}
						return;
					}
					loaderWorker.terminate();
					resolve(data.entries.map(parseEntry));
				});

				loaderWorker.postMessage({site, qid});
			});
		},
	};
});
