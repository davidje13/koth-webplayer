define(() => {
	'use strict';

	return (fail) => ({
		not: (submatch) => (actual) => {
			const result = submatch(actual);
			return {
				match: !result.match,
				message: submatch.negatedMessage,
				negatedMessage: submatch.message,
			};
		},

		equals: (value) => (actual) => ({
			match: actual === value,
			message: 'Expected ' + value + ' but got ' + actual,
			negatedMessage: 'Expected not to get ' + value,
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
			match: actual > limit,
			message: 'Expected ' + actual + ' to be greater than ' + limit,
			negatedMessage: 'Expected ' + actual + ' not to be greater than ' + limit,
		}),

		isLowerThan: (limit) => (actual) => ({
			match: actual < limit,
			message: 'Expected ' + actual + ' to be lower than ' + limit,
			negatedMessage: 'Expected ' + actual + ' not to be lower than ' + limit,
		}),

		isNear: (value, range) => (actual) => ({
			match: (
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
