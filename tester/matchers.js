define(() => {
	'use strict';

	function describe(object) {
		try {
			return JSON.stringify(object);
		} catch(ignore) {
			return String(object);
		}
	}

	function checkIdentical(value, actual) {
		return (actual === actual) ? (actual === value) : (value !== value);
	}

	let checkEqualsDeep = null;

	function checkEqualsKeys(value, actual, seen) {
		for(const k of Object.keys(actual)) {
			if(!checkEqualsDeep(value[k], actual[k], seen)) {
				return false;
			}
		}
		for(const k of Object.keys(value)) {
			if(!actual.hasOwnProperty(k)) {
				return false;
			}
		}
		return true;
	}

	checkEqualsDeep = (value, actual, seen) => {
		if(checkIdentical(value, actual)) {
			return true;
		}
		if(
			typeof value !== 'object' || typeof actual !== 'object' ||
			Array.isArray(value) !== Array.isArray(actual) ||
			!actual || !value
		) {
			return false;
		}
		let loop = seen.get(actual);
		if(!loop) {
			loop = new Set();
			seen.set(actual, loop);
		}
		if(loop.has(value)) {
			return true;
		}
		loop.add(value);
		if(!checkEqualsKeys(value, actual, seen)) {
			return false;
		}
		return true;
	};

	return (fail) => ({
		not: (submatch) => (actual) => {
			const result = submatch(actual);
			return {
				match: !result.match,
				message: result.negatedMessage,
				negatedMessage: result.message,
			};
		},

		identicalTo: (value) => (actual) => {
			if(checkIdentical(value, actual)) {
				return {
					match: true,
					message: '',
					negatedMessage: 'Expected not to get ' + describe(value),
				};
			}
			return {
				match: false,
				message: checkEqualsDeep(value, actual, new Map()) ?
					('Expected exactly ' + describe(value) + ' but got a copy') :
					('Expected ' + describe(value) + ' but got ' + describe(actual)),
				negatedMessage: '',
			};
		},

		equals: (value) => (actual) => ({
			match: checkEqualsDeep(value, actual, new Map()),
			message: 'Expected ' + describe(value) + ' but got ' + describe(actual),
			negatedMessage: 'Expected not to get ' + describe(value),
		}),

		hasType: (type) => (actual) => ({
			match: (typeof actual === type),
			message: 'Expected type ' + type + ' but got ' + (typeof actual),
			negatedMessage: 'Expected ' + actual + ' not to be type ' + type,
		}),

		isInteger: () => (actual) => ({
			match: (typeof actual === 'number' && Math.round(actual) === actual),
			message: 'Expected ' + actual + ' to be an integer',
			negatedMessage: 'Expected ' + actual + ' not to be an integer',
		}),

		isGreaterThan: (limit) => (actual) => ({
			match: (typeof actual === 'number') && actual > limit,
			message: 'Expected ' + actual + ' to be greater than ' + limit,
			negatedMessage: 'Expected ' + actual + ' not to be greater than ' + limit,
		}),

		isLowerThan: (limit) => (actual) => ({
			match: (typeof actual === 'number') && actual < limit,
			message: 'Expected ' + actual + ' to be lower than ' + limit,
			negatedMessage: 'Expected ' + actual + ' not to be lower than ' + limit,
		}),

		isNear: (value, range) => (actual) => ({
			match: (typeof actual === 'number') && (
				actual >= value - range &&
				actual <= value + range
			),
			message: 'Expected ' + value + ' +/- ' + range + ' but got ' + actual,
			negatedMessage: 'Expected not to be within ' + range + ' of ' + value,
		}),

		expect: (value, matcher, extra) => {
			const result = matcher(value);
			if(!result.match) {
				fail(new Error((extra ? extra + ': ' : '') + result.message));
			}
		},
	});
});
