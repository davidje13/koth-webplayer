define([
	'core/EventObject',
	'core/arrayUtils',
	'display/documentUtils',
	'display/MarkerStore',
	'display/Full2DBoard',
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
		constructor(mode) {
			super();

			this.renderer = new BoardRenderer();
			this.options = new StepperOptions(StepperOptions.makeSpeedButtons({
				'-3': {delay: 4000, speed: 1},
				'-2': {delay: 2000, speed: 1},
				'-1': {delay: 1000, speed: 1},
				'0': {delay: 500, speed: 1},
				'1': {delay: 150, speed: 1},
				'2': {delay: 50, speed: 1},
				'3': {delay: 1, speed: 1},
			}, {stepSingle: false}));
			this.markers = new MarkerStore();
			this.board = new Full2DBoard({
				renderer: this.renderer,
				markerStore: this.markers,
				scaleX: 0,
			});

			this.table = new LeaderboardDisplay({
				columns: [{
					title: 'Alive?',
					generator: (entry) => (entry.alive ? 'yes' : 'no'),
				}, {
					title: 'Speed',
					generator: (entry) => (entry.speed),
				}, {
					title: 'Shots',
					generator: (entry) => (entry.shots),
				}, {
					title: 'Bullets',
					generator: (entry) => (entry.currentBullets + ' / ' + entry.bullets),
				}, {
					title: 'Reloading?',
					generator: (entry) => (entry.reloadCounter ? (
						((entry.reloadSpeed + 1 - entry.reloadCounter) +
						' / ' + entry.reloadSpeed)
					) : 'no'),
				}, {
					title: 'Kills',
					generator: (entry) => (entry.kills),
				}],
				GameScorer,
			});

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
					mode.screensaver ? null : this.options.dom(),
					this.board.dom(),
				]),
				this.table.dom(),
				mode.screensaver ? null : entryEditButton,
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
