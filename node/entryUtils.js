define([
	'isolated-vm',
	'node/isolateMarshaller',
	'node/nodeUtils',
], (
	ivm,
	isolateMarshaller,
	nodeUtils
) => {
	'use strict';
	/* globals global, console */

	let knownEnvs = new Set();

	function disposeEnvs() {
		for (let env of knownEnvs) {
			knownEnvs.delete(env);
			if (!env.isDisposed) {
				env.dispose();
			}
		}
		global.gc();
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

	function findCandidates(code, varExpr) {
		if(varExpr.indexOf('*') === -1) {
			return new Set([varExpr]);
		}
		const regex = new RegExp(varExpr.replace(/\*/g, '[a-zA-Z0-9_]*'), 'g');
		const found = new Set();
		for (;;) {
			const p = regex.exec(code);
			if(!p) {
				break;
			}
			found.add(p[0]);
		}
		return found;
	}

	function buildFunctionFinder(code, returning, putPrefix='', searchPrefix='') {
		let parts = '';
		for(let k of Object.keys(returning)) {
			if(!returning.hasOwnProperty(k)) {
				continue;
			}
			parts += JSON.stringify(k) + ':';
			const vars = findCandidates(code, searchPrefix+returning[k]);
			if(vars.size === 1) {
				parts += putPrefix+vars.values().next().value.slice(searchPrefix.length);
			} else if(vars.size > 1) {
				parts += (
					'((() => {' +
						vars.map((v) => 'try {return ' +
						putPrefix+v.slice(searchPrefix.length) + ';} catch(e) {}').join('') +
					'})())'
				);
			} else {
				parts += 'null';
			}
			parts += ',';
		}
		return 'return {' + parts + '};';
	}

	function compile({
		initCode = '',
		initParams = {},
		initExtras = {},
		initPre = '',
		initSloppy = false,
	} = {}, otherMethods = {}) {
		const tag = nodeUtils.hashBlock([
			initCode,
			...Object.keys(otherMethods).map(i => {
				return otherMethods[i].code;
			}),
		]);
		let compileError = null;
		let fns = {};
		const begin = performance.now();

		const container = new ivm.Isolate({memoryLimit:32});
		knownEnvs.add(container);
		const containedEnv = container.createContextSync();
		const isolateUnpack = isolateMarshaller.bindChannels(container, containedEnv);

		try {
			//Since we are running in a bare javascript environment,
			//the prelude can be made quite lean,
			//since there aren't any globals we need to wipe up

			container.compileScriptSync((`
				var _${tag}_g = {};
				var _${tag}_c = (_${tag}_p, _${tag}_e) => {
					${initSloppy?'':'\'use strict\';'}
					let params = unpack(_${tag}_p);
					let extras = unpack(_${tag}_e);
					${initPre};
					extras = undefined;
					_${tag}_g = new (function({${Object.keys(initParams).join(',')}}) {
						const params = undefined; /*Intentional variable shadow*/
				`).replace(/(\r\n\t|\n|\r\t)/gm,'') + `
						${initCode};
					})(params);
				};
			`, {
				filename: 'submissionBuild',
			}).runSync(containedEnv, {timeout: 10000});

			let buildFn = containedEnv.global.getSync('_'+tag+'_c');
			buildFn.applySync(undefined, [
				new ivm.Reference(initParams),
				new ivm.Reference(initExtras),
			], {
				timeout: 10000,
				release: true,
			});
		} catch (e) {
			console.log(e);
			compileError = 'initialization: ' + stringifyCompileError(e);
		}
		for (let fnKey of Object.keys(otherMethods)) {
			if (compileError) {
				break;
			}
			try {
				let thing = otherMethods[fnKey];
				let fnPre = thing.hasOwnProperty('pre')?thing.pre:'';
				let fnCode = thing.hasOwnProperty('code')?thing.code:'';
				let fnParams = thing.hasOwnProperty('params')?thing.params:[];
				container.compileScriptSync((`
					${thing.strict?'\'use strict\';':''}
					var _${tag}_${fnKey} = function(_${tag}_p, _${tag}_e) {
						let params = Object.assign({}, _${tag}_g, unpack(_${tag}_p));
						let extras = unpack(_${tag}_e);
						${fnPre};
						extras = undefined;
						return wrapRef((({${fnParams.join(',')}})=>{
							const params = undefined;
					`).replace(/(\r\n\t|\n|\r\t)/gm,'') + `
							${fnCode};
						}).call(params['this']||{}, params));
					}
				`, {
					filename: fnKey,
				}).runSync(containedEnv, {timeout: 10000});
				let callVal = containedEnv.global.getSync(`_${tag}_${fnKey}`);
				fns[fnKey] = function (params={}, extras={}) {
					try {
						let interVal = callVal.applySync(
							undefined,
							[
								new ivm.Reference(params),
								new ivm.Reference(extras),
							],
							{timeout: 10000}
						);
						let val = isolateUnpack(interVal);
						return val;
					} catch(e) {
						if (!(e instanceof TypeError) && !(e instanceof ReferenceError)) {
							if (!container.isDisposed) {
								console.log(e);
							}
						}
						throw e;
					}
				};
			} catch (e) {
				compileError = fnKey + ': ' + stringifyCompileError(e);
			}
		}
		const compileTime = performance.now() - begin;

		return {fns, compileError, compileTime};
	}

	return {
		compile,
		stringifyEntryError,
		buildFunctionFinder,
		disposeEnvs,
		findCandidates,
	};
});
