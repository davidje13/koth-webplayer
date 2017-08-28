define([
	'core/EventObject',
	'3d/ModelPoint',
	'3d/ModelTorus',
	'display/document_utils',
	'display/MarkerStore',
	'display/MarkerTypes3D',
	'display/FullSwitchingBoard',
	'display/OptionsBar',
	'games/common/components/StepperOptions',
	'./components/BoardRenderer',
	'./components/LeaderboardDisplay',
	'games/common/style.css',
	'./style.css',
], (
	EventObject,
	ModelPoint,
	ModelTorus,
	docutil,
	MarkerStore,
	MarkerTypes3D,
	FullSwitchingBoard,
	OptionsBar,
	StepperOptions,
	BoardRenderer,
	LeaderboardDisplay,
) => {
	'use strict';

	const FOOD_BIT = 0x08;

	// TODO:
	// * zoom window (follow ant / cursor)
	// * optional highlight for latest moved ant
	// * UI for following team's queen
	// * table sorting options

	const QUEEN = 5;

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

	const COLOUR_OPTIONS_SELECT = [];
	for(let i in COLOUR_OPTIONS) {
		if(COLOUR_OPTIONS.hasOwnProperty(i)) {
			COLOUR_OPTIONS_SELECT.push({value: i, label: COLOUR_OPTIONS[i].name});
		}
	}

	return class Display extends EventObject {
		constructor() {
			super();

			this.renderer = new BoardRenderer();
			this.options = new StepperOptions();

			this.visualOptions = new OptionsBar('changedisplay', [
				{attribute: 'colourscheme', values: COLOUR_OPTIONS_SELECT},
				{attribute: 'view3D', values: [
					{value: false, label: '2D'},
					{value: true, label: '3D'},
				]},
				{attribute: 'queenMarkerType', label: 'Queen marker', values: [
					{value: '', label: 'None'},
					{value: 'ring', label: 'Ring'},
					{value: 'pointer', label: 'Pointer'},
				]},
				{attribute: 'workerMarkerType', label: 'Worker marker', values: [
					{value: '', label: 'None'},
					{value: 'pointer', label: 'Pointer'},
				]},
				{attribute: 'foodMarkerType', label: 'Food marker', values: [
					{value: '', label: 'None'},
					{value: 'pointer', label: 'Pointer'},
				]},
			]);
			this.markers = new MarkerStore();
			this.markerTypes3D = new MarkerTypes3D();
			this.board = new FullSwitchingBoard({
				renderer: this.renderer,
				markerStore: this.markers,
				markerTypes3D: this.markerTypes3D,
				begin3D: null,
				scaleX: 0
			});
			this.table = new LeaderboardDisplay();
			this.renderer.setColourChoices(COLOUR_OPTIONS);
			this.options.setRenderPerformance(this.renderer);

			this.options.addEventForwarding(this);
			this.visualOptions.addEventForwarding(this);

			this.latestAnts = null;
			this.latestBoard = null;
			this.latestEntries = new Map();
			this.latestW = 0;
			this.latestH = 0;
			this.queenMarkerType = '';
			this.workerMarkerType = '';
			this.foodMarkerType = '';

			this.markerTypes3D.registerPointer('queen-locator-ring', {
				model: new ModelTorus({
					uv: false,
					stride: 6,
					segsX: 16,
					segsY: 8,
					rad1: 0.012,
					rad2A: 0.005,
					rad2B: 0.005,
				}),
				params: {
					shadowStr: 0.8,
					shadowCol: [0.0, 0.02, 0.03],
					col: [1, 0.5, 0],
				},
			});
			this.markerTypes3D.registerPointer('queen-locator-pointer', {
				params: {
					shadowStr: 0.8,
					shadowCol: [0.0, 0.02, 0.03],
					col: [1, 0.5, 0],
				},
			});
			this.markerTypes3D.registerPointer('worker-locator-pointer', {
				model: new ModelPoint({
					uv: false,
					stride: 6,
					radius: 0.01,
					height: 0.02,
				}),
				params: {
					shadowStr: 0.8,
					shadowCol: [0.0, 0.02, 0.03],
					col: [0, 0.5, 1],
				},
			});
			this.markerTypes3D.registerPointer('food-locator-pointer', {
				model: new ModelPoint({
					uv: false,
					stride: 6,
					radius: 0.005,
					height: 0.01,
				}),
				params: {
					shadowStr: 0.8,
					shadowCol: [0.0, 0.02, 0.03],
					col: [0.2, 0.2, 0.2],
				},
			});

			const entryEditButton = docutil.make('button', {'class': 'entry-edit-button'}, ['Edit Entries']);
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
			this.latestAnts = null;
			this.latestBoard = null;
			this.latestEntries.clear();

			this.renderer.clear();
			this.table.clear();

			this.markers.clear();
			this.board.repaint();
		}

		updatePlayConfig(config) {
			this.options.updatePlayConfig(config);
		}

		updateGameConfig(config) {
			this.options.updateGameConfig(config);
			this.renderer.updateGameConfig(config);
			this.table.updateGameConfig(config);
			this.latestW = config.width;
			this.latestH = config.height;

			this.latestEntries.clear();
			config.teams.forEach((team) => team.entries.forEach((entry) => {
				this.latestEntries.set(entry.id, entry);
			}));

			this.repositionMarkers();
			this.board.repaint();
		}

		updateDisplayConfig(config) {
			this.visualOptions.updateAttributes(config);
			this.renderer.updateDisplayConfig(config);

			this.board.setScale(config.scale);
			this.board.setWireframe(config.wireframe);
			this.board.switch3D(config.view3D, true);

			if(
				config.queenMarkerType !== this.queenMarkerType ||
				config.workerMarkerType !== this.workerMarkerType ||
				config.foodMarkerType !== this.foodMarkerType
			) {
				this.queenMarkerType = config.queenMarkerType;
				this.workerMarkerType = config.workerMarkerType;
				this.foodMarkerType = config.foodMarkerType;
				this.repositionMarkers();
			}

			this.board.repaint();
		}

		updateState(state) {
			this.options.updateState(state);
			this.renderer.updateState(state);
			this.table.updateState(state);

			this.latestAnts = state.ants;
			this.latestBoard = state.board;

			this.repositionMarkers();
			this.board.repaint();
		}

		repositionMarkers() {
			this.markers.clear();

			if(this.foodMarkerType && this.latestBoard) {
				const ww = this.latestW;
				const hh = this.latestH;
				const board = this.latestBoard;
				for(let y = 0; y < hh; ++ y) {
					for(let x = 0; x < ww; ++ x) {
						if(board[y * ww + x] & FOOD_BIT) {
							this.markers.mark('food-' + x + '-' + y, {
								x,
								y,
								className: 'food-locator-' + this.foodMarkerType,
								wrap: false,
								clip: false,
							});
						}
					}
				}
			}
			if((this.queenMarkerType || this.workerMarkerType) && this.latestAnts) {
				let anyFocussed = false;
				this.latestEntries.forEach((entry) => {
					if(entry.focussed) {
						anyFocussed = true;
					}
				});
				this.latestAnts.forEach((ant) => {
					if(anyFocussed) {
						const entry = this.latestEntries.get(ant.entry);
						if(!entry || !entry.focussed) {
							return;
						}
					}
					let className = '';
					if(ant.type === QUEEN) {
						if(this.queenMarkerType) {
							className = 'queen-locator-' + this.queenMarkerType;
						}
					} else {
						if(this.workerMarkerType) {
							className = 'worker-locator-' + this.workerMarkerType;
						}
					}
					if(className) {
						this.markers.mark('ant-' + ant.id, {
							x: ant.x,
							y: ant.y,
							className,
							wrap: false,
							clip: false,
						});
					}
				});
			}
		}

		dom() {
			return this.root;
		}
	};
});
