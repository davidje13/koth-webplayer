const requireFactory = () => {
	'use strict';

	const DEFINITION_PREFIX = 'def:';
	const ABSPATH_PREFIX = 'path:';

	const states = new Map();
	const hooks = {};
	let unnamedDef = null;
	let blocked = false;
	let require = null;

	hooks.performLoad = (src, done) => {
		const script = window.document.createElement('script');
		script.setAttribute('src', src + '.js');
		script.addEventListener('load', done, {once: true});
		window.document.getElementsByTagName('head')[0].appendChild(script);
	};

	class SharedPromise {
		constructor(promise) {
			this.state = 0;
			this.chained = [];
			this.v = null;

			const fullResolve = (v) => {
				this.v = v;
				this.state = 1;
				this.chained.forEach(({resolve}) => resolve(v));
			};

			const fullReject = (v) => {
				this.v = v;
				this.state = 2;
				this.chained.forEach(({reject}) => reject(v));
			};

			if(typeof promise === 'function') {
				promise(fullResolve, fullReject);
			} else {
				promise.then(fullResolve).catch(fullReject);
			}
		}

		promise() {
			return new Promise((resolve, reject) => {
				if(this.state === 1) {
					resolve(this.v);
				} else if(this.state === 2) {
					reject(this.v);
				} else {
					this.chained.push({resolve, reject});
				}
			});
		}

		static resolve(v) {
			return new SharedPromise(Promise.resolve(v));
		}

		static reject(v) {
			return new SharedPromise(Promise.reject(v));
		}
	}

	function augment(target, source) {
		for(let key in source) {
			if(source.hasOwnProperty(key)) {
				target[key] = source[key];
			}
		}
	}

	function stateOf(src) {
		let state = states.get(src);
		if(!state) {
			states.set(src, state = {
				loading: null,
				base: null,
				depends: [],
				factory: null,
				building: null,
				module: null,
				noFactoryCode: false,
			});
		}
		return state;
	}

	function getExports() {
		for(let key in self.exports) {
			if(self.exports.hasOwnProperty(key)) {
				return self.exports;
			}
		}
		return null;
	}

	function loadFactory(src) {
		const state = stateOf(src);

		if(state.factory || state.noFactoryCode) {
			return Promise.resolve(src);
		}

		if(!state.loading) {
			const lastSlash = src.lastIndexOf('/');
			state.base = (lastSlash === -1) ? '' : src.substr(0, lastSlash);

			state.loading = new SharedPromise((resolve) => {
				self.exports = {}; // Ensure no leakage
				hooks.performLoad(src, () => {
					if(unnamedDef) {
						Object.assign(state, unnamedDef);
						unnamedDef = null;
					}
					if(!state.factory) {
						const exports = getExports();
						if(exports) {
							/* globals console */
							console.warn(src + ' used exports; prefer define');
							state.factory = () => exports;
							state.noFactoryCode = true;
						} else {
							throw new Error(src + ' did not define a module!');
						}
					}
					self.exports = {};
					resolve(src);
				});
			});
		}

		return state.loading.promise();
	}

	function loadStyle(state, src) {
		if(state.module) {
			return Promise.resolve();
		}

		return new Promise((resolve) => {
			state.module = true;
			const link = window.document.createElement('link');
			link.setAttribute('rel', 'stylesheet');
			link.setAttribute('href', src);
			link.addEventListener('load', resolve, {once: true});
			window.document.getElementsByTagName('head')[0].appendChild(link);
		});
	}

	function stringifySingle(o, multiline) {
		// Reformat module requirements to better fit the originals for the
		// linter (keeps line numbers correct and prevents initial line being
		// too long)
		let r = JSON.stringify(o).replace(/'/g, '\\\'').replace(/"/g, '\'');
		if(multiline && r[0] === '[') {
			r = (r
				.replace(/^\[/, '[\n')
				.replace(/','/g, '\',\n\'')
				.replace(/\]$/, ',\n]')
			);
		}
		return r;
	}

	function wrapDefinition(src) {
		return {
			src,
			code: () => {
				const state = stateOf(src);
				if(state.noFactoryCode) {
					return null;
				}
				const content = state.factory.toString();
				return (
					'require.define(' +
					stringifySingle(src, false) + ', ' +
					stringifySingle(
						state.depends,
						content.startsWith('(\n')
					) + ', ' +
					content +
					');'
				);
			},
		};
	}

	function resolvePath(base, src) {
		if(!src.startsWith('./') && !src.startsWith('../')) {
			return src;
		}
		if(!base && base !== '') {
			throw new Error('Relative path ' + src + ' used from unknown location');
		}
		const path = (base + '/' + src).split('/');
		for(let i = 0; i < path.length;) {
			if(path[i] === '.' || path[i] === '') {
				path.splice(i, 1);
			} else if(path[i] === '..' && i > 0) {
				path.splice(i - 1, 2);
				-- i;
			} else {
				++ i;
			}
		}
		return path.join('/');
	}

	function applyDefinition(src) {
		const state = stateOf(src);
		if(state.module) {
			return Promise.resolve(state.module);
		}

		return require(state.depends, state.factory, state.base).then((o) => {
			state.building = null;
			state.module = o;
			return o;
		});
	}

	function requireOne(base, src) {
		if(blocked) {
			throw new Error('Attempted to require ' + src + ' after shedding privilege');
		}
		if(src.startsWith(DEFINITION_PREFIX)) {
			const trueSrc = resolvePath(base, src.substr(DEFINITION_PREFIX.length));
			return loadFactory(trueSrc).then(wrapDefinition);
		}
		if(src.startsWith(ABSPATH_PREFIX)) {
			const trueSrc = resolvePath(base, src.substr(ABSPATH_PREFIX.length));
			return Promise.resolve(trueSrc);
		}

		const trueSrc = resolvePath(base, src);
		const state = stateOf(trueSrc);

		if(trueSrc.endsWith('.css')) {
			return loadStyle(state, trueSrc);
		}

		if(state.module) {
			return Promise.resolve(state.module);
		}

		if(!state.building) {
			state.building = new SharedPromise(
				loadFactory(trueSrc).then(applyDefinition)
			);
		}

		return state.building.promise();
	}

	require = (sources, fn, base) => {
		return Promise.all(sources.map(requireOne.bind(null, base))).then((deps) =>
			fn && fn.apply(null, deps));
	};

	function define(src, depends, factory) {
		if(typeof src !== 'string') {
			factory = depends;
			depends = src;
			src = null;
		}
		if(typeof depends === 'function') {
			factory = depends;
			depends = [];
		}
		const def = {loading: null, depends, factory};
		if(src) {
			const lastSlash = src.lastIndexOf('/');
			const base = (lastSlash === -1) ? null : src.substr(0, lastSlash);
			Object.assign(stateOf(src), def, {base});
		} else if(unnamedDef) {
			throw new Error('Multiple unnamed definitions in the same file');
		} else {
			unnamedDef = def;
		}
	}

	// Disguise ourselves so that third-party libraries will integrate nicely
	// (we're a pretty close API anyway)
	define.amd = true;

	augment(require, {
		define,

		replaceLoader: (loader) => {
			hooks.performLoad = loader;
		},

		getAllPaths: () => {
			const paths = [];
			states.forEach((state, path) => {
				paths.push(path);
			});
			return paths;
		},

		shed: () => {
			self.require = {define};
			self.requireFactory = undefined;
			blocked = true;
		},
	});

	function loadBuiltins() {
		const KEY_DOCUMENT = stateOf('document');
		KEY_DOCUMENT.noFactoryCode = true;
		if(self.window) {
			KEY_DOCUMENT.building = new SharedPromise((resolve) => {
				window.addEventListener('load', () => {
					KEY_DOCUMENT.building = null;
					KEY_DOCUMENT.module = window.document;
					resolve(window.document);
				}, {once: true});
			});
		} else {
			KEY_DOCUMENT.building = SharedPromise.reject('DOM not available');
		}

		/* globals requireFactory */
		const KEY_REQUIRE = stateOf('require');
		KEY_REQUIRE.factory = requireFactory;
		KEY_REQUIRE.module = require;
	}

	loadBuiltins();

	self.require = require;
	self.define = define;
	self.exports = {};

	return require;
};
requireFactory();
