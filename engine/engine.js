'use strict';

// TODO:
// * match & tournament management
// * linkable URLs (seed hashes)
// * enable/disable/edit entries
// * add new entry
// * remember display config in local storage / cookies
// * remember custom entries in local storage (maybe)
// * team management

require([
	'core/document_utils',
	'display/Loader',
	'style.css',
], (
	docutil,
	Loader,
) => {
	const gameType = docutil.getMetaTagValue('game-type');
	const baseGame = JSON.parse(docutil.getMetaTagValue('game-config', '{}'));
	const basePlay = JSON.parse(docutil.getMetaTagValue('play-config', '{}'));
	const baseDisplay = JSON.parse(docutil.getMetaTagValue('display-config', '{}'));
	const site = docutil.getMetaTagValue('stack-exchange-site');
	const qid = docutil.getMetaTagValue('stack-exchange-qid');

	const loader = new Loader('initial-load', 'user interface', 0);
	docutil.body.appendChild(loader.dom());

	require([
		'math/Random',
		'core/sandbox_utils',
		'games/' + gameType + '/Display',
		'games/' + gameType + '/style.css',
	], (
		Random,
		sandbox_utils,
		Display,
	) => {
		loader.setState('game engine', 0.2);
		const sandbox = sandbox_utils.make('engine/sandboxed_engine');

		const GAME_COUNT = 1;//Math.max(1, Math.min(4, navigator.hardwareConcurrency - 2));

		const games = new Map();
		let nextToken = 0;
		for(let i = 0; i < GAME_COUNT; ++ i) {
			const display = new Display();
			let token = (nextToken ++);
			let tokenUsed = false;
			let updateTm = null;
			let latestState = null;

			const config = {
				game: Object.assign({
					seed: null,
					entries: [],
				}, baseGame),
				play: Object.assign({
					delay: 0,
					speed: 0,
				}, basePlay),
				display: Object.assign({
				}, baseDisplay),
			};

			const swapToken = () => {
				sandbox.postMessage({
					action: 'STOP',
					token,
				});
				const game = games.get(token);
				games.delete(token);
				token = (nextToken ++);
				games.set(token, game);
			};

			const begin = (seed) => {
				if(tokenUsed) {
					swapToken();
				}
				config.game.seed = seed || Random.makeRandomSeed('G');
				display.clear();
				display.updatePlayConfig(config.play);
				display.updateGameConfig(config.game);
				display.updateDisplayConfig(config.display);
				sandbox.postMessage({
					action: 'GAME',
					token,
					gameType,
					gameConfig: config.game,
					playConfig: config.play,
				});
			}

			display.addEventListener('replay', () => {
				begin(config.game.seed);
			});

			display.addEventListener('new', (seed) => {
				begin(seed);
			});

			display.addEventListener('step', (type, steps) => {
				config.play.delta = 0;
				config.play.speed = 0;
				display.updatePlayConfig(config.play);
				sandbox.postMessage({
					action: 'STEP',
					token,
					type,
					steps,
				});
			});

			display.addEventListener('changegame', (delta) => {
				Object.assign(config.game, delta);
				display.updateGameConfig(config.game);
				sandbox.postMessage({
					action: 'UPDATE_GAME_CONFIG',
					token,
					gameConfig: config.game,
				});
			});

			display.addEventListener('changeplay', (delta) => {
				Object.assign(config.play, delta);
				display.updatePlayConfig(config.play);
				sandbox.postMessage({
					action: 'UPDATE_PLAY_CONFIG',
					token,
					playConfig: config.play,
				});
			});

			display.addEventListener('changedisplay', (delta) => {
				Object.assign(config.display, delta);
				display.updateDisplayConfig(config.display);
			});

			const init = (entries) => {
				config.game.entries = entries;
				begin();
				docutil.body.appendChild(display.dom());
				tokenUsed = true;
			};

			const debouncedUpdate = () => {
				updateTm = null;
				display.updateState(latestState);
			};

			const updateState = (state) => {
				latestState = state;
				if(!updateTm) {
					updateTm = setTimeout(debouncedUpdate, 0);
				}
			};

			games.set(token, {init, updateState});
		}

		sandbox.addEventListener('message', (event) => {
			const data = event.data;
			switch(data.action) {
			case 'BEGIN_LOAD':
				loader.setState('entries', 0.3);
				break;

			case 'LOADING':
				loader.setState(
					'entries (' + data.loaded + '/' + data.total + ')',
					0.3 + 0.7 * (data.loaded / data.total)
				);
				break;

			case 'LOADED':
				games.forEach((game) => game.init(data.entries));
				docutil.body.removeChild(loader.dom());
				break;

			case 'RENDER':
				const game = games.get(data.token);
				if(game) {
					game.updateState(data.state);
				}
				break;
			}
		});

		sandbox.postMessage({
			action: 'LOAD_ENTRIES',
			site,
			qid,
		});
	});
});
