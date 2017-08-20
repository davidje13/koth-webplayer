define(['core/worker_utils', 'path:./loader_worker'], (worker_utils, loader_worker_path) => {
	'use strict';

	function unescapeHTML(code) {
		// TODO: ideally would not require access to the DOM
		// Thanks, https://stackoverflow.com/a/7394787/1180785
		const o = document.createElement('textarea');
		o.innerHTML = code;
		return o.value;
	};

	function parseEntry(entry, index) {
		return {
			id: 'E' + index,
			user_name: entry.user_name,
			user_id: entry.user_id,
			title: unescapeHTML(entry.title),
			code: unescapeHTML(entry.code),
		};
	}

	return {
		compile: (code, parameters) => {
			// Wrap code in function which blocks access to obviously dangerous
			// globals (this wrapping cannot be relied on as there may be other
			// ways to access global scope, but should prevent accidents - other
			// measures must be used to prevent malice)
			const src = (
				'self.tempFn = function(' + parameters.join(',') + ') {' +
				'"use strict";' +
				'const self = undefined;' +
				'const window = undefined;' +
				'const require = undefined;' +
				'const require_factory = undefined;' +
				'const define = undefined;' +
				'const addEventListener = undefined;' +
				'const removeEventListener = undefined;' +
				'const postMessage = undefined;' +
				'return ((() => {' + code + '})());' +
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
						eval(src);
						fn = self.tempFn.bind({});
						self.tempFn = null;
					} catch(e2) {
						compileError = e2.toString();
					}
				} else {
					compileError = e.toString();
				}
			}
			const compileTime = performance.now() - begin;

			return {fn, compileError, compileTime};
		},

		load: (site, qid, progressCallback) => {
			const loaderWorker = worker_utils.make(loader_worker_path);

			return new Promise((resolve, reject) => {
				loaderWorker.addEventListener('message', (event) => {
					const data = event.data;
					if(!data.entries) {
						progressCallback && progressCallback(data.loaded, data.total);
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
