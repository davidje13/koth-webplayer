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
	'games/common/style.css',
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

	return class Display extends BaseDisplay {
		constructor(mode) {
			super(mode);

			const renderer = new BoardRenderer();
			const options = new StepperOptions(StepperOptions.makeSpeedButtons({
				'-3': {delay: 400, speed: 1},
				'-2': {delay: 200, speed: 1},
				'-1': {delay: 50, speed: 1},
				'0': {delay: 10, speed: 1},
				'1': {delay: 0, speed: 1},
				'2': {delay: 0, speed: 100},
				'3': {delay: 0, speed: 500},
			}));
			const visualOptions = new OptionsBar('changedisplay', [
				{attribute: 'scale', values: [
					{value: 0.25, label: '4:1'},
					{value: 0.5, label: '2:1'},
					{value: 1, label: '1:1'},
					{value: 2, label: '1:2'},
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
					title: 'Jailed?',
					generator: (entry) => (entry.captured ? 'yes' : 'no'),
				}, {
					title: 'Has Flag?',
					generator: (entry) => (entry.hasFlag ? 'yes' : 'no'),
				}, {
					title: 'Captures',
					generator: (entry) => (entry.captures),
				}, {
					title: 'Strength',
					generator: (entry) => (entry.strength.toFixed(1)),
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

			if(!this.latestState.teams) {
				return;
			}
			this.latestState.teams.forEach((teamStatus) => {
				this.markers.mark('zone-' + teamStatus.id, {
					x: teamStatus.captureZone.x,
					y: teamStatus.captureZone.y,
					w: teamStatus.captureZone.w,
					h: teamStatus.captureZone.h,
					className: 'zone ' + teamStatus.id,
					wrap: false,
					clip: false,
				});
				this.markers.mark('spawn-' + teamStatus.id, {
					x: teamStatus.spawn.x,
					y: teamStatus.spawn.y,
					w: teamStatus.spawn.w,
					h: teamStatus.spawn.h,
					className: 'spawn ' + teamStatus.id,
					wrap: false,
					clip: false,
				});
				teamStatus.entries.forEach((entryStatus) => {
					let className = 'bot ' + teamStatus.id;
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
				this.markers.mark('flag-' + teamStatus.id, {
					x: teamStatus.flag.x,
					y: teamStatus.flag.y,
					className: 'flag ' + teamStatus.id,
					wrap: false,
					clip: false,
				});
				this.markers.mark('jail-' + teamStatus.id, {
					x: teamStatus.jail.x,
					y: teamStatus.jail.y,
					className: 'jail ' + teamStatus.id,
					wrap: false,
					clip: false,
				});
			});
		}

		dom() {
			return this.root;
		}
	};
});
