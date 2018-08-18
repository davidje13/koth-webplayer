define([
	'isolated-vm',
], (
	ivm
) => {
	'use strict';
	/* globals console */

	let inConstructRef = null;
	let inApplyRef = null;
	let inPortionRef = null;

	function wrapRef(f) {
		if (isPrimitive(f)) {
			return f;
		}
		return new ivm.Reference(f);
	}
	function isPrimitive(val) {
		return (val === undefined) ||
		(val === null) ||
		(['boolean', 'number', 'string'].includes(typeof val));
	}

	function cloneablePortion(inRef, seenMapRef) {
		let seenMap;
		let obj = inRef.deref();
		if (seenMapRef === undefined) {
			seenMap = new WeakMap();
			seenMapRef = new ivm.Reference(seenMap);
		} else {
			seenMap = seenMapRef.deref();
		}
		//Javascript is weird. This bit of special-casing is
		//required to get things to work reasonably
		let base = (obj instanceof Array)?[]:Object.create(Object.getPrototypeOf(obj));
		seenMap.set(obj, new ivm.Reference(base));
		for (let key of Object.keys(obj)) {
			if (isPrimitive(obj[key])) {
				base[key] = obj[key];
			} else {
				if (seenMap.has(obj[key])) {
					base[key] = seenMap.get(obj[key]);
				} else {
					base[key] = new ivm.Reference(obj[key]);
				}
			}
		}
		return new ivm.ExternalCopy({
			clone: base,
			seen: seenMapRef,
		}).copyInto({release: true, transferIn: true});
	}

	function getConstructRef() {
		if (inConstructRef === null) {
			inConstructRef = new ivm.Reference(construct);
		}
		return inConstructRef;
	}

	function getApplyRef() {
		if (inApplyRef === null) {
			inApplyRef = new ivm.Reference(funcCall);
		}
		return inApplyRef;
	}

	function getPortionRef() {
		if (inPortionRef === null) {
			inPortionRef = new ivm.Reference(cloneablePortion);
		}
		return inPortionRef;
	}
	function construct(inRef, constructRef, applyRef, portionRef, argRefs) {
		let val = Reflect.construct(
			inRef.deref(),
			demarshal(argRefs, constructRef, applyRef, portionRef)
		);
		if (val instanceof Function) {
			return wrapRef(val);
		} else {
			return new ivm.Reference(val);
		}
	}

	function funcCall(inRef, constructRef, applyRef, portionRef, thisRef, argRefs) {
		let val = Reflect.apply(
			inRef.deref(),
			demarshal(thisRef, constructRef, applyRef, portionRef),
			demarshal(argRefs, constructRef, applyRef, portionRef)
		);
		if (isPrimitive(val)) {
			return val;
		} else if (val instanceof Function) {
			return wrapRef(val);
		} else {
			return new ivm.Reference(val);
		}
	}

	function demarshalFunction(outRef, constructRef, applyRef, portionRef) {
		return function (...argList) {
			if (new.target) {
				let basedOn = demarshal(constructRef.applySync(
					undefined,
					[
						outRef,
						getConstructRef(),
						getApplyRef(),
						getPortionRef(),
						new ivm.Reference(argList),
					],
					{timeout: 10000}
				), constructRef, applyRef, portionRef);
				Object.setPrototypeOf(this, Object.getPrototypeOf(basedOn));
				for (let key of Object.keys(basedOn)) {
					this[key] = basedOn[key];
				}
			} else {
				return demarshal(applyRef.applySync(
					undefined,
					[
						outRef,
						getConstructRef(),
						getApplyRef(),
						getPortionRef(),
						new ivm.Reference(this),
						new ivm.Reference(argList),
					],
					{timeout: 10000}
				), constructRef, applyRef, portionRef);
			}
		};
	}

	function demarshal(
		outRef,
		constructRef,
		applyRef,
		portionRef,
		knownRefs = new WeakMap(),
		seenToken = undefined
	) {
		if (isPrimitive(outRef)) {
			return outRef;
		} else if (knownRefs.has(outRef)) {
			return knownRefs.get(outRef);
		} else if ([
			'undefined', 'null', 'number', 'boolean', 'string',
		].includes(outRef.typeof)) {
			return outRef.copySync();
		} else if (outRef.typeof === 'function') {
			let retVal = demarshalFunction(outRef, constructRef, applyRef, portionRef);
			knownRefs.set(outRef, retVal);
			return retVal;
		} else {
			try {
				let newBase = outRef.copySync();
				knownRefs.set(outRef, newBase);
				outRef.release();
				return newBase;
			} catch (e) {
				let combination = portionRef.applySync(undefined, [outRef, seenToken]);
				let newBase = combination.clone;
				let token = combination.seen;
				knownRefs.set(outRef, newBase);
				for (let key of Object.keys(newBase)) {
					if (newBase[key] instanceof ivm.Reference) {
						newBase[key] = demarshal(
							newBase[key],
							constructRef,
							applyRef,
							portionRef,
							knownRefs,
							token
						);
						//If newBase[key] is itself an object, it recursively
						//calls for the demarshalling of its own
						//keys in the process of demarshalling itself
					}
				}
				outRef.release();
				if (seenToken === undefined) {
					token.release();
				}

				return newBase;
			}
		}
	}

	function bindChannels(isolate, context, doLog = false) {
		context.global.setSync('_ivm', ivm);
		context.global.setSync('_outConstruct', new ivm.Reference(construct));
		context.global.setSync('_outFuncCall', new ivm.Reference(funcCall));
		context.global.setSync('_outPortion', new ivm.Reference(cloneablePortion));

		let factoryScript = isolate.compileScriptSync(`
			let ivm = _ivm; _ivm = undefined;
			let inConstructRef = null;
			let inApplyRef = null;
			let inPortionRef = null;
			let outConstruct = _outConstruct; _outConstruct = undefined;
			let outFuncCall = _outFuncCall; _outFuncCall = undefined;
			let outPortion = _outPortion; _outPortion = undefined;
			${isPrimitive.toString()}
			${wrapRef.toString()}
			${getConstructRef.toString()}
			${getApplyRef.toString()}
			${getPortionRef.toString()}
			${construct.toString()}
			${funcCall.toString()}
			${cloneablePortion.toString()}
			${demarshalFunction.toString()}
			${demarshal.toString()}
			var unpack = function (objRef) {
				return demarshal(
					objRef,
					outConstruct,
					outFuncCall,
					outPortion,
				);
			}
		`);
		factoryScript.runSync(context);

		let unpack = function(objRef) {
			return demarshal(
				objRef,
				context.global.getSync('construct'),
				context.global.getSync('funcCall'),
				context.global.getSync('cloneablePortion')
			);
		};
		context.global.setSync('global', context.global.derefInto());
		if (doLog) {
			context.global.setSync('_outLog', new ivm.Reference((t) => {
				console.log(...unpack(t));
			}));
		} else {
			context.global.setSync('_outLog', new ivm.Reference(()=>{}));
		}

		isolate.compileScriptSync(`
			let outLog = _outLog; _outLog = undefined;
			var console = {
				log: (...val) => { outLog.applySync(undefined, [wrapRef(val)]) },
				info: (...val) => { outLog.applySync(undefined, [wrapRef(val)]) },
				warn: (...val) => { outLog.applySync(undefined, [wrapRef(val)]) },
				error: (...val) => { outLog.applySync(undefined, [wrapRef(val)]) },
				clear: () => {},
			};
		`).runSync(context);

		return unpack;
	}

	return {
		bindChannels,
		construct,
		funcCall,
		cloneablePortion,
		demarshal,
		wrapRef,
	};
});
