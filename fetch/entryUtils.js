define([
	'core/evalUtils',
	'core/workerUtils',
	'path:./loaderWorker',
], (
	evalUtils,
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
			codeBlocks: entry.codeBlocks.map(unescapeHTML),
			enabled: entry.enabled,
			pauseOnError: false,
		};
	}

	function stringifyCompileError(e, prefix = '') {
		if(typeof e !== 'object') {
			return prefix + String(e);
		}
		const location = (e.lineNumber || e.line || 'unknown line');
		if(e.message) {
			return prefix + e.message + ' @ ' + location;
		}
		return prefix + e.toString() + ' @ ' + location;
	}

	function stringifyEntryError(e, prefix = 'Threw ') {
		if(typeof e !== 'object') {
			return prefix + String(e);
		}
		if(e.stack) {
			const stack = e.stack;
			const m = stack.match(/:([0-9]+):([0-9]+)?/);
			if(m) {
				return (
					prefix + e.message +
					' (line ' + (m[1] - 1) + ' column ' + (m[2] || 0) + ')'
				);
			} else {
				return prefix + e.stack;
			}
		}
		if(e.message) {
			return prefix + e.message;
		}
		return prefix + e.toString();
	}

	const boilerplateBlock = `
		const self = undefined;
		const window = undefined;
		const require = undefined;
		const requireFactory = undefined;
		const define = undefined;
		const addEventListener = undefined;
		const removeEventListener = undefined;
		const postMessage = undefined;
		const Date = undefined;
		const performance = undefined;
	`;

	const consoleBuilderFn = ({consoleTarget, consoleLimit = 100, consoleItemLimit = 1024}) => {
		if(!consoleTarget) {
			return undefined;
		}

		const dolog = (type, values) => {
			consoleTarget.push({
				type,
				value: Array.prototype.map.call(values, (v) => {
					if(v && v.message) {
						return String(v.message);
					}
					try {
						return JSON.stringify(v);
					} catch(e) {
						return String(v);
					}
				}).join(' ').substr(0, consoleItemLimit),
			});
			if(consoleTarget.length > consoleLimit) {
				consoleTarget.shift();
			}
		};

		return {
			clear: () => {consoleTarget.length = 0;},
			info: function() {dolog('info', arguments);},
			log: function() {dolog('log', arguments);},
			warn: function() {dolog('warn', arguments);},
			error: function() {dolog('error', arguments);},
		};
	};

	function stripNewlines(code) {
		// All prelude is rendered on 1 line so that line numbers in
		// reported errors are easy to rectify
		return code.replace(/[\r\n]+\t*/gm, '');
	}

	function buildSandboxedFunction({code = '', paramNames = [], pre = ''}) {
		// Wrap code in function which blocks access to obviously dangerous
		// globals (this wrapping cannot be relied on as there may be other
		// ways to access global scope, but should prevent accidents - other
		// measures must be used to prevent malice)
		try {
			evalUtils.invoke(
				stripNewlines(`
					"use strict";
					self.tempFn = function(parameters, extras) {
						${boilerplateBlock}
						const console = (${consoleBuilderFn})(extras);
						${pre};
						extras = undefined;
						return (function ({${paramNames.join(',')}}) {
				`) + `\n${code}
						}).call(parameters['this'] || {}, parameters);
					};
				`
			);
			return self.tempFn;
		} finally {
			self.tempFn = null;
		}
	}

	function compile(code, parameters, {pre = ''} = {}) {
		let fn = null;
		let compileError = null;

		const begin = performance.now();
		try {
			fn = buildSandboxedFunction({code, paramNames: parameters, pre});
			fn = fn.bind({});
		} catch(e) {
			compileError = stringifyCompileError(e);
		}
		const compileTime = performance.now() - begin;

		return {fn, compileError, compileTime};
	}

	function load(site, qid, progressCallback) {
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
	}

	return {
		compile,
		stringifyEntryError,
		load,
	};
});
