define([
	'core/EventObject',
	'display/documentUtils',
], (
	EventObject,
	docutil
) => {
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
		event: 'begin',
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
			title: 'Step',
			event: 'step',
			params: ['single', 1],
		}, {
			label: '>>',
			title: 'Step Frame',
			event: 'step',
			params: [null, 1],
		}, {
			label: '\u25B6',
			title: 'Play',
			event: 'changeplay',
			params: [{delay: 0, speed: 1}],
		}, {
			label: '\u25B6!',
			title: 'Fastest Possible',
			event: 'changeplay',
			params: [{delay: 0, speed: -1}],
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

	return class StepperOptions extends EventObject {
		constructor(speedButtons = SPEED_BUTTONS) {
			super();

			this.renderPerf = null;
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
				this.trigger('begin', [{seed: this.seedEntry.value}]);
			});

			this.buttons = makeButtons(speedButtons, this);

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

		setRenderPerformance(renderer) {
			this.renderPerf = renderer;
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

		updateState(state) {
			let simTime = state.simulationTime;
			state.teams.forEach((team) => team.entries.forEach((entry) => simTime -= entry.elapsedTime));

			docutil.updateText(this.frame, state.frame);
			docutil.updateText(this.stepTime, (state.simulationTime / state.frame).toFixed(3));
			docutil.updateText(this.engineTime, (simTime / state.frame).toFixed(3));
			if(this.renderPerf) {
				docutil.updateText(this.renderTime, (this.renderPerf.renderTime / this.renderPerf.renderCount).toFixed(3));
			} else {
				docutil.updateText(this.renderTime, '-');
			}
			docutil.updateText(this.worldTime, (state.realWorldTime * 0.001).toFixed(3));
		}

		dom() {
			return this.bar;
		}
	}
});
