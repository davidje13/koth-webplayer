define([
	'core/EventObject',
	'display/document_utils',
	'display/MarkerStore',
	'display/Full2DBoard',
	'display/OptionsBar',
	'games/common/components/StepperOptions',
	'games/common/components/DisqualificationsDisplay',
	'./components/BoardRenderer',
	'./components/LeaderboardDisplay',
	'games/common/style.css',
	'./style.css',
], (
	EventObject,
	docutil,
	MarkerStore,
	Full2DBoard,
	OptionsBar,
	StepperOptions,
	DisqualificationsDisplay,
	BoardRenderer,
	LeaderboardDisplay,
) => {
	'use strict';

	const COLOUR_OPTIONS = {
		saturated: {
			name: 'Saturated',
			palette: [
				[255, 255, 255, 255],
				[  0,   0,   0, 255],

				[255, 255,   0, 255], // Unknown entry
				[  0,   0, 255, 255], // Player 1
				[255,   0,   0, 255], // Player 2
			],
		},
		bluered: {
			name: 'Blue & Red',
			palette: [
				[224, 224, 224, 255],
				[ 96,  96,  96, 255],

				[255, 255,   0, 255], // Unknown entry
				[ 32,  64, 255, 255], // Player 1
				[255,  64,  32, 255], // Player 2
			],
		},
	};

	const COLOUR_OPTIONS_SELECT = [];
	for(let i in COLOUR_OPTIONS) {
		if(COLOUR_OPTIONS.hasOwnProperty(i)) {
			COLOUR_OPTIONS_SELECT.push({value: i, label: COLOUR_OPTIONS[i].name});
		}
	}

	return class Display extends EventObject {
		constructor() {
			super();

			this.renderer = new BoardRenderer();
			this.options = new StepperOptions([
				{
					label: '\u25A0',
					title: 'Pause',
					event: 'changeplay',
					params: [{delay: 0, speed: 0}],
				}, {
					label: '>>',
					title: 'Step Frame',
					event: 'step',
					params: [null, 1],
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
					params: [{delay: 10, speed: 1}],
				}, {
					label: '\u25B6\u25B6',
					title: 'Play Fast',
					event: 'changeplay',
					params: [{delay: 0, speed: 1}],
				}, {
					label: '\u25B6\u25B6\u25B6',
					title: 'Play Very Fast',
					event: 'changeplay',
					params: [{delay: 0, speed: 25}],
				}, {
					label: '\u25B6\u25B6\u25B6\u25B6',
					title: 'Play Crazy Fast',
					event: 'changeplay',
					params: [{delay: 0, speed: 50}],
				}, {
					label: '\u25B6!',
					title: 'Fastest Possible',
					event: 'changeplay',
					params: [{delay: 0, speed: -1}],
				},
			]);
			this.visualOptions = new OptionsBar('changedisplay', [
				{attribute: 'colourscheme', values: COLOUR_OPTIONS_SELECT},
				{attribute: 'scale', values: [
					{value: 1, label: '1:1'},
					{value: 2, label: '1:2'},
					{value: 3, label: '1:3'},
					{value: 4, label: '1:4'},
					{value: 5, label: '1:5'},
				]},
				{attribute: 'targetMarkerType', label: 'Target marker', values: [
					{value: '', label: 'None'},
					{value: 'ring', label: 'Ring'},
				]},
			]);
			this.markers = new MarkerStore();
			this.board = new Full2DBoard({
				renderer: this.renderer,
				markerStore: this.markers,
				scaleX: 0
			});
			this.table = new LeaderboardDisplay();
			this.errors = new DisqualificationsDisplay();
			this.renderer.setColourChoices(COLOUR_OPTIONS);
			this.options.setRenderPerformance(this.renderer);

			this.options.addEventForwarding(this);
			this.visualOptions.addEventForwarding(this);

			this.latestTarget = null;
			this.targetMarkerType = '';

			this.root = docutil.make('section', {'class': 'game-container'}, [
				this.options.dom(),
				this.board.dom(),
				this.visualOptions.dom(),
				this.table.dom(),
				this.errors.dom(),
			]);
		}

		clear() {
			this.renderer.clear();
			this.table.clear();
			this.errors.clear();

			this.markers.clear();
			this.board.repaint();
		}

		updatePlayConfig(config) {
			this.options.updatePlayConfig(config);
		}

		updateGameConfig(config) {
			this.options.updateGameConfig(config);
			this.renderer.updateGameConfig(config);
			this.table.updateGameConfig(config);
			this.errors.updateGameConfig(config);
			this.latestW = config.width;
			this.latestH = config.height;

			this.board.repaint();
		}

		updateDisplayConfig(config) {
			this.visualOptions.updateAttributes(config);
			this.renderer.updateDisplayConfig(config);

			this.board.setScale(config.scale);

			if(config.targetMarkerType !== this.targetMarkerType) {
				this.targetMarkerType = config.targetMarkerType;
				this.repositionMarkers();
			}

			this.board.repaint();
		}

		updateState(state) {
			this.options.updateState(state);
			this.renderer.updateState(state);
			this.table.updateState(state);
			this.errors.updateState(state);

			this.latestTarget = state.target;
			this.repositionMarkers();

			this.board.repaint();
		}

		repositionMarkers() {
			this.markers.clear();

			if(this.targetMarkerType && this.latestTarget) {
				this.markers.mark('target', {
					x: this.latestTarget.x,
					y: this.latestTarget.y,
					className: 'target-locator-' + this.targetMarkerType,
					wrap: false,
					clip: false,
				});
			}
		}

		dom() {
			return this.root;
		}
	};
});
