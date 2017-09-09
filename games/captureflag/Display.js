define([
	'core/EventObject',
	'core/arrayUtils',
	'display/documentUtils',
	'display/MarkerStore',
	'display/Full2DBoard',
	'display/OptionsBar',
	'games/common/components/StepperOptions',
	'./components/BoardRenderer',
	'./components/LeaderboardDisplay',
	'games/common/style.css',
	'./style.css',
], (
	EventObject,
	arrayUtils,
	docutil,
	MarkerStore,
	Full2DBoard,
	OptionsBar,
	StepperOptions,
	BoardRenderer,
	LeaderboardDisplay
) => {
	'use strict';

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
					label: '\u215B',
					title: 'Play 1/8 Speed',
					event: 'changeplay',
					params: [{delay: 400, speed: 1}],
				}, {
					label: '\u00BC',
					title: 'Play 1/4 Speed',
					event: 'changeplay',
					params: [{delay: 200, speed: 1}],
				}, {
					label: '\u00BD',
					title: 'Play 1/2 Speed',
					event: 'changeplay',
					params: [{delay: 50, speed: 1}],
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
					params: [{delay: 0, speed: 100}],
				}, {
					label: '\u25B6\u25B6\u25B6\u25B6',
					title: 'Play Crazy Fast',
					event: 'changeplay',
					params: [{delay: 0, speed: 500}],
				}, {
					label: '\u25B6!',
					title: 'Fastest Possible',
					event: 'changeplay',
					params: [{delay: 0, speed: -1}],
				},
			]);
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
			this.table = new LeaderboardDisplay();

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
				teamStatus.entries.forEach((entryStatus) => {
					let className = 'bot-locator-' + teamStatus.id;
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
					className: 'flag-locator-' + teamStatus.id,
					wrap: false,
					clip: false,
				});
				this.markers.mark('jail-' + teamStatus.id, {
					x: teamStatus.jail.x,
					y: teamStatus.jail.y,
					className: 'jail-locator-' + teamStatus.id,
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
