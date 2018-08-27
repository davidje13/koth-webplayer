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
		saturated: {
			name: 'Saturated',
			palette: [
				[255, 255, 255, 255],
				[  0,   0,   0, 255],

				[255, 255,   0, 255], // Unknown entry
				[  0,   0, 255, 255], // Player 1
				[255,   0,   0, 255], // Player 2
				[  0, 255,   0, 255], // Extra player 3
				[  0, 255, 255, 255], // Extra player 4
				[255,   0, 255, 255], // Extra player 5
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
				[ 64, 255,  32, 255], // Extra player 3
				[ 32, 224, 255, 255], // Extra player 4
				[255,  32, 224, 255], // Extra player 5
			],
		},
	};

	const COLOUR_OPTIONS_SELECT = [];
	for(let i in COLOUR_OPTIONS) {
		if(COLOUR_OPTIONS.hasOwnProperty(i)) {
			COLOUR_OPTIONS_SELECT.push({value: i, label: COLOUR_OPTIONS[i].name});
		}
	}

	function paletteLabelDecorator(entry, entryIndex, teamIndex, data) {
		const scheme = data.colourChoices[data.colourscheme];
		if(!scheme) {
			return entry.title;
		}
		const palette = scheme.palette;
		const colSample = docutil.make('div', {'class': 'colour-sample'});
		const c = palette[teamIndex + 3] || palette[2];
		docutil.updateStyle(colSample, {
			background: 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')',
		});
		return docutil.make('span', {}, [colSample, entry.title]);
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
				'2': {delay: 0, speed: 25, checkbackInterval: 250, maxDuration: 500},
				'3': {delay: 0, speed: 50, checkbackInterval: 500, maxDuration: 1000},
			}, {stepSingle: false}));
			const visualOptions = new OptionsBar('changedisplay', [
				{attribute: 'colourscheme', values: COLOUR_OPTIONS_SELECT},
				{attribute: 'scale', values: [
					{value: 1, label: '1:1'},
					{value: 2, label: '1:2'},
					{value: 3, label: '1:3'},
					{value: 4, label: '1:4'},
					{value: 5, label: '1:5'},
					{value: 6, label: '1:6'},
				]},
				{attribute: 'targetMarkerType', label: 'Target marker', values: [
					{value: '', label: 'None'},
					{value: 'ring', label: 'Ring'},
				]},
			]);
			visualOptions.updateDisplayConfig = visualOptions.updateAttributes;

			this.markers = new MarkerStore();
			this.board = new Full2DBoard({
				renderer,
				markerStore: this.markers,
				scaleX: 0,
			});

			this.table = new LeaderboardDisplay({
				columns: [{
					title: 'Points',
					generator: (entry) => (entry.points),
				}],
				GameScorer,
				labelDecorator: paletteLabelDecorator,
			});
			this.table.setCustomData({colourChoices: COLOUR_OPTIONS});

			renderer.setColourChoices(COLOUR_OPTIONS);
			options.setRenderPerformance(renderer);

			options.addEventForwarding(this);
			visualOptions.addEventForwarding(this);

			this.targetMarkerType = '';
			this.focussed = [];

			this.addVisualisationChild(options, {screensaver: false});
			this.addVisualisationChild(this.board);
			this.addVisualisationChild(visualOptions, {screensaver: false});
			this.addChild(this.table);
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
			this.table.setCustomData({colourscheme: config.colourscheme});

			this.board.setScale(config.scale);

			if(
				config.targetMarkerType !== this.targetMarkerType ||
				!arrayUtils.shallowEqual(config.focussed, this.focussed)
			) {
				this.targetMarkerType = config.targetMarkerType;
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

			if(this.targetMarkerType && this.latestState.target) {
				this.markers.mark('target', {
					x: this.latestState.target.x,
					y: this.latestState.target.y,
					className: 'target-locator-' + this.targetMarkerType,
					wrap: false,
					clip: false,
				});
			}

			if(this.focussed.length && this.latestState.teams) {
				this.latestState.teams.forEach((teamStatus) => {
					teamStatus.entries.forEach((entryStatus) => {
						if(this.focussed.indexOf(entryStatus.id) === -1) {
							return;
						}
						entryStatus.bots.forEach((bot, index) => {
							this.markers.mark('bot-' + entryStatus.id + '-' + index, {
								x: bot.x,
								y: bot.y,
								className: 'bot-locator-pointer' + (bot.hasWall ? ' wall' : ''),
								content: String(index),
								wrap: false,
								clip: false,
							});
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
