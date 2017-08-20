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
	const baseGameConfig = JSON.parse(docutil.getMetaTagValue('game-config', '{}'));
	const basePlayConfig = JSON.parse(docutil.getMetaTagValue('play-config', '{}'));
	const baseDisplayConfig = JSON.parse(docutil.getMetaTagValue('display-config', '{}'));
	const site = docutil.getMetaTagValue('stack-exchange-site');
	const qid = docutil.getMetaTagValue('stack-exchange-qid');

	const gameDir = 'games/' + gameType;

	const loader = new Loader('initial-load', 'user interface', 0);
	docutil.body.appendChild(loader.dom());

	require([
		'math/Random',
		'engine/GameOrchestrator',
		'engine/Match',
		'engine/Tournament',
		'core/sandbox_utils',
		'path:' + gameDir + '/GameManager',
		gameDir + '/Display',
		gameDir + '/GameScorer',
		gameDir + '/style.css',
	], (
		Random,
		GameOrchestrator,
		Match,
		Tournament,
		sandbox_utils,
		GameManager_path,
		Display,
		GameScorer,
	) => {
		loader.setState('game engine', 0.2);
		const sandbox = sandbox_utils.make(sandboxed_loader_path);
		const games = new GameOrchestrator(GameManager_path, {
			// TODO: support maxConcurrency
			maxConcurrency: Math.max(1, Math.min(4, navigator.hardwareConcurrency - 2)),
		});

		const tournament = new Tournament();
		tournament.setMatchHandler((seed, entries) => {
			const match = new Match();
			match.setGameHandler((seed, entries) => {
				const game = games.make({
					baseGameConfig,
					basePlayConfig,
					baseDisplayConfig,
				});
				return new Promise((resolve, reject) => {
					game.addEventListener('update', (state) => {
						const config = game.getGameConfig();
						// TODO: update match display (progress bar, maybe mini visualisation)
					});
					game.addEventListener('complete', (state) => {
						const config = game.getGameConfig();
						game.terminate();
						resolve(GameScorer.score(config, state));
					});
					game.begin({seed, entries});
				});
			});
			return new Promise((resolve, reject) => {
				match.addEventListener('complete', (matchScores) => {
					resolve(scores); // TODO: aggregate scores
				});
				match.begin({seed, entries});
			});
		});
		tournament.addEventListener('complete', (finalScores) => {
			// TODO
		});

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

				// TODO: button to begin tournament, button to begin one-off game

//				tournament.begin({entries: data.entries});

				const display = new Display();
				const game = games.make({
					display,
					baseGameConfig,
					basePlayConfig,
					baseDisplayConfig,
				});
				game.begin({entries: data.entries});
				docutil.body.appendChild(display.dom());

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
