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

	return class Display extends EventObject {
		constructor() {
			super();

			this.latestDisplaySize = 0;
			this.latestSize = 0;
			this.latestBoard = null;
			this.latestTeamStatuses = null;
			this.latestColourNames = [];

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
					params: [{delay: 4000, speed: 1}],
				}, {
					label: '\u00BC',
					title: 'Play 1/4 Speed',
					event: 'changeplay',
					params: [{delay: 2000, speed: 1}],
				}, {
					label: '\u00BD',
					title: 'Play 1/2 Speed',
					event: 'changeplay',
					params: [{delay: 1000, speed: 1}],
				}, {
					label: '\u25B6',
					title: 'Play',
					event: 'changeplay',
					params: [{delay: 500, speed: 1}],
				}, {
					label: '\u25B6\u25B6',
					title: 'Play Fast',
					event: 'changeplay',
					params: [{delay: 150, speed: 1}],
				}, {
					label: '\u25B6\u25B6\u25B6',
					title: 'Play Very Fast',
					event: 'changeplay',
					params: [{delay: 50, speed: 1}],
				}, {
					label: '\u25B6\u25B6\u25B6\u25B6',
					title: 'Play Crazy Fast',
					event: 'changeplay',
					params: [{delay: 1, speed: 1}],
				}, {
					label: '\u25B6!',
					title: 'Fastest Possible',
					event: 'changeplay',
					params: [{delay: 0, speed: -1}],
				},
			]);
			this.visualOptions = new OptionsBar('changedisplay', [
				{attribute: 'size', values: [
					{value: 300, label: '300x300'},
					{value: 600, label: '600x600'},
					{value: 1000, label: '1000x1000'},
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
					title: 'Current Bonus',
					generator: (entry) => (entry.lastBonus),
//				}, {
//					title: 'Current Colour',
//					generator: (entry) => (???),
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
			this.table.updateGameConfig(config);

			this.latestColourNames = config.colourNames;

			this.board.repaint();
		}

		refreshScale() {
			this.board.setScale(this.latestDisplaySize / (this.latestSize || 1));
		}

		updateDisplayConfig(config) {
			this.visualOptions.updateAttributes(config);
			this.latestDisplaySize = config.size;

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
			this.options.updateState(state);
			this.renderer.updateState(state);
			this.table.updateState(state);

			this.latestTeamStatuses = state.teams;
			this.latestSize = state.size;
			this.latestBoard = state.board;
			this.latestTeamStatuses = state.teams;

			this.refreshScale();

			this.repositionMarkers();
			this.board.repaint();
		}

		repositionMarkers() {
			this.markers.clear();

			if(!this.latestBoard || !this.latestTeamStatuses) {
				return;
			}
			for(let y = 0; y < this.latestSize; ++ y) {
				for(let x = 0; x < this.latestSize; ++ x) {
					const token = this.latestBoard[y * this.latestSize + x];
					const value = Math.floor(token / this.latestColourNames.length);
					const col = (token % this.latestColourNames.length);
					this.markers.mark('cell-' + x + '-' + y, {
						x,
						y,
						className: (token ? ('token C' + col) : 'cell'),
						content: token ? String(value) : null,
						wrap: false,
						clip: false,
					});
				}
			}
			this.latestTeamStatuses.forEach((teamStatus) => {
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
