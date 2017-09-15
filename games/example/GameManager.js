define([
	'fetch/entryUtils',
], (
	entryUtils
) => {
	'use strict';

	// This is the core runner for your game.
	// One GameManager will be created for each game (no need to clean up state)
	// It will run inside a sandboxed web worker, so you don't need to worry
	// about breaking up long-running calculations.
	// You may get some requests to change the game configuration and entries
	// (updateConfig and updateEntry). You can allow as much or as little
	// changing as you like, but it's generally better for debugging if as
	// much as possible is editable (e.g. it makes sense to allow changing the
	// maximum frame on-the-fly, but probably doesn't make sense to allow
	// changing the grid size. Also it makes sense to allow updating an existing
	// competitor, but probably doesn't make sense to add a new competitor)

	return class GameManager {
		constructor(random, gameConfig) {
			this.random = random; // a seeded random object you can use

			// gameConfig contains:
			// - seed: the current game seed. Typically you won't need to check
			//         this because the random object is pre-seeded
			// - teams: the list of teams competing in this game. Each entry
			//          also contains an 'entries' list (in free-for-all games,
			//          each team will have exactly 1 entry)

			// Example:
//			teams.forEach((team, teamIndex) => team.entries.forEach((entry) => {
//				this.entryLookup.set(entry.id, {
//					id: entry.id,
//					fn: null,
//					pauseOnError: false,
//					disqualified: false,
//					error: null,
//					errorInput: null,
//					errorOutput: null,
//					console: [],
//					// anything else you want to store
//					codeSteps: 0,
//					elapsedTime: 0,
//				});
//				this.bots.push(bot);
//				// using updateEntry here helps reduce code duplication:
//				this.updateEntry(entry);
//			}));
		}

		updateEntry({
			id,
			code = null,
			pauseOnError = null,
			disqualified = null,
			/* other props you care about */
		}) {
			const entry = this.entryLookup.get(id);
			if(!entry) {
				throw new Error('Attempt to modify an entry which was not registered in the game');
			}
			if(code !== null) {
				// These parameter names match the key values given to fn() in
				// step(type) below
				const compiledCode = entryUtils.compile(code, [
					'my',
					'parameters',
					'here',
				]);
				entry.fn = compiledCode.fn;
				if(compiledCode.compileError) {
					entry.disqualified = true;
					entry.error = compiledCode.compileError;
				} else {
					// Automatically un-disqualify entries when code is updated
					entry.error = null;
					entry.disqualified = false;
				}
				entry.errorInput = null;
				entry.errorOutput = null;
			}
			if(pauseOnError !== null) {
				entry.pauseOnError = pauseOnError;
			}
			if(disqualified !== null) {
				entry.disqualified = disqualified;
			}
			// Handle any other props you care about here
		}

		updateConfig(gameConfig) {
			// Update anything which makes sense to change mid-game here
		}

		// This is an internal method; you can change the arguments to whatever
		// you need when handling errors
		handleError(entry, params, action, error) {
			// errorInput, errorOutput, and error are presented to the user.
			// Fill them in with something useful. For example:
			entry.errorInput = JSON.stringify(params);
			entry.errorOutput = JSON.stringify(action);
			entry.error = (
				error + ' (gave ' + entry.errorOutput +
				' for ' + entry.errorInput + ')'
			);
			if(entry.pauseOnError) {
				// To support pauseOnError, roll back the game state to just
				// before the current move. For example, to roll back the
				// random number generator:
				this.random.rollback();
				// Throwing 'PAUSE' will cause the manager to pause the game
				throw 'PAUSE';
			} else {
				// If you want to auto-disqualify entries which break the
				// rules:
//				entry.disqualified = true;
			}
		}

		step(type) {
			// type will usually be '', but you can define custom step types
			// and invoke them from your Display class (e.g. 'single')

			// An example implementation which invokes the entry's function,
			// then error-checks its output:

			// If you use random numbers, save the random state before starting;
			// this will allow a full rollback if we want to pause on errors
			// later.
			this.random.save();

			const entry = null; // Pick an entry

			const params = {
				my: 'foo',
				parameters: 'bar',
				here: 'baz',
			};
			let action = null;
			let error = null;
			let elapsed = 0;

			try {
				// For an example of how to allow competitors to use Math.random
				// without becoming non-deterministic, see battlebots/botflocks
				const begin = performance.now();
				action = entry.fn(params, {consoleTarget: entry.console});
				elapsed = performance.now() - begin;

				// If your error checking is complex, you may want to invoke a
				// separate method instead of writing it inline here.
				// For example:
				// error = this.checkError(entry, action);

				const actionIsBad = false; // Check this
				if(actionIsBad) {
					error = 'Oh no!';
				}
			} catch(e) {
				error = entryUtils.stringifyEntryError(e);
			}

			// Recording average time taken can help to name-and-shame slow
			// entries, but is not required
			entry.elapsedTime += elapsed;
			++ entry.codeSteps;

			if(error) {
				this.handleError(entry, params, action, error);
			} else {
				// Apply the action
				// It's often good to invoke separate method for this to avoid
				// a massive do-everything step(), which would get hard to
				// navigate. For example:
				// this.performAction(entry, action);
			}
		}

		isOver() {
			// Return false until your game is over, then true.
			return true;
		}

		getState() {
			// This will be used by some internal management tasks, and will be
			// given to your Display and GameScorer classes.

			return {
				// Framework data
				over: this.isOver(), // when true, the game stops
				progress: 0, // a number from 0 to 1, used for progress bars

				// Game specific data
				// Put anything you like here, but make sure you have teams:
				foo: 'bar',
				teams: this.teams.map((team) => ({
					id: team.id,
					entries: team.entries.map((entryState) => {
//						const entryState = this.entryLookup.get(entry.id);
						return {
							id: entryState.id,
							disqualified: entryState.disqualified,

							// example data:
							error: entryState.error,
							errorInput: entryState.errorInput,
							errorOutput: entryState.errorOutput,
							console: entryState.console,
//							codeSteps: entryState.codeSteps,
//							elapsedTime: entryState.elapsedTime,
//
//							x: entryState.x,
//							y: entryState.y,
//							winningness: entryState.winningness,
						};
					}),
				})),
			};
		}
	};
});
