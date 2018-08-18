define(['../tester/matchers'], (matchers) => {
	'use strict';

	let latestError = null;
	const M = matchers((err) => {
		latestError = err;
	});

	describe('expect', () => {
		it('checks a value against a matcher', () => {
			let capturedActual = null;
			const matcher = (actual) => {
				capturedActual = actual;
				return {match: true};
			};
			latestError = null;

			M.expect(7, matcher);

			if(capturedActual !== 7) {
				throw 'Unexpected actual: ' + capturedActual + ' != 7';
			}
			if(latestError !== null) {
				throw 'Unexpected failure for passed matcher';
			}
		});

		it('triggers a failure when match is false', () => {
			const matcher = () => ({match: false, message: 'foobar'});
			latestError = null;

			M.expect(7, matcher);

			if(latestError === null) {
				throw 'Expected failure for failed matcher';
			}
			if(latestError.message !== 'foobar') {
				throw 'Unexpected failure message: ' + latestError.message;
			}
		});

		it('takes an optional extra description', () => {
			const matcher = () => ({match: false, message: 'foobar'});
			latestError = null;

			M.expect(7, matcher, 'oops');

			if(latestError === null) {
				throw 'Expected failure for failed matcher';
			}
			if(latestError.message !== 'oops: foobar') {
				throw 'Unexpected failure message: ' + latestError.message;
			}
		});
	});

	describe('not', () => {
		it('inverts the result of a matcher', () => {
			let capturedActual = null;
			const matcher = (actual) => {
				capturedActual = actual;
				return {match: true, message: 'foo', negatedMessage: 'bar'};
			};

			const result = M.not(matcher)(7);

			if(capturedActual !== 7) {
				throw 'Unexpected actual: ' + capturedActual + ' != 7';
			}
			if(result.match !== false) {
				throw 'Expected to invert match';
			}
			if(result.message !== 'bar' || result.negatedMessage !== 'foo') {
				throw 'Expected to invert messages';
			}
		});
	});

	describe('equals', () => {
		it('returns a match for equal booleans', () => {
			if(M.equals(true)(true).match !== true) {
				throw 'true !== true';
			}
			if(M.equals(false)(false).match !== true) {
				throw 'false !== false';
			}
		});

		it('returns no match for different booleans', () => {
			if(M.equals(true)(false).match !== false) {
				throw 'true === false';
			}
			if(M.equals(false)(true).match !== false) {
				throw 'false === true';
			}
		});

		it('performs deep matching', () => {
			expect(M.equals({})({}).match, equals(true));
			expect(M.equals([])([]).match, equals(true));
			expect(M.equals({foo: 7})({foo: 7}).match, equals(true));
			expect(M.equals({foo: 7})({foo: 6}).match, equals(false));
			expect(M.equals({foo: 7})({foo: 7, bar: 1}).match, equals(false));
			expect(M.equals({foo: 7, bar: 1})({foo: 7}).match, equals(false));
			expect(M.equals([3])([3]).match, equals(true));
			expect(M.equals([3])([3, 1]).match, equals(false));
			expect(M.equals([3, 1])([3]).match, equals(false));
		});

		it('detects recursion', () => {
			const o1 = {foo: null};
			o1.foo = o1;
			const o2 = {foo: null};
			o2.foo = o2;
			const o3 = {foo: {foo: 7}};
			expect(M.equals(o1)(o2).match, equals(true));
			expect(M.equals(o1)(o3).match, equals(false));
		});

		it('does not consider arrays and objects as the same', () => {
			expect(M.equals([])({}).match, equals(false));
		});

		it('compares primitive types using ===', () => {
			expect(M.equals(null)(null).match, equals(true));
			expect(M.equals(undefined)(undefined).match, equals(true));
			expect(M.equals(null)(undefined).match, equals(false));
			expect(M.equals(7)(7).match, equals(true));
			expect(M.equals(7)('7').match, equals(false));
			expect(M.equals('foo')('foo').match, equals(true));
			expect(M.equals('foo')('bar').match, equals(false));
		});

		it('returns true for NaN === NaN', () => {
			expect(M.equals(0/0)(0/0).match, equals(true));
			expect(M.equals(0)(0/0).match, equals(false));
			expect(M.equals(0/0)(0).match, equals(false));
		});
	});

	describe('identicalTo', () => {
		it('checks === matching', () => {
			expect(M.identicalTo(8)(8).match, equals(true));
			expect(M.identicalTo(8)(7).match, equals(false));
		});

		it('returns true for NaN === NaN', () => {
			expect(M.identicalTo(0/0)(0/0).match, equals(true));
			expect(M.identicalTo(0)(0/0).match, equals(false));
			expect(M.identicalTo(0/0)(0).match, equals(false));
		});

		it('returns true for identical objects', () => {
			const o = {};
			expect(M.identicalTo(o)(o).match, equals(true));
		});

		it('returns false for similar objects', () => {
			expect(M.identicalTo(8)('8').match, equals(false));
			expect(M.identicalTo({})({}).match, equals(false));
		});
	});

	describe('hasType', () => {
		it('compares the type of the actual', () => {
			expect(M.hasType('number')(8).match, equals(true));
			expect(M.hasType('number')('foo').match, equals(false));
			expect(M.hasType('string')('foo').match, equals(true));
			expect(M.hasType('object')({}).match, equals(true));
			expect(M.hasType('object')([]).match, equals(true));
			expect(M.hasType('function')(() => {}).match, equals(true));
			expect(M.hasType('object')(null).match, equals(true));
		});
	});

	describe('isInteger', () => {
		it('returns a match for integers', () => {
			expect(M.isInteger()(8).match, equals(true));
			expect(M.isInteger()(8.0).match, equals(true));
		});

		it('rejects floating point values', () => {
			expect(M.isInteger()(8.1).match, equals(false));
		});

		it('rejects non-numeric values', () => {
			expect(M.isInteger()('foo').match, equals(false));
			expect(M.isInteger()('1').match, equals(false));
			expect(M.isInteger()(0/0).match, equals(false));
			expect(M.isInteger()(null).match, equals(false));
		});
	});

	describe('isGreaterThan', () => {
		it('returns a match for values > threshold', () => {
			expect(M.isGreaterThan(8)(9).match, equals(true));
			expect(M.isGreaterThan(8)(8.1).match, equals(true));
			expect(M.isGreaterThan(-8)(-7.9).match, equals(true));
		});

		it('returns no match for values <= threshold', () => {
			expect(M.isGreaterThan(8)(8).match, equals(false));
			expect(M.isGreaterThan(8)(7.9).match, equals(false));
			expect(M.isGreaterThan(-8)(-8.1).match, equals(false));
		});

		it('returns no match for NaN', () => {
			expect(M.isGreaterThan(8)(0/0).match, equals(false));
			expect(M.isGreaterThan(-8)(0/0).match, equals(false));
		});

		it('returns no match for non-numeric values', () => {
			expect(M.isGreaterThan(8)('foo').match, equals(false));
			expect(M.isGreaterThan(-8)('foo').match, equals(false));
			expect(M.isGreaterThan(-8)(null).match, equals(false));
		});
	});

	describe('isLowerThan', () => {
		it('returns a match for values < threshold', () => {
			expect(M.isLowerThan(8)(7).match, equals(true));
			expect(M.isLowerThan(8)(7.9).match, equals(true));
			expect(M.isLowerThan(-8)(-8.1).match, equals(true));
		});

		it('returns no match for values >= threshold', () => {
			expect(M.isLowerThan(8)(8).match, equals(false));
			expect(M.isLowerThan(8)(8.1).match, equals(false));
			expect(M.isLowerThan(-8)(-7.9).match, equals(false));
		});

		it('returns no match for NaN', () => {
			expect(M.isLowerThan(8)(0/0).match, equals(false));
			expect(M.isLowerThan(-8)(0/0).match, equals(false));
		});

		it('returns no match for non-numeric values', () => {
			expect(M.isLowerThan(-8)('foo').match, equals(false));
			expect(M.isLowerThan(8)('foo').match, equals(false));
			expect(M.isLowerThan(8)(null).match, equals(false));
		});
	});

	describe('isNear', () => {
		it('returns a match for values near the expected value', () => {
			expect(M.isNear(8, 0.5)(8).match, equals(true));
			expect(M.isNear(8, 0.5)(8.5).match, equals(true));
			expect(M.isNear(8, 0.5)(7.5).match, equals(true));
		});

		it('returns no match for values far from the expected value', () => {
			expect(M.isNear(8, 0.5)(8.6).match, equals(false));
			expect(M.isNear(8, 0.5)(7.4).match, equals(false));
		});

		it('returns no match for NaN', () => {
			expect(M.isNear(8, 100)(0/0).match, equals(false));
		});

		it('returns no match for non-numeric values', () => {
			expect(M.isNear(8, 100)('foo').match, equals(false));
			expect(M.isNear(8, 100)(null).match, equals(false));
		});
	});
});
