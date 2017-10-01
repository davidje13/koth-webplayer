define([
	'core/arrayUtils',
	'display/documentUtils',
	'display/MarkerStore',
	'display/Full2DBoard',
	'./GameScorer',
	'games/common/BaseDisplay',
	'games/common/components/LeaderboardDisplay',
	'games/common/components/StepperOptions',
	'games/common/style.css',
	'./style.css',
], (
	arrayUtils,
	docutil,
	MarkerStore,
	Full2DBoard,
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
			}, {stepSingle: false}));
			this.markers = new MarkerStore();
			this.board = new Full2DBoard({
				renderer,
				markerStore: this.markers,
				scaleX: 0,
			});

			const table = new LeaderboardDisplay({
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

			options.addEventForwarding(this);

			this.focussed = [];

			this.addVisualisationChild(options, {screensaver: false});
			this.addVisualisationChild(this.board);
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
			super.updateState(state);
			this.repositionMarkers();
			this.board.repaint();
		}

		repositionMarkers() {
			this.markers.clear();

			if(!this.latestState.teams) {
				return;
			}
			for(let y = 0; y < this.latestState.teams.length; ++ y) {
				for(let x = 0; x < this.latestGameConfig.cells; ++ x) {
					this.markers.mark('cell-' + x + '-' + y, {
						x,
						y,
						className: 'cell',
						wrap: false,
						clip: false,
					});
				}
			}
			this.latestState.teams.forEach((teamStatus, teamIndex) => {
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
					const completedFrame = this.latestState.completedFrame;
					const completedCycle = this.latestState.completedCycle;
					const shots = entryStatus.shotHistory[completedFrame] || [];
					for(let i = 0; i < shots.length; ++ i) {
						this.markers.mark('shot-' + entryStatus.id + '-' + i, {
							x: entryStatus.cell - 1,
							y: teamIndex,
							toX: shots[i] - 1,
							toY: (teamIndex + 1) % this.latestState.teams.length,
							className: (
								'shot' +
								(i === completedCycle - 1 ? ' latest' : '')
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
