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
	StepperOptions
) => {
	'use strict';

	class BoardRenderer {
		constructor() {
			this.size = 0;
		}

		clear() {
			this.size = 0;
		}

		updateState({size}) {
			this.size = size;
		}

		getSize() {
			return {
				width: this.size,
				height: this.size,
			};
		}
	}

	return class Display extends BaseDisplay {
		constructor(mode) {
			super(mode);

			const renderer = new BoardRenderer();
			const options = new StepperOptions(StepperOptions.makeSpeedButtons({
				'-3': {delay: 4000, speed: 1},
				'-2': {delay: 2000, speed: 1},
				'-1': {delay: 1000, speed: 1},
				'0': {delay: 500, speed: 1},
				'1': {delay: 150, speed: 1},
				'2': {delay: 50, speed: 1},
				'3': {delay: 1, speed: 1},
			}));
			const visualOptions = new OptionsBar('changedisplay', [
				{attribute: 'size', values: [
					{value: 300, label: '300x300'},
					{value: 600, label: '600x600'},
					{value: 1000, label: '1000x1000'},
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
					title: 'Current Bonus',
					generator: (entry) => (entry.lastBonus),
//				}, {
//					title: 'Current Colour',
//					generator: (entry) => (???),
				}],
				GameScorer,
			});

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

		refreshScale() {
			this.board.setScale(
				(this.latestDisplayConfig.size) /
				(this.latestState.size || 1)
			);
		}

		updateDisplayConfig(config) {
			super.updateDisplayConfig(config);

			this.refreshScale();

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

			this.refreshScale();

			this.repositionMarkers();
			this.board.repaint();
		}

		repositionMarkers() {
			this.markers.clear();

			if(!this.latestState.board || !this.latestState.teams) {
				return;
			}
			const size = this.latestState.size;
			for(let y = 0; y < size; ++ y) {
				for(let x = 0; x < size; ++ x) {
					const token = this.latestState.board[y * size + x];
					const value = Math.floor(token / this.latestGameConfig.colourNames.length);
					const col = (token % this.latestGameConfig.colourNames.length);
					this.markers.mark('cell-' + x + '-' + y, {
						x,
						y,
						w: 1,
						h: 1,
						className: (token ? ('token C' + col) : 'cell'),
						content: token ? String(value) : null,
						wrap: false,
						clip: false,
					});
				}
			}
			this.latestState.teams.forEach((teamStatus) => {
				teamStatus.entries.forEach((entryStatus) => {
					let className = 'bot';
					if(this.focussed.indexOf(entryStatus.id) !== -1) {
						className += ' focussed';
					}
					this.markers.mark('bot-' + entryStatus.id, {
						x: entryStatus.x,
						y: entryStatus.y,
						className: className,
						wrap: false,
						clip: false,
					});
				});
			});
		}

		dom() {
			return this.root;
		}
	};
});
