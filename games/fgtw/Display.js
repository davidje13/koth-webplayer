define([
	'core/EventObject',
	'core/arrayUtils',
	'display/documentUtils',
	'display/MarkerStore',
	'display/Full2DBoard',
	'games/common/components/StepperOptions',
	'./components/LeaderboardDisplay',
	'games/common/style.css',
	'./style.css',
], (
	EventObject,
	arrayUtils,
	docutil,
	MarkerStore,
	Full2DBoard,
	StepperOptions,
	LeaderboardDisplay
) => {
	'use strict';

	class BoardRenderer {
		constructor() {
			this.size = 0;
		}

		clear() {
			this.size = 0;
		}

		updateGameConfig({cells, teams}) {
			this.cells = cells;
			this.teams = teams.length;
		}

		getSize() {
			return {
				width: this.cells,
				height: this.teams,
			};
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
			this.markers = new MarkerStore();
			this.board = new Full2DBoard({
				renderer: this.renderer,
				markerStore: this.markers,
				scaleX: 0,
			});
			this.table = new LeaderboardDisplay();

			this.options.addEventForwarding(this);

			this.latestTeamStatuses = null;
			this.latestCells = 0;
			this.latestFrame = 0;
			this.latestCycle = 0;
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

			this.latestCells = config.cells;

			this.board.repaint();
		}

		updateDisplayConfig(config) {
			this.board.setScale(config.scaleX, config.scaleY);

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
			this.latestFrame = state.completedFrame;
			this.latestCycle = state.completedCycle;

			this.repositionMarkers();
			this.board.repaint();
		}

		repositionMarkers() {
			this.markers.clear();

			if(!this.latestTeamStatuses) {
				return;
			}
			for(let y = 0; y < this.latestTeamStatuses.length; ++ y) {
				for(let x = 0; x < this.latestCells; ++ x) {
					this.markers.mark('cell-' + x + '-' + y, {
						x,
						y,
						className: 'cell',
						wrap: false,
						clip: false,
					});
				}
			}
			this.latestTeamStatuses.forEach((teamStatus, teamIndex) => {
				teamStatus.entries.forEach((entryStatus) => {
					let className = entryStatus.alive ? 'player' : 'player dead';
					if(this.focussed.indexOf(entryStatus.id) !== -1) {
						className += ' focussed';
					}
					this.markers.mark('player-' + entryStatus.id, {
						x: entryStatus.cell - 1,
						y: teamIndex,
						className: className,
						wrap: false,
						clip: false,
					});
					const shots = entryStatus.shotHistory[this.latestFrame] || [];
					for(let i = 0; i < shots.length; ++ i) {
						this.markers.mark('shot-' + entryStatus.id + '-' + i, {
							x: entryStatus.cell - 1,
							y: teamIndex,
							toX: shots[i] - 1,
							toY: (teamIndex + 1) % this.latestTeamStatuses.length,
							className: (
								'shot' +
								(i === this.latestCycle - 1 ? ' latest' : '')
							),
							wrap: false,
							clip: false,
						});
					}
				});
			});
		}

		dom() {
			return this.root;
		}
	};
});
