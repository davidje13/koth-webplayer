define(['core/document_utils', 'core/EventObject'], (docutil, EventObject) => {
	'use strict';

	const REPLAY_BUTTON = {
		label: 'Replay',
		title: 'Replay Current Game',
		event: 'replay',
		params: [],
	};

	const RANDOM_BUTTON = {
		label: 'Random',
		title: 'New Random Game',
		event: 'new',
		params: [],
	};

	const SPEED_BUTTONS = [
		{
			label: '\u25A0',
			title: 'Pause',
			event: 'changeplay',
			params: [{delay: 0, speed: 0}],
		}, {
			label: '>',
			title: 'Step Ant',
			event: 'step',
			params: ['ant', 1],
		}, {
			label: '>>',
			title: 'Step',
			event: 'step',
			params: [undefined, 1],
		}, {
			label: '\u215B',
			title: 'Play 1/8 Speed',
			event: 'changeplay',
			params: [{delay: 1000, speed: 1}],
		}, {
			label: '\u00BC',
			title: 'Play 1/4 Speed',
			event: 'changeplay',
			params: [{delay: 500, speed: 1}],
		}, {
			label: '\u00BD',
			title: 'Play 1/2 Speed',
			event: 'changeplay',
			params: [{delay: 250, speed: 1}],
		}, {
			label: '\u25B6',
			title: 'Play',
			event: 'changeplay',
			params: [{delay: 0, speed: 1}],
		}, {
			label: '\u25B6\u25B6',
			title: 'Play Fast',
			event: 'changeplay',
			params: [{delay: 0, speed: 10}],
		}, {
			label: '\u25B6\u25B6\u25B6',
			title: 'Play Very Fast',
			event: 'changeplay',
			params: [{delay: 0, speed: 50}],
		}, {
			label: '\u25B6\u25B6\u25B6\u25B6',
			title: 'Play Crazy Fast',
			event: 'changeplay',
			params: [{delay: 0, speed: 500}],
		},
	];

	function makeButton(config, target) {
		const element = docutil.make(
			'button',
			{'title': config.title},
			[config.label]
		);
		element.addEventListener('click', () => {
			target.trigger(config.event, config.params);
		});
		return {
			config,
			element,
		};
	}

	function makeButtons(configs, target) {
		return configs.map((config) => makeButton(config, target));
	}

	function configMatches(config, setter) {
		for(let i in setter) {
			if(setter.hasOwnProperty(i)) {
				if(config[i] !== setter[i]) {
					return false;
				}
			}
		}
		return true;
	}

	return class OptionsDisplay extends EventObject {
		constructor() {
			super();

			this.renderPerf = null;
			this.colourChoices = {};
			this.currentSeed = '';
			this.frame = docutil.text('0');
			this.maxFrame = docutil.make('input', {
				'type': 'number',
				'min': '1',
				'step': '1'
			});
			this.seedEntry = docutil.make('input', {'type': 'text', 'class': 'seed-entry'});
			this.seedGo = docutil.make('button', {}, ['Go']);

			this.seedEntry.addEventListener('focus', () => {
				this.seedEntry.select();
			});

			this.maxFrame.addEventListener('change', () => {
				const maxFrame = Math.max(this.maxFrame.value|0, 1);
				this.trigger('changegame', [{maxFrame}]);
			});

			this.seedGo.addEventListener('click', () => {
				this.trigger('new', [this.seedEntry.value]);
			});

			this.buttons = makeButtons(SPEED_BUTTONS, this);

			this.colourPicker = docutil.make('select');
			this.colourPicker.addEventListener('change', () => {
				const value = this.colourPicker.value;
				if(this.colourChoices[value]) {
					this.trigger('changedisplay', [{colourscheme: value}]);
				}
			});

			this.dimPicker = docutil.make('select');
			this.dimPicker.appendChild(docutil.make('option', {'value': '2D'}, '2D'));
			this.dimPicker.appendChild(docutil.make('option', {'value': '3D'}, '3D'));
			this.dimPicker.addEventListener('change', () => {
				const value = this.dimPicker.value;
				this.trigger('changedisplay', [{view3D: value === '3D'}]);
			});

			this.stepTime = docutil.text('-');
			this.engineTime = docutil.text('-');
			this.renderTime = docutil.text('-');
			this.worldTime = docutil.text('-');

			this.bar = docutil.make('div', {'class': 'options'}, [
				docutil.make('span', {'class': 'semidestructive'}, [
					makeButton(REPLAY_BUTTON, this).element,
				]),
				docutil.make('span', {'class': 'frames'}, [
					'Frame ',
					docutil.make('span', {'class': 'frame'}, [this.frame]),
					' of ',
					this.maxFrame,
				]),
				docutil.make('span', {'class': 'play-speed'},
					this.buttons.map((button) => button.element)
				),
				this.colourPicker,
				this.dimPicker,
				docutil.make('span', {'class': 'performance'}, [
					'Step avg.: ', docutil.make('span', {'class': 'metric'}, [this.stepTime]), 'ms',
					' ',
					'(engine: ', docutil.make('span', {'class': 'metric'}, [this.engineTime]), 'ms)',
					docutil.make('br'),
					'Render avg.: ', docutil.make('span', {'class': 'metric'}, [this.renderTime]), 'ms',
					' ',
					'Real: ', docutil.make('span', {'class': 'metric'}, [this.worldTime]), 's',
				]),
				docutil.make('span', {'class': 'destructive'}, [
					this.seedEntry,
					this.seedGo,
					makeButton(RANDOM_BUTTON, this).element,
				]),
			]);
		}

		setColourChoices(colourChoices) {
			this.colourChoices = colourChoices;
			while(this.colourPicker.lastChild) {
				this.colourPicker.removeChild(this.colourPicker.lastChild);
			}
			for(let i in this.colourChoices) {
				if(this.colourChoices.hasOwnProperty(i)) {
					this.colourPicker.appendChild(
						docutil.make('option', {'value': i}, this.colourChoices[i].name)
					);
				}
			}
		}

		setRenderPerformance(renderer) {
			this.renderPerf = renderer;
		}

		clear() {
		}

		updatePlayConfig(config) {
			this.buttons.forEach((button) => {
				const bc = button.config;
				if(bc.event === 'changeplay') {
					button.element.disabled = configMatches(config, bc.params[0]);
				}
			});
		}

		updateGameConfig(config) {
			if(this.maxFrame !== document.activeElement) {
				this.maxFrame.value = config.maxFrame;
			}
			if(config.seed !== this.currentSeed) {
				this.currentSeed = config.seed;
				this.seedEntry.value = this.currentSeed;
			}
		}

		updateDisplayConfig(config) {
			this.colourPicker.value = config.colourscheme;
			this.dimPicker.value = config.view3D ? '3D' : '2D';
		}

		updateState(state) {
			let simTime = state.simulationTime;
			for(let i = 0; i < state.entries.length; ++ i) {
				simTime -= state.entries[i].elapsedTime;
			}

			docutil.update_text(this.frame, state.frame);
			docutil.update_text(this.stepTime, (state.simulationTime / state.frame).toFixed(3));
			docutil.update_text(this.engineTime, (simTime / state.frame).toFixed(3));
			if(this.renderPerf) {
				docutil.update_text(this.renderTime, (this.renderPerf.renderTime / this.renderPerf.renderCount).toFixed(3));
			} else {
				docutil.update_text(this.renderTime, '-');
			}
			docutil.update_text(this.worldTime, (state.realWorldTime * 0.001).toFixed(3));
		}

		dom() {
			return this.bar;
		}
	}
});
