'use strict';

// TODO:
// * tournament management
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
	const teamType = docutil.getMetaTagValue('team-type', 'free_for_all');
	const teamTypeArgs = JSON.parse(docutil.getMetaTagValue('team-type-args', '{}'));
	const baseGameConfig = JSON.parse(docutil.getMetaTagValue('game-config', '{}'));
	const basePlayConfig = JSON.parse(docutil.getMetaTagValue('play-config', '{}'));
	const basePlayHiddenConfig = JSON.parse(docutil.getMetaTagValue('play-hidden-config', '{"speed": -1, "maxTime": 250}'));
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
		'display/Overlay',
		'display/MatchSummary', // TODO: game-customisable
		'teammaker/' + teamType,
		'path:' + gameDir + '/GameManager',
		gameDir + '/Display',
		gameDir + '/GameScorer',
		'engine/MatchScorer',
		gameDir + '/style.css',
	], (
		Random,
		GameOrchestrator,
		Match,
		Tournament,
		sandbox_utils,
		Overlay,
		MatchSummary,
		TeamMaker,
		GameManager_path,
		Display,
		GameScorer,
		MatchScorer,
	) => {
		loader.setState('game engine', 0.2);
		const sandbox = sandbox_utils.make(sandboxed_loader_path);
		const backgroundGames = new GameOrchestrator(GameManager_path, {
			maxConcurrency: Math.max(1, Math.min(8, navigator.hardwareConcurrency - 3)),
		});

		const foregroundGames = new GameOrchestrator(GameManager_path, {
			maxConcurrency: 1,
		});

		const singleGameDisplay = new Display();
		const singleGameOverlay = new Overlay();
		docutil.body.appendChild(singleGameOverlay.dom());
		let singleGame = null;

		function showGame(seed, teams, dismissable) {
			singleGameOverlay.show(singleGameDisplay.dom(), {
				dismissable,
				inline: !dismissable
			});

			if(singleGame) {
				singleGame.terminate();
			}
			singleGame = foregroundGames.make({
				display: singleGameDisplay,
				baseGameConfig,
				basePlayConfig,
				baseDisplayConfig,
			});
			singleGame.begin({seed, teams});
		}

		singleGameOverlay.addEventListener('dismissed', () => {
			if(singleGame) {
				singleGame.terminate();
			}
			singleGame = null;
		});

		// TODO: extract all of this & improve separation / APIs
		const tournament = new Tournament();
		tournament.setMatchHandler((seed, teams) => {
			const match = new Match(30);
			const matchDisplay = new MatchSummary({
				name: 'Match 1',
				seed,
				teams,
				matchScorer: MatchScorer,
			});
			docutil.body.appendChild(docutil.make('section', {'class': 'tournament'}, [
				docutil.make('header', {}, [
					docutil.make('h2', {}, 'Tournament'),
					docutil.make('p', {}, tournament.seed),
				]),
				matchDisplay.dom()
			]));
			match.setGameHandler((seed, teams) => {
				const game = backgroundGames.make({
					baseGameConfig,
					basePlayConfig: basePlayHiddenConfig,
					baseDisplayConfig,
				});
				const gameDisplayToken = matchDisplay.addGame(seed);
				// TODO: better API for this
				matchDisplay.addEventListener('gametitleclick', (token) => {
					if(token === gameDisplayToken) {
						showGame(seed, teams, true);
					}
				});
				return new Promise((resolve, reject) => {
					game.addEventListener('update', (state) => {
						const config = game.getGameConfig();
						const score = GameScorer.score(config, state);
						matchDisplay.updateGameState(gameDisplayToken, state.progress, score);
					});
					game.addEventListener('complete', (state) => {
						const config = game.getGameConfig();
						game.terminate();
						resolve(GameScorer.score(config, state));
					});
					game.begin({seed, teams});
				});
			});
			return new Promise((resolve, reject) => {
				match.addEventListener('complete', (matchScores) => {
					resolve(MatchScorer.score(teams, matchScores));
				});
				match.begin({seed, teams});
			});
		});
		tournament.addEventListener('complete', (finalScores) => {
			console.log('Tournament complete', finalScores);
			// TODO
		});

		window.addEventListener('hashchange', () => {
			console.log(window.location.hash);
			// TODO
		});

		const linker = docutil.make('a', {'href': '#', 'class': 'linker', 'title': 'Permalink'});
		linker.addEventListener('click', (e) => {
			e.preventDefault();
			if(singleGame && singleGameOverlay.visible) {
				document.location.hash = '#' + singleGame.getSeed();
			} else if(tournament.seed) {
				document.location.hash = '#' + tournament.getSeed();
			} else {
				document.location.hash = '';
			}
		});
		docutil.body.appendChild(linker);

		function begin(teams) {
			const hash = (window.location.hash || '#').substr(1);
			if(hash.startsWith('T')) {
				tournament.begin({teams, seed: hash});
				return;
			}
			if(hash.startsWith('M')) {
				// TODO
//				return;
			}
			if(hash.startsWith('G')) {
				showGame(hash, teams, false);
				return;
			}

			let initialOptions = null;

			const btnTournament = docutil.make('button', {}, 'Tournament (work-in-progress!)');
			btnTournament.addEventListener('click', () => {
				docutil.body.removeChild(initialOptions);
				tournament.begin({teams});
			});

			const btnGame = docutil.make('button', {}, 'Game');
			btnGame.addEventListener('click', () => {
				docutil.body.removeChild(initialOptions);
				showGame(null, teams, false);
			});

			initialOptions = docutil.make('div', {'class': 'initial-options'}, [btnTournament, btnGame]);

			docutil.body.appendChild(initialOptions);
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
				docutil.body.removeChild(loader.dom());

				begin(TeamMaker.pickTeams(data.entries, teamTypeArgs));

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
