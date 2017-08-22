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
	const title = docutil.getTitle();
	const gameType = docutil.getMetaTagValue('game-type');
	const baseGameConfig = JSON.parse(docutil.getMetaTagValue('game-config', '{}'));
	const basePlayConfig = JSON.parse(docutil.getMetaTagValue('play-config', '{}'));
	const basePlayHiddenConfig = JSON.parse(docutil.getMetaTagValue('play-hidden-config', '{"speed": -1, "maxTime": 500}'));
	const baseDisplayConfig = JSON.parse(docutil.getMetaTagValue('display-config', '{}'));
	const site = docutil.getMetaTagValue('stack-exchange-site');
	const qid = docutil.getMetaTagValue('stack-exchange-qid');
	const questionURL = docutil.getMetaTagValue(
		'stack-exchange-question-url',
		'https://' + site + '.stackexchange.com/questions/' + qid
	);

	const gameDir = 'games/' + gameType;

	docutil.body.appendChild(docutil.make('h1', {}, [docutil.make('a', {
		'href': questionURL,
		'target': '_blank',
	}, [title])]));

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
			console.log('Starting match', seed, entries);
			const match = new Match();
			match.setGameHandler((seed, entries) => {
				console.log('Starting game', seed, entries);
				const game = games.make({
					baseGameConfig,
					basePlayConfig: basePlayHiddenConfig,
					baseDisplayConfig,
				});
				return new Promise((resolve, reject) => {
					game.addEventListener('update', (state) => {
						const config = game.getGameConfig();
						console.log('Game progress');
						// TODO: update match display (progress bar, maybe mini visualisation)
					});
					game.addEventListener('complete', (state) => {
						const config = game.getGameConfig();
						game.terminate();
						const score = GameScorer.score(config, state);
						console.log('Game complete', score);
						resolve(score);
					});
					game.begin({seed, entries});
				});
			});
			return new Promise((resolve, reject) => {
				match.addEventListener('complete', (matchScores) => {
					const scores = {};
					matchScores.forEach((matchScore) => {
						matchScore.forEach((result) => {
							scores[result.id] = (scores[result.id] || 0) + result.score;
						});
					});
					console.log('Match complete', matchScores, scores);
					resolve(scores);
				});
				match.begin({seed, entries});
			});
		});
		tournament.addEventListener('complete', (finalScores) => {
			console.log('Tournament complete', finalScores);
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
