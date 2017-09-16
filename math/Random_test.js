define(['./Random'], (Random) => {
	'use strict';

	describe('makeRandomSeed', () => {
		it('generates a seed using a cryptographic random number generator', () => {
			const seed = Random.makeRandomSeed();
			expect(seed.length, equals(20));
		});

		it('generates distinct seeds', () => {
			// There is a very small chance that this test could fail due to
			// the same random seed being generated twice, but it's highly
			// unlikely
			const seed1 = Random.makeRandomSeed();
			const seed2 = Random.makeRandomSeed();
			expect(seed1, not(equals(seed2)));
		});
	});

	describe('Random', () => {
		describe('constructor', () => {
			it('can be given a seed as a string or number', () => {
				const random1 = new Random('123');
				const random2 = new Random(123);
				expect(random1.next(), equals(random2.next()));
			});

			it('can be given a random generator to create its own seed', () => {
				const baseSeed = 'abc';
				const random1 = new Random(new Random(baseSeed));
				const random2 = new Random(new Random(baseSeed).makeRandomSeed());
				expect(random1.next(), equals(random2.next()));
			});
		});

		describe('next', () => {
			it('generates integers', () => {
				const random = new Random('abc');
				const value = random.next();
				expect(value, isInteger());
			});

			it('uses the range [0 n)', () => {
				const random = new Random('abc');
				for(let i = 0; i < 100; ++ i) {
					const value = random.next(10);
					expect(value, not(isLowerThan(0)));
					expect(value, isLowerThan(10));
				}
			});

			it('defaults to a range of [0 0x100000000) (32-bits)', () => {
				const random = new Random('abc');
				for(let i = 0; i < 100; ++ i) {
					const value = random.next();
					expect(value, not(isLowerThan(0)));
					expect(value, isLowerThan(0x100000000));
				}
			});

			it('is roughly evenly distributed', () => {
				const random = new Random('abc');
				const buckets = [0, 0, 0, 0, 0];
				const samples = 10000;
				for(let i = 0; i < samples; ++ i) {
					const value = random.next(buckets.length);
					++ buckets[value];
				}
				const limit = samples * 1.2 / buckets.length;
				for(let i = 0; i < buckets.length; ++ i) {
					expect(buckets[i], isLowerThan(limit), 'bucket ' + i);
				}
			});

			it('generates deterministic values', () => {
				const seed = 'abc';
				const random1 = new Random(seed);
				const random2 = new Random(seed);
				const value1 = random1.next();
				const value2 = random2.next();
				expect(value1, equals(value2));
			});

			it('generates distinct values', () => {
				const random = new Random('abc');
				const value1 = random.next();
				const value2 = random.next();
				expect(value1, not(equals(value2)));
			});
		});

		describe('intGenerator', () => {
			it('returns a function which generates integers', () => {
				const random = new Random('abc');
				const generator = random.intGenerator();
				expect(generator(), isInteger());
			});
		});

		describe('nextFloat', () => {
			it('generates floats', () => {
				const random = new Random('abc');
				const value = random.nextFloat();
				expect(value, hasType('number'));
			});

			it('uses the range [0 n)', () => {
				const random = new Random('abc');
				for(let i = 0; i < 100; ++ i) {
					const value = random.nextFloat(0.1);
					expect(value, not(isLowerThan(0)));
					expect(value, isLowerThan(0.1));
				}
			});

			it('defaults to a range of [0 1)', () => {
				const random = new Random('abc');
				for(let i = 0; i < 100; ++ i) {
					const value = random.nextFloat();
					expect(value, not(isLowerThan(0)));
					expect(value, isLowerThan(1));
				}
			});
		});

		describe('floatGenerator', () => {
			it('returns a function which generates floats', () => {
				const random = new Random('abc');
				const generator = random.floatGenerator();
				expect(generator(), hasType('number'));
			});
		});

		describe('makeRandomSeed', () => {
			it('generates a seed using the pseudo-random generator', () => {
				const random = new Random('abc');
				const seed = random.makeRandomSeed();
				expect(seed.length, equals(20));
			});

			it('generates deterministic seeds', () => {
				const seed = 'abc';
				const random1 = new Random(seed);
				const random2 = new Random(seed);
				const seed1 = random1.makeRandomSeed();
				const seed2 = random2.makeRandomSeed();
				expect(seed1, equals(seed2));
			});

			it('generates distinct seeds', () => {
				const random = new Random('abc');
				const seed1 = random.makeRandomSeed();
				const seed2 = random.makeRandomSeed();
				expect(seed1, not(equals(seed2)));
			});
		});

		describe('save / rollback', () => {
			it('stores and retrieves the state of the pseudo-random generator', () => {
				const random = new Random('abc');
				random.save();
				const value1 = random.next();
				random.rollback();
				const value2 = random.next();
				expect(value1, equals(value2));
			});
		});
	});
});
