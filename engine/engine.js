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
		'engine/GameOrchestrator',
		'core/sandbox_utils',
		'games/' + gameType + '/Display',
		'games/' + gameType + '/style.css',
	], (
		Random,
		GameOrchestrator,
		sandbox_utils,
		Display,
	) => {
		loader.setState('game engine', 0.2);
		const sandbox = sandbox_utils.make('engine/sandboxed_loader');
		const games = new GameOrchestrator(gameType);

		const GAME_COUNT = 1;//Math.max(1, Math.min(4, navigator.hardwareConcurrency - 2));

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
				docutil.body.removeChild(loader.dom());

				for(let i = 0; i < GAME_COUNT; ++ i) {
					const display = new Display();
					const game = games.makeGame({
						entries: data.entries,
						display,
						baseGame,
						basePlay,
						baseDisplay,
					});
					game.begin();
					docutil.body.appendChild(display.dom());
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
