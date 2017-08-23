const require_factory = () => {
	'use strict';

	const DEFINITION_PREFIX = 'def:';
	const ABSPATH_PREFIX = 'path:';

	class SharedPromise {
		constructor(promise) {
			this.state = 0;
			this.chained = [];
			this.v = null;

			const resolve = (v) => {
				this.v = v;
				this.state = 1;
				this.chained.forEach(({resolve}) => resolve(v));
			};

			const reject = (v) => {
				this.v = v;
				this.state = 2;
				this.chained.forEach(({reject}) => reject(v));
			};

			if(typeof promise === 'function') {
				promise(resolve, reject);
			} else {
				promise.then(resolve).catch(reject);
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

	const states = new Map();
	const loadedStyles = new Set();
	const hooks = {};
	let unnamedDef = null;
	let blocked = false;

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
			});
		}
		return state;
	}

	const KEY_DOCUMENT = stateOf('document');
	const KEY_REQUIRE = stateOf('require');

	if(self.window) {
		KEY_DOCUMENT.building = new SharedPromise((resolve, reject) => {
			window.addEventListener('load', () => {
				KEY_DOCUMENT.building = null;
				KEY_DOCUMENT.module = window.document;
				resolve(window.document);
			}, {once: true});
		});
	} else {
		KEY_DOCUMENT.building = SharedPromise.reject('DOM not available');
	}

	function loadFactory(src) {
		const state = stateOf(src);

		if(state.factory) {
			return Promise.resolve(src);
		}

		if(!state.loading) {
			const lastSlash = src.lastIndexOf('/');
			state.base = (lastSlash === -1) ? '' : src.substr(0, lastSlash);

			state.loading = new SharedPromise((resolve, reject) => {
				hooks.performLoad(src, () => {
					if(unnamedDef) {
						Object.assign(state, unnamedDef);
						unnamedDef = null;
					}
					if(!state.factory) {
						throw src + ' did not define a module!';
					}
					resolve(src);
				});
			});
		}

		return state.loading.promise();
	}

	function loadStyle(src) {
		if(loadedStyles.has(src)) {
			return Promise.resolve();
		}

		return new Promise((resolve, reject) => {
			loadedStyles.add(src);
			const link = document.createElement('link');
			link.setAttribute('rel', 'stylesheet');
			link.setAttribute('href', src);
			link.addEventListener('load', resolve, {once: true});
			document.getElementsByTagName('head')[0].appendChild(link);
		});
	}

	hooks.performLoad = (src, done) => {
		const script = document.createElement('script');
		script.setAttribute('src', src + '.js');
		script.addEventListener('load', done, {once: true});
		document.getElementsByTagName('head')[0].appendChild(script);
	};

	function wrapDefinition(src) {
		return {
			src,
			code: () => {
				const state = stateOf(src);
				return (
					'require.define(' +
					JSON.stringify(src) + ', ' +
					JSON.stringify(state.depends) + ', ' +
					state.factory.toString() +
					');'
				);
			},
		};
	};

	function resolvePath(base, src) {
		if(!src.startsWith('./') && !src.startsWith('../')) {
			return src;
		}
		if(!base && base !== '') {
			throw 'Relative path ' + src + ' used from unknown location';
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

	function requireOne(base, src) {
		if(blocked) {
			throw 'Attempted to require ' + src + ' after shedding privilege';
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
			return loadStyle(trueSrc);
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

	function require(sources, fn, base) {
		return Promise.all(sources.map(requireOne.bind(null, base))).then((deps) =>
			fn && fn.apply(null, deps));
	}

	require.replaceLoader = function(loader) {
		hooks.performLoad = loader;
	};

	require.define = function(src, depends, factory) {
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
			throw 'Multiple unnamed definitions in the same file';
		} else {
			unnamedDef = def;
		}
	};

	require.shed = function() {
		self.require = {define: require.define};
		self.require_factory = undefined;
		blocked = true;
	};

	KEY_REQUIRE.factory = require_factory;
	KEY_REQUIRE.module = require;

	self.require = require;
	self.define = require.define;

	return require;
};
require_factory();
