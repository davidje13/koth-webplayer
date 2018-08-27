define([
	'core/EventObject',
	'display/documentUtils',
	// You can also include stylesheets if you want to (e.g. ./style.css)
], (
	EventObject,
	docutil
) => {
	'use strict';

	// This code runs on the main UI thread outside the sandbox. It should not
	// run any untrusted code, and should be fast! It is responsible for
	// rendering the game-specific UI (e.g. game visualisation, results table,
	// options bar)

	return class Display extends EventObject {
		constructor() {
			super();

			// Make any DOM objects you want here, or delegate to convenient
			// display objects (see the other games for examples)

			// docutil is a collection of convenience wrappers around DOM calls
			// such as createElement, appendChild, etc. This call will create
			// a <section> element with class="game-container" and a text node
			// child saying "Hello!":
			this.myBaseDOMComponent = docutil.make(
				'section',
				{'class': 'game-container'},
				['Hello!']
			);
			// (you can create DOM nodes using any methods/libraries you like)

			// An object you are likely to use is display/Full2DBoard, which
			// will work with a custom BoardRenderer to draw a pixel grid, as
			// well as automatically rendering markers. If your game is toroidal
			// (wraps left-to-right and top-to-bottom), you may want to use
			// FullSwitchingBoard instead for some fancy 3D gimmicks.


			// If you want to allow your user to change play/game/display
			// configurations, provide UI elements here and call:

			// this.trigger('changeplay', [{foo: 'bar'}]);
			// this.trigger('changegame', [{foo: 'bar'}]);
			// this.trigger('changedisplay', [{foo: 'bar'}]);

			// (those examples will set the "foo" configuration property to
			// "bar" in each of play config, game config, and display config)
			// Whenever you trigger a changeX event, the corresponding
			// updateXConfig method (below) will be called with the updated
			// configuration.

			// You may also want to trigger step-by-step progression of your
			// game:
			// this.trigger('step', ['customName', stepsToAdvance, maxDuration])
			//
			// - customName should tie to something you have defined in
			//   GameManager.step, and is '' by default
			// - stepsToAdvance is a number showing how many times to call the
			//   step function before allowing further user interaction
			// - maxDuration is an optional time limit; if processing takes
			//   more than this many milliseconds, it will stop early
		}

		clear() {
			// Reset all displayed data; a new game is about to begin
		}

		// These will be called with the latest configuration objects.
		// This could be at the start of a new game, on history navigation, or
		// when your own code triggers a 'changeX'. You should update any
		// relevant UI, including configuration input UI

		updatePlayConfig(config) {
			// config is initially from <meta name="play-config" ...>
		}

		updateGameConfig(config) {
			// config is initially from <meta name="game-config" ...>
		}

		updateDisplayConfig(config) {
			// config is initially from <meta name="display-config" ...>
		}

		updateState(state) {
			// This is called periodically during the game simulation.
			// It should re-render any relevant components as quickly as
			// possible (game logic is on another thread, but time spent here
			// will impact the page's responsiveness)

			// state is from GameManager.getState
		}

		dom() {
			// Return your root component here
			return this.myBaseDOMComponent;
		}
	};
});
