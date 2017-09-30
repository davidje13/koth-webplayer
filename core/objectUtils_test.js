define(['./objectUtils'], (objectUtils) => {
	'use strict';

	describe('deepCopy', () => {
		it('returns a copy of the parameter', () => {
			const source = {};
			const result = objectUtils.deepCopy(source);

			expect(result, equals(source));
			expect(result, not(identicalTo(source)));
		});

		it('passes primitives unchanged', () => {
			expect(objectUtils.deepCopy(null), equals(null));
			expect(objectUtils.deepCopy(undefined), equals(undefined));
			expect(objectUtils.deepCopy('hello'), equals('hello'));
			expect(objectUtils.deepCopy(7), equals(7));
			expect(objectUtils.deepCopy(0/0), equals(0/0));
		});

		it('returns a deep copy of the parameter', () => {
			const source = {foo: {bar: '7'}};
			const result = objectUtils.deepCopy(source);

			expect(result, equals(source));
			expect(result, not(identicalTo(source)));
			expect(result.foo, not(identicalTo(source.foo)));
			expect(result.foo.bar, identicalTo(source.foo.bar));
		});

		it('converts arrays', () => {
			const source = {foo: [1, 2, {baz: 3}]};
			const result = objectUtils.deepCopy(source);

			expect(result.foo.map, not(equals(undefined)));
			expect(result.foo[2], equals(source.foo[2]));
			expect(result.foo[2], not(identicalTo(source.foo[2])));
		});

		it('maintains recursion', () => {
			const source = {foo: null};
			source.foo = source;
			const result = objectUtils.deepCopy(source);

			expect(result, equals(source));
			expect(result, not(identicalTo(source)));
			expect(result.foo, identicalTo(result));
		});
	});
});
