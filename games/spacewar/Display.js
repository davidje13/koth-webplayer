define([
	'core/arrayUtils',
	'display/documentUtils',
	'display/MarkerStore',
	'display/FullSwitchingBoard',
	'display/OptionsBar',
	'./GameScorer',
	'games/common/BaseDisplay',
	'games/common/components/LeaderboardDisplay',
	'games/common/components/StepperOptions',
	'./components/BoardRenderer',
	'games/common/style.css',
	'./style.css',
], (
	arrayUtils,
	docutil,
	MarkerStore,
	FullSwitchingBoard,
	OptionsBar,
	GameScorer,
	BaseDisplay,
	LeaderboardDisplay,
	StepperOptions,
	BoardRenderer
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
		paper: {
			name: 'Paper',
			palette: [
				{
					background:   [255, 255, 255, 255],
					sunOutline:   [128,  96,  64, 255],
					sunFill:      [255, 192,   0, 128],
				},
				{ // Unknown player
					outline:      [ 64,  64,  64, 255],
					fill:         [255, 255, 255, 128],
					flameOutline: [ 64,  64,  64, 192],
					flameFill:    [255, 255, 255, 192],
					deadFill:     [128, 128, 128, 255],
					missile:      [ 64,  64,  64, 255],
				},
				{ // Player 1
					outline:      [128,  64,  64, 255],
					fill:         [255,   0,   0, 128],
					flameOutline: [128,  64,  64, 192],
					flameFill:    [255, 230, 210, 192],
					deadFill:     [255, 128, 128, 255],
					missile:      [128,  64,  64, 255],
				},
				{ // Player 2
					outline:      [ 64,  64, 128, 255],
					fill:         [  0,   0, 255, 128],
					flameOutline: [ 64,  64, 128, 192],
					flameFill:    [220, 220, 255, 192],
					deadFill:     [128, 128, 255, 255],
					missile:      [ 64,  64, 128, 255],
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

	return class Display extends BaseDisplay {
		constructor(mode) {
			super(mode);

			const renderer = new BoardRenderer();
			const options = new StepperOptions(StepperOptions.makeSpeedButtons({
				'-3': {delay: 240, speed: 1},
				'-2': {delay: 120, speed: 1},
				'-1': {delay: 60, speed: 1},
				'0': {delay: 30, speed: 1},
				'1': {delay: 6, speed: 1},
				'2': {delay: 0, speed: 1},
				'3': {delay: 0, speed: 10, checkbackInterval: 250, maxDuration: 1000},
			}, {stepSingle: false}));
			this.markers = new MarkerStore();
			this.board = new FullSwitchingBoard({
				renderer,
				markerStore: this.markers,
				begin3D: null,
				scaleX: 0,
			});
			const visualOptions = new OptionsBar('changedisplay', [
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
			visualOptions.updateDisplayConfig = visualOptions.updateAttributes;

			const table = new LeaderboardDisplay({
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

			options.addEventForwarding(this);
			visualOptions.addEventForwarding(this);

			renderer.setColourChoices(COLOUR_OPTIONS);
			options.setRenderPerformance(renderer);
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
			this.board.setWireframe(config.wireframe);
			this.board.switch3D(config.view3D, true);

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

			if(this.latestGameConfig.sun) {
				const sun = this.latestGameConfig.sun;
				this.markers.mark('sun', {
					x: sun.x - sun.radius,
					y: sun.y - sun.radius,
					w: sun.radius * 2,
					h: sun.radius * 2,
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
