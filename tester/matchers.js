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
