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
	'display/document_utils',
	'display/Loader',
	'path:engine/sandboxed_loader',
	'style.css',
], (
	docutil,
	Loader,
	sandboxed_loader_path,
) => {
	const gameType = docutil.getMetaTagValue('game-type');
	const baseGame = JSON.parse(docutil.getMetaTagValue('game-config', '{}'));
	const basePlay = JSON.parse(docutil.getMetaTagValue('play-config', '{}'));
	const baseDisplay = JSON.parse(docutil.getMetaTagValue('display-config', '{}'));
	const site = docutil.getMetaTagValue('stack-exchange-site');
	const qid = docutil.getMetaTagValue('stack-exchange-qid');

	const gameDir = 'games/' + gameType;

	const loader = new Loader('initial-load', 'user interface', 0);
	docutil.body.appendChild(loader.dom());

	require([
		'math/Random',
		'engine/GameOrchestrator',
		'core/sandbox_utils',
		'path:' + gameDir + '/GameManager',
		gameDir + '/Display',
		gameDir + '/style.css',
	], (
		Random,
		GameOrchestrator,
		sandbox_utils,
		GameManager_path,
		Display,
	) => {
		loader.setState('game engine', 0.2);
		const sandbox = sandbox_utils.make(sandboxed_loader_path);
		const games = new GameOrchestrator(GameManager_path);

		const CONCURRENCY = Math.max(1, Math.min(4, navigator.hardwareConcurrency - 2));

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

//				for(let i = 0; i < CONCURRENCY; ++ i) {
					const display = new Display();
					const game = games.makeGame({
						display,
						baseGame,
						basePlay,
						baseDisplay,
					});
					game.begin({entries: data.entries});
					docutil.body.appendChild(display.dom());
//				}
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
