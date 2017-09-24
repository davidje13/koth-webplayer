define([
	'core/EventObject',
	'core/arrayUtils',
	'display/documentUtils',
	'display/MarkerStore',
	'display/FullSwitchingBoard',
	'display/OptionsBar',
	'./GameScorer',
	'./components/BoardRenderer',
	'games/common/components/LeaderboardDisplay',
	'games/common/components/StepperOptions',
	'games/common/style.css',
	'./style.css',
], (
	EventObject,
	arrayUtils,
	docutil,
	MarkerStore,
	FullSwitchingBoard,
	OptionsBar,
	GameScorer,
	BoardRenderer,
	LeaderboardDisplay,
	StepperOptions
) => {
	'use strict';

	const COLOUR_OPTIONS = {
		space: {
			name: 'Space',
			palette: [
				{
					background:   [ 32,  32,  32, 255],
					sunOutline:   [255, 192,   0, 255],
					sunFill:      [255, 192,   0, 192],
				},
				{ // Unknown player
					outline:      [128, 128, 128, 255],
					fill:         [  0,   0,   0, 128],
					flameOutline: [255, 255, 255, 255],
					flameFill:    [255, 255, 255, 255],
					deadFill:     [128, 128, 128, 255],
					missile:      [255, 255, 255, 255],
				},
				{ // Player 1
					outline:      [255,   0,   0, 255],
					fill:         [255,   0,   0, 128],
					flameOutline: [255, 255, 255, 255],
					flameFill:    [255, 230, 210, 255],
					deadFill:     [255, 128, 128, 255],
					missile:      [255, 230, 210, 255],
				},
				{ // Player 2
					outline:      [  0,   0, 255, 255],
					fill:         [  0,   0, 255, 128],
					flameOutline: [255, 255, 255, 255],
					flameFill:    [220, 220, 255, 255],
					deadFill:     [128, 128, 255, 255],
					missile:      [220, 220, 255, 255],
				},
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
			this.options = new StepperOptions(StepperOptions.makeSpeedButtons({
				'-3': {delay: 240, speed: 1},
				'-2': {delay: 120, speed: 1},
				'-1': {delay: 60, speed: 1},
				'0': {delay: 30, speed: 1},
				'1': {delay: 6, speed: 1},
				'2': {delay: 0, speed: 1},
				'3': {delay: 0, speed: 10},
			}, {stepSingle: false}));
			this.markers = new MarkerStore();
			this.board = new FullSwitchingBoard({
				renderer: this.renderer,
				markerStore: this.markers,
				begin3D: null,
				scaleX: 0,
			});
			this.visualOptions = new OptionsBar('changedisplay', [
				{attribute: 'view3D', values: [
					{value: false, label: '2D'},
					{value: true, label: '3D'},
				]},
				{attribute: 'colourscheme', values: COLOUR_OPTIONS_SELECT},
				{attribute: 'scale', values: [
					{value: 0.5, label: '2:1'},
					{value: 1, label: '1:1'},
					{value: 2, label: '1:2'},
				]},
			]);

			this.table = new LeaderboardDisplay({
				columns: [{
					title: 'Missiles',
					generator: (entry) => (entry.missiles),
				}, {
					title: 'Ship Damage',
					generator: (entry) => (entry.alive ? (
						entry.leftWing ?
						(entry.rightWing ? 'none' : 'right wing') :
						(entry.rightWing ? 'left wing' : 'both wings')
					) : 'dead'),
				}, {
					title: 'Kills',
					generator: (entry) => (entry.kills),
				}, {
					title: 'Deaths',
					generator: (entry) => (entry.deaths),
				}, {
					title: 'Points',
					generator: (entry) => (entry.score),
				}],
				GameScorer,
			});

			this.options.addEventForwarding(this);
			this.visualOptions.addEventForwarding(this);

			this.renderer.setColourChoices(COLOUR_OPTIONS);
			this.options.setRenderPerformance(this.renderer);
			this.latestSun = null;
			this.focussed = [];

			const entryEditButton = docutil.make(
				'button',
				{'class': 'entry-edit-button'},
				['Edit Entries']
			);
			entryEditButton.addEventListener('click', () => {
				this.trigger('editentries');
			});

			this.root = docutil.make('section', {'class': 'game-container'}, [
				docutil.make('div', {'class': 'visualisation-container'}, [
					this.options.dom(),
					this.board.dom(),
					this.visualOptions.dom(),
				]),
				this.table.dom(),
				entryEditButton,
			]);
		}

		clear() {
			this.latestTeamStatuses = null;
			this.latestCells = 0;
			this.latestFrame = 0;
			this.latestCycle = 0;

			this.renderer.clear();
			this.table.clear();

			this.board.repaint();
		}

		updatePlayConfig(config) {
			this.options.updatePlayConfig(config);
		}

		updateGameConfig(config) {
			this.options.updateGameConfig(config);
			this.renderer.updateGameConfig(config);
			this.table.updateGameConfig(config);
			this.latestSun = config.sun;

			this.board.repaint();
		}

		updateDisplayConfig(config) {
			this.board.setScale(config.scale);
			this.board.setWireframe(config.wireframe);
			this.board.switch3D(config.view3D, true);

			this.renderer.updateDisplayConfig(config);
			this.visualOptions.updateAttributes(config);

			if(
				!arrayUtils.shallowEqual(config.focussed, this.focussed)
			) {
				this.focussed = config.focussed.slice();
				this.repositionMarkers();
			}

			this.board.repaint();
		}

		updateState(state) {
			this.options.updateState(state);
			this.table.updateState(state);
			this.renderer.updateState(state);

			this.repositionMarkers();
			this.board.repaint();
		}

		repositionMarkers() {
			this.markers.clear();

			if(this.latestSun) {
				this.markers.mark('sun', {
					x: this.latestSun.x - this.latestSun.radius,
					y: this.latestSun.y - this.latestSun.radius,
					w: this.latestSun.radius * 2,
					h: this.latestSun.radius * 2,
					className: 'sun',
					wrap: true,
					clip: true,
				});
			}
		}

		dom() {
			return this.root;
		}
	};
});
