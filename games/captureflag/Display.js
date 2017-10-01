define([
	'core/EventObject',
	'core/arrayUtils',
	'display/documentUtils',
	'display/MarkerStore',
	'display/Full2DBoard',
	'display/OptionsBar',
	'./GameScorer',
	'games/common/components/LeaderboardDisplay',
	'games/common/components/StepperOptions',
	'./components/BoardRenderer',
	'games/common/style.css',
	'./style.css',
], (
	EventObject,
	arrayUtils,
	docutil,
	MarkerStore,
	Full2DBoard,
	OptionsBar,
	GameScorer,
	LeaderboardDisplay,
	StepperOptions,
	BoardRenderer
) => {
	'use strict';

	return class Display extends EventObject {
		constructor(mode) {
			super();

			this.renderer = new BoardRenderer();
			this.options = new StepperOptions(StepperOptions.makeSpeedButtons({
				'-3': {delay: 400, speed: 1},
				'-2': {delay: 200, speed: 1},
				'-1': {delay: 50, speed: 1},
				'0': {delay: 10, speed: 1},
				'1': {delay: 0, speed: 1},
				'2': {delay: 0, speed: 100},
				'3': {delay: 0, speed: 500},
			}));
			this.visualOptions = new OptionsBar('changedisplay', [
				{attribute: 'scale', values: [
					{value: 0.25, label: '4:1'},
					{value: 0.5, label: '2:1'},
					{value: 1, label: '1:1'},
					{value: 2, label: '1:2'},
				]},
			]);
			this.markers = new MarkerStore();
			this.board = new Full2DBoard({
				renderer: this.renderer,
				markerStore: this.markers,
				scaleX: 0,
			});

			this.table = new LeaderboardDisplay({
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

			this.options.addEventForwarding(this);
			this.visualOptions.addEventForwarding(this);

			this.latestTeamStatuses = null;
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
					mode.screensaver ? null : this.options.dom(),
					this.board.dom(),
					mode.screensaver ? null : this.visualOptions.dom(),
				]),
				this.table.dom(),
				mode.screensaver ? null : entryEditButton,
			]);
		}

		clear() {
			this.latestTeamStatuses = null;

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

			this.board.repaint();
		}

		updateDisplayConfig(config) {
			this.visualOptions.updateAttributes(config);

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
			this.options.updateState(state);
			this.table.updateState(state);

			this.latestTeamStatuses = state.teams;

			this.repositionMarkers();
			this.board.repaint();
		}

		repositionMarkers() {
			this.markers.clear();

			if(!this.latestTeamStatuses) {
				return;
			}
			this.latestTeamStatuses.forEach((teamStatus) => {
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
