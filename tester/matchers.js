define(() => {
	'use strict';

	return (target, fail) => {
		target.not = (submatch) => (actual) => {
			const result = submatch(actual);
			return {
				match: !result.match,
				message: submatch.negatedMessage,
				negatedMessage: submatch.message,
			};
		};

		target.equals = (expected) => (actual) => ({
			match: actual === expected,
			message: 'Expected ' + expected + ' but got ' + actual,
			negatedMessage: 'Expected not to get ' + expected,
		});

		target.hasType = (expected) => (actual) => ({
			match: (typeof actual === expected),
			message: 'Expected type ' + expected + ' but got ' + (typeof actual),
			negatedMessage: 'Expected ' + actual + ' not to be type ' + expected,
		});

		target.isInteger = () => (actual) => ({
			match: (typeof actual === 'number' && Math.round(actual) === actual),
			message: 'Expected ' + actual + ' to be an integer',
			negatedMessage: 'Expected ' + actual + ' not to be an integer',
		});

		target.isGreaterThan = (expected) => (actual) => ({
			match: actual > expected,
			message: 'Expected ' + actual + ' to be greater than ' + expected,
			negatedMessage: 'Expected ' + actual + ' not to be greater than ' + expected,
		});

		target.isLowerThan = (expected) => (actual) => ({
			match: actual < expected,
			message: 'Expected ' + actual + ' to be lower than ' + expected,
			negatedMessage: 'Expected ' + actual + ' not to be lower than ' + expected,
		});

		target.isNear = (expected, tolerance) => (actual) => ({
			match: (
				actual >= expected - tolerance &&
				actual <= expected + tolerance
			),
			message: 'Expected ' + expected + ' +/- ' + tolerance + ' but got ' + actual,
			negatedMessage: 'Expected not to be within ' + tolerance + ' of ' + expected,
		});

		target.expect = (value, matcher, extraDesc) => {
			const result = matcher(value);
			if(!result.match) {
				fail(new Error((extraDesc ? extraDesc + ': ' : '') + result.message));
			}
		};
	};
});
