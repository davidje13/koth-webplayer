define(['core/document_utils', './BoardRenderer', 'display/Full2DBoard', 'display/Full3DBoard', './OptionsDisplay', './LeaderboardDisplay', './DisqualificationsDisplay'], (docutil, BoardRenderer, Full2DBoard, Full3DBoard, OptionsDisplay, LeaderboardDisplay, DisqualificationsDisplay) => {
	'use strict';

	// TODO:
	// * zoom window (follow ant / cursor)
	// * optional highlight for latest moved ant
	// * UI for following team's queen
	// * table sorting options
	// * animate from 2D to 3D according to proportion3D instead of showing both

	const COLOUR_OPTIONS = {
		saturated: {
			name: 'Saturated',
			palette: [
				[255, 255, 255, 255],
				[255, 255,   0, 255],
				[255,   0, 255, 255],
				[  0, 255, 255, 255],
				[255,   0,   0, 255],
				[  0, 255,   0, 255],
				[  0,   0, 255, 255],
				[  0,   0,   0, 255],

				[  0,   0,   0, 255], // food
				[  0,   0,   0, 255], // ant
			],
		},
		muted: {
			name: 'Colour-Blind Assist',
			palette: [
				[255, 255, 255, 255],
				[240, 228,  66, 255],
				[204, 121, 167, 255],
				[ 86, 180, 233, 255],
				[213,  94,   0, 255],
				[  0, 158, 115, 255],
				[  0, 114, 178, 255],
				[  0,   0,   0, 255],

				[  0,   0,   0, 255], // food
				[  0,   0,   0, 255], // ant
			],
		},
		grey: {
			name: 'Greyscale',
			palette: [
				[255, 255, 255, 255],
				[218, 218, 218, 255],
				[181, 181, 181, 255],
				[144, 144, 144, 255],
				[108, 108, 108, 255],
				[ 72,  72,  72, 255],
				[ 36,  36,  36, 255],
				[  0,   0,   0, 255],

				[  0,   0,   0, 255], // food
				[  0,   0,   0, 255], // ant
			],
		},
	};

	return class Display {
		constructor() {
			this.renderer = new BoardRenderer();
			this.options = new OptionsDisplay();
			this.board2D = new Full2DBoard(this.renderer, 0);
			this.board3D = new Full3DBoard(this.renderer, 200, 200);
			this.table = new LeaderboardDisplay();
			this.errors = new DisqualificationsDisplay();
			this.renderer.setColourChoices(COLOUR_OPTIONS);
			this.options.setColourChoices(COLOUR_OPTIONS);
			this.options.setRenderPerformance(this.renderer);

			this.root = docutil.make('section', {'class': 'game-container'}, [
				this.options.dom(),
				this.board2D.dom(),
				this.board3D.dom(),
				this.table.dom(),
				this.errors.dom(),
			]);
		}

		clear() {
			this.options.clear();
			this.renderer.clear();
			this.table.clear();
			this.errors.clear();

			this.board2D.removeAllMarks();
			this.board2D.repaint();

			this.board3D.removeAllMarks();
			this.board3D.repaint();
		}

		updatePlayConfig(config) {
			this.options.updatePlayConfig(config);
		}

		updateGameConfig(config) {
			this.options.updateGameConfig(config);
			this.renderer.updateGameConfig(config);
			this.table.updateGameConfig(config);
			this.errors.updateGameConfig(config);

			this.board2D.repaint();
			this.board3D.repaint();
		}

		updateDisplayConfig(config) {
			this.options.updateDisplayConfig(config);
			this.renderer.updateDisplayConfig(config);
			this.table.updateDisplayConfig(config);
			this.errors.updateDisplayConfig(config);

			this.board2D.setScale(config.scale);
			this.board2D.repaint();

			this.board3D.wireframe = config.wireframe;
			this.board3D.repaint();
		}

		updateState(state) {
			this.options.updateState(state);
			this.renderer.updateState(state);
			this.table.updateState(state);
			this.errors.updateState(state);

			this.board2D.repaint();
			this.board3D.repaint();

//			for(let i = 0; i < state.entries.length; ++ i) {
//				const entry = state.entries[i];
//				const ant = state.ants[entry.queen];
//				this.board2D.mark(i, {
//					x: ant.x,
//					y: ant.y,
//					className: 'queen-locator',
//					wrap: false,
//					clip: false,
//				});
//			}
//			const QUEEN = 5;
//			for(let i = 0; i < state.ants.length; ++ i) {
//				const ant = state.ants[i];
//				this.board2D.mark('ant-' + ant.id, {
//					x: ant.x,
//					y: ant.y,
//					className: (ant.type === QUEEN) ? 'queen-locator' : 'worker-locator',
//					wrap: false,
//					clip: false,
//				});
//			}
		}

		dom() {
			return this.root;
		}
	};
});
