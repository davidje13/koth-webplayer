define([
	'core/arrayUtils',
	'core/rateUtils',
	'3d/ModelPoint',
	'3d/ModelTorus',
	'display/documentUtils',
	'display/MarkerStore',
	'display/MarkerTypes3D',
	'display/FullSwitchingBoard',
	'display/OptionsBar',
	'./GameScorer',
	'games/common/BaseDisplay',
	'games/common/components/LeaderboardDisplay',
	'games/common/components/StepperOptions',
	'./components/BoardRenderer',
	'./components/ZoomedBoard',
	'./style.css',
], (
	arrayUtils,
	rateUtils,
	ModelPoint,
	ModelTorus,
	docutil,
	MarkerStore,
	MarkerTypes3D,
	FullSwitchingBoard,
	OptionsBar,
	GameScorer,
	BaseDisplay,
	LeaderboardDisplay,
	StepperOptions,
	BoardRenderer,
	ZoomedBoard
) => {
	'use strict';

	const FOOD_BIT = 0x08;

	const QUEEN = 5;
	const WORKER_COUNT = 4;

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

	function hasFood(cell) {
		/* jshint -W016 */ // allow bitwise operation
		return cell & FOOD_BIT;
	}

	function make3DMarkers() {
		const target = new MarkerTypes3D();

		target.registerPointer('queen-locator-ring', {
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
		target.registerPointer('queen-locator-pointer', {
			params: {
				shadowStr: 0.8,
				shadowCol: [0.0, 0.02, 0.03],
				col: [1, 0.5, 0],
			},
		});
		target.registerPointer('worker-locator-pointer', {
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
		target.registerPointer('next-mover-locator-pointer', {
			model: new ModelPoint({
				uv: false,
				stride: 6,
				radius: 0.02,
				height: 0.06,
			}),
			params: {
				shadowStr: 0.8,
				shadowCol: [0.0, 0.02, 0.03],
				col: [0.3, 0.3, 0.3],
			},
		});
		target.registerPointer('food-locator-pointer', {
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

		return target;
	}

	return class Display extends BaseDisplay {
		constructor(mode) {
			super(mode);

			const renderer = new BoardRenderer();
			const options = new StepperOptions(StepperOptions.makeSpeedButtons({
				'-3': {delay: 1000, speed: 1},
				'-2': {delay: 500, speed: 1},
				'-1': {delay: 250, speed: 1},
				'0': {delay: 0, speed: 1},
				'1': {delay: 0, speed: 10},
				'2': {delay: 0, speed: 50},
				'3': {delay: 0, speed: 500},
			}));

			const visualOptions = new OptionsBar('changedisplay', [
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
				{attribute: 'nextMoverMarkerType', label: 'Next mover marker', values: [
					{value: '', label: 'None'},
					{value: 'pointer', label: 'Pointer'},
				]},
				{attribute: 'foodMarkerType', label: 'Food marker', values: [
					{value: '', label: 'None'},
					{value: 'pointer', label: 'Pointer'},
				]},
			]);
			visualOptions.updateDisplayConfig = visualOptions.updateAttributes;

			this.markers = new MarkerStore();
			this.board = new FullSwitchingBoard({
				renderer,
				markerStore: this.markers,
				markerTypes3D: make3DMarkers(),
				begin3D: null,
				scaleX: 0,
			});
			this.zoomedBoard = new ZoomedBoard({
				width: 32,
				height: 32,
				scaleX: 16,
			});

			const table = new LeaderboardDisplay({
				columns: [{
					title: 'Food',
					generator: (entry) => (entry.food),
				}, {
					title: 'Workers',
					nested: arrayUtils.makeList(WORKER_COUNT).map((v, i) => ({
						title: 'Type ' + (i + 1),
						attribute: 'type' + i,
						generator: (entry) => (entry.workers[i]),
					})),
				}],
				GameScorer,
			});

			renderer.setColourChoices(COLOUR_OPTIONS);
			this.zoomedBoard.setColourChoices(COLOUR_OPTIONS);
			options.setRenderPerformance(renderer);

			options.addEventForwarding(this);
			visualOptions.addEventForwarding(this);

			this.queenMarkerType = '';
			this.workerMarkerType = '';
			this.nextMoverMarkerType = '';
			this.foodMarkerType = '';
			this.focussed = [];
			this.zoomTracking = true;

			this.addVisualisationChild(options, {screensaver: false});
			this.addVisualisationChild(this.zoomedBoard, {screensaver: false});
			this.addVisualisationChild(this.board);
			this.addVisualisationChild(visualOptions, {screensaver: false});
			this.addChild(table);
			this.addChild(renderer);

			if(!mode.screensaver) {
				this._setupZoomWindow();
			}
		}

		_setupZoomWindow() {
			const throttledHover = rateUtils.throttle((x, y) => {
				if(!this.zoomTracking) {
					return;
				}
				if(this.zoomedBoard.setFocus(x, y)) {
					this.repositionMarkers();
					this.board.rerender();
				}
			});

			this.board.addEventListener('hover', throttledHover);
			this.board.addEventListener('hoveroff', () => {
				throttledHover.abort();
				if(!this.zoomTracking) {
					return;
				}
				if(this.zoomedBoard.setFocus(null)) {
					this.repositionMarkers();
					this.board.rerender();
				}
			});

			this.board.addEventListener('click', (x, y) => {
				this.zoomTracking = !this.zoomTracking;
				this.zoomedBoard.setClass(this.zoomTracking ? '' : 'fixed');
				throttledHover(x, y);
				this.repositionMarkers();
				this.board.rerender();
			});
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
			this.board.setWireframe(config.wireframe);
			this.board.switch3D(config.view3D, true);

			if(
				config.queenMarkerType !== this.queenMarkerType ||
				config.workerMarkerType !== this.workerMarkerType ||
				config.nextMoverMarkerType !== this.nextMoverMarkerType ||
				config.foodMarkerType !== this.foodMarkerType ||
				!arrayUtils.shallowEqual(config.focussed, this.focussed)
			) {
				this.queenMarkerType = config.queenMarkerType;
				this.workerMarkerType = config.workerMarkerType;
				this.nextMoverMarkerType = config.nextMoverMarkerType;
				this.foodMarkerType = config.foodMarkerType;
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

			if(this.zoomedBoard.hasFocus() && this.latestState.board) {
				this.markers.mark('zoom', {
					x: this.zoomedBoard.x - this.zoomedBoard.width / 2,
					y: this.zoomedBoard.y - this.zoomedBoard.height / 2,
					w: this.zoomedBoard.width,
					h: this.zoomedBoard.height,
					className: this.zoomTracking ? 'zoom-locator' : 'zoom-locator-fixed',
					wrap: true,
					clip: true,
				});
				const rhs = this.zoomedBoard.x < this.latestGameConfig.width / 2;
				this.zoomedBoard.setClass(rhs ? 'right' : 'left', 'side');
			} else {
				this.zoomedBoard.setClass(null, 'side');
			}

			if(this.foodMarkerType && this.latestState.board) {
				const ww = this.latestGameConfig.width;
				const hh = this.latestGameConfig.height;
				const board = this.latestState.board;
				for(let i = 0; i < ww * hh; ++ i) {
					if(hasFood(board[i])) {
						this.markers.mark('food-' + i, {
							x: i % ww,
							y: Math.floor(i / ww),
							className: 'food-locator-' + this.foodMarkerType,
							wrap: false,
							clip: false,
						});
					}
				}
			}
			if((
				this.queenMarkerType ||
				this.workerMarkerType ||
				this.nextMoverMarkerType
			) && this.latestState.ants) {
				this.latestState.ants.forEach((ant, index) => {
					if(this.focussed.length) {
						if(this.focussed.indexOf(ant.entry) === -1) {
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
					if(index === this.latestState.currentAnt && this.nextMoverMarkerType) {
						className = 'next-mover-locator-' + this.nextMoverMarkerType;
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
