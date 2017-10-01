define([
	'core/arrayUtils',
	'display/documentUtils',
	'display/MarkerStore',
	'display/Full2DBoard',
	'display/OptionsBar',
	'./GameScorer',
	'games/common/BaseDisplay',
	'games/common/components/LeaderboardDisplay',
	'games/common/components/StepperOptions',
	'./components/BoardRenderer',
	'./style.css',
], (
	arrayUtils,
	docutil,
	MarkerStore,
	Full2DBoard,
	OptionsBar,
	GameScorer,
	BaseDisplay,
	LeaderboardDisplay,
	StepperOptions,
	BoardRenderer
) => {
	'use strict';

	const COLOUR_OPTIONS = {
		redblue: {
			name: 'Red & Blue',
			palette: [
				[255, 255, 255, 255],
				[255,   0,   0, 255],
				[  0,   0, 255, 255],
			],
		},
		dark: {
			name: 'Dark Red & Blue',
			palette: [
				[  0,   0,   0, 255],
				[255, 128,  64, 255],
				[ 64, 128, 255, 255],
			],
		},
	};

	const COLOUR_OPTIONS_SELECT = [];
	for(let i in COLOUR_OPTIONS) {
		if(COLOUR_OPTIONS.hasOwnProperty(i)) {
			COLOUR_OPTIONS_SELECT.push({value: i, label: COLOUR_OPTIONS[i].name});
		}
	}

	return class Display extends BaseDisplay {
		constructor(mode) {
			super(mode);

			const renderer = new BoardRenderer();
			const options = new StepperOptions(StepperOptions.makeSpeedButtons({
				'-3': {delay: 1000, speed: 1},
				'-2': {delay: 500, speed: 1},
				'-1': {delay: 250, speed: 1},
				'0': {delay: 10, speed: 1},
				'1': {delay: 0, speed: 1},
				'2': {delay: 0, speed: 32},
				'3': {delay: 0, speed: 64},
			}));
			const visualOptions = new OptionsBar('changedisplay', [
				{attribute: 'colourscheme', values: COLOUR_OPTIONS_SELECT},
				{attribute: 'scale', values: [
					{value: 1, label: '1:1'},
					{value: 2, label: '1:2'},
					{value: 3, label: '1:3'},
					{value: 4, label: '1:4'},
					{value: 5, label: '1:5'},
				]},
			]);
			visualOptions.updateDisplayConfig = visualOptions.updateAttributes;

			this.markers = new MarkerStore();
			this.board = new Full2DBoard({
				renderer,
				markerStore: this.markers,
				scaleX: 0,
			});

			const table = new LeaderboardDisplay({
				columns: [{
					title: 'Alive?',
					generator: (entry) => (entry.alive ? 'yes' : 'no'),
				}, {
					title: 'Kills',
					generator: (entry) => (entry.kills),
				}],
				GameScorer,
			});

			renderer.setColourChoices(COLOUR_OPTIONS);
			options.setRenderPerformance(renderer);

			options.addEventForwarding(this);
			visualOptions.addEventForwarding(this);

			this.focussed = [];

			this.addVisualisationChild(options, {screensaver: false});
			this.addVisualisationChild(this.board);
			this.addVisualisationChild(visualOptions, {screensaver: false});
			this.addChild(table);
			this.addChild(renderer);
		}

		clear() {
			super.clear();
			this.markers.clear();
			this.board.repaint();
		}

		updatePlayConfig(config) {
			super.updatePlayConfig(config);
		}

		updateGameConfig(config) {
			super.updateGameConfig(config);
			this.board.repaint();
		}

		updateDisplayConfig(config) {
			super.updateDisplayConfig(config);

			this.board.setScale(config.scale);

			if(
				!arrayUtils.shallowEqual(config.focussed, this.focussed)
			) {
				this.focussed = config.focussed.slice();
				this.repositionMarkers();
			}

			this.board.repaint();
		}

		updateState(state) {
			super.updateState(state);

			this.repositionMarkers();
			this.board.repaint();
		}

		repositionMarkers() {
			this.markers.clear();

			if(this.focussed.length && this.latestState.teams) {
				this.latestState.teams.forEach((teamStatus) => {
					teamStatus.entries.forEach((entryStatus) => {
						if(this.focussed.indexOf(entryStatus.id) === -1) {
							return;
						}
						this.markers.mark('bot-' + entryStatus.id, {
							x: entryStatus.x,
							y: entryStatus.y,
							className: 'bot-locator-pointer' + (entryStatus.alive ? '' : ' dead'),
							wrap: false,
							clip: false,
						});
					});
				});
			}
		}

		dom() {
			return this.root;
		}
	};
});
