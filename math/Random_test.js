define(['./Random'], (Random) => {
	'use strict';

	describe('makeRandomSeed', () => {
		it('generates a seed using a cryptographic random number generator', () => {
			const seed = Random.makeRandomSeed();
			expect(seed.length, equals(21));
		});

		it('uses the given prefix', () => {
			const seed = Random.makeRandomSeed('prefix-');
			expect(seed.startsWith('prefix-'), equals(true));
		});

		it('defaults to a prefix of "X"', () => {
			const seed = Random.makeRandomSeed();
			expect(seed.startsWith('X'), equals(true));
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
				const random1 = new Random('X123');
				const random2 = new Random(123);
				expect(random1.next(), equals(random2.next()));
			});

			it('can be given a random generator to create its own seed', () => {
				const baseSeed = 'Xabc';
				const random1 = new Random(new Random(baseSeed));
				const random2 = new Random(new Random(baseSeed).makeRandomSeed());
				expect(random1.next(), equals(random2.next()));
			});
		});

		describe('next', () => {
			it('generates integers', () => {
				const random = new Random('Xabc');
				const value = random.next();
				expect(value, isInteger());
			});

			it('uses the range [0 n)', () => {
				const random = new Random('Xabc');
				for(let i = 0; i < 100; ++ i) {
					const value = random.next(10);
					expect(value, not(isLowerThan(0)));
					expect(value, isLowerThan(10));
				}
			});

			it('defaults to a range of [0 0x100000000) (32-bits)', () => {
				const random = new Random('Xabc');
				for(let i = 0; i < 100; ++ i) {
					const value = random.next();
					expect(value, not(isLowerThan(0)));
					expect(value, isLowerThan(0x100000000));
				}
			});

			it('is roughly evenly distributed', () => {
				const random = new Random('Xabc');
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
				const seed = 'Xabc';
				const random1 = new Random(seed);
				const random2 = new Random(seed);
				const value1 = random1.next();
				const value2 = random2.next();
				expect(value1, equals(value2));
			});

			it('generates distinct values', () => {
				const random = new Random('Xabc');
				const value1 = random.next();
				const value2 = random.next();
				expect(value1, not(equals(value2)));
			});
		});

		describe('makeRandomSeed', () => {
			it('generates a seed using the pseudo-random generator', () => {
				const random = new Random('Xabc');
				const seed = random.makeRandomSeed();
				expect(seed.length, equals(21));
			});

			it('uses the given prefix', () => {
				const random = new Random('Xabc');
				const seed = random.makeRandomSeed('prefix-');
				expect(seed.startsWith('prefix-'), equals(true));
			});

			it('defaults to a prefix of "X"', () => {
				const random = new Random('Xabc');
				const seed = random.makeRandomSeed();
				expect(seed.startsWith('X'), equals(true));
			});

			it('generates deterministic seeds', () => {
				const seed = 'Xabc';
				const random1 = new Random(seed);
				const random2 = new Random(seed);
				const seed1 = random1.makeRandomSeed();
				const seed2 = random2.makeRandomSeed();
				expect(seed1, equals(seed2));
			});

			it('generates distinct seeds', () => {
				const random = new Random('Xabc');
				const seed1 = random.makeRandomSeed();
				const seed2 = random.makeRandomSeed();
				expect(seed1, not(equals(seed2)));
			});
		});

		describe('save / rollback', () => {
			it('stores and retrieves the state of the pseudo-random generator', () => {
				const random = new Random('Xabc');
				random.save();
				const value1 = random.next();
				random.rollback();
				const value2 = random.next();
				expect(value1, equals(value2));
			});
		});
	});
});
