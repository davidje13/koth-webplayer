'use strict';

// TODO:
// * enable/disable/edit entries
// * add new entry
// * remember display config in local storage / cookies
// * remember custom entries in local storage (maybe)
// * team management
// * permalinks need to store which entries were chosen (& ordering)

require([
	'display/document_utils',
	'display/NestedNav',
	'display/Loader',
	'path:engine/sandboxed_loader',
	'style.css',
], (
	docutil,
	NestedNav,
	Loader,
	sandboxed_loader_path,
) => {
	const title = docutil.getTitle();
	const gameType = docutil.getMetaTagValue('game-type');
	const teamType = docutil.getMetaTagValue('team-type', 'free_for_all');
	const teamTypeArgs = JSON.parse(docutil.getMetaTagValue('team-type-args', '{}'));
	const tournamentType = docutil.getMetaTagValue('tournament-type', 'single_match');
	const tournamentTypeArgs = JSON.parse(docutil.getMetaTagValue('tournament-type-args', '{}'));
	const matchType = docutil.getMetaTagValue('match-type', 'brawl');
	const matchTypeArgs = JSON.parse(docutil.getMetaTagValue('match-type-args', '{}'));
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
	const GITHUB_LINK = 'https://github.com/davidje13/koth-webplayer';

	const gameDir = 'games/' + gameType;

	const nav = new NestedNav();
	const loader = new Loader('initial-load', 'user interface', 0);

	docutil.body.appendChild(docutil.make('nav', {}, [nav.navDOM()]));
	docutil.body.appendChild(nav.pageDOM());
	docutil.body.appendChild(loader.dom());

	const welcomePage = docutil.make('div');

	nav.push({
		navElements: ['WebPlayer', docutil.make('p', {}, [
			docutil.make('a', {
				'href': GITHUB_LINK,
				'target': '_blank',
			}, ['GitHub']),
		])],
	});
	const navRoot = nav.push({
		navElements: [title, docutil.make('p', {}, [
			docutil.make('a', {
				'href': questionURL,
				'target': '_blank',
			}, ['Question']),
		])],
		hash: '',
		page: welcomePage,
	}, {changeHash: false});

	require([
		'math/Random',
		'engine/GameOrchestrator',
		'core/sandbox_utils',
		'display/MatchSummary', // TODO: game-customisable
		'teams/' + teamType,
		'tournaments/' + tournamentType,
		'matches/' + matchType,
		'path:' + gameDir + '/GameManager',
		gameDir + '/Display',
		gameDir + '/GameScorer',
		'engine/MatchScorer',
	], (
		Random,
		GameOrchestrator,
		sandbox_utils,
		MatchSummary,
		TeamMaker,
		Tournament,
		Match,
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

		let baseTeams = null;

		const tournamentSeed = docutil.text();
		const tournamentDisplay = docutil.make('section', {'class': 'tournament'}, [
			docutil.make('header', {}, [
				docutil.make('h2', {}, ['Tournament']),
				docutil.make('p', {}, [tournamentSeed]),
			]),
		]);
		const tournamentPage = docutil.make('div', {}, [tournamentDisplay]);

		const singleGameDisplay = new Display();
		const gamePage = docutil.make('div', {}, [singleGameDisplay.dom()]);
		let singleGame = null;

		gamePage.addEventListener('pop', () => {
			if(singleGame) {
				singleGame.terminate();
			}
			singleGame = null;
		});

		tournamentPage.addEventListener('pop', () => {
			backgroundGames.terminateAll();
		});

		// TODO: extract all of this & improve separation / APIs
		const tournament = new Tournament(tournamentTypeArgs);
		tournament.setMatchHandler((seed, teams, index) => {
			const match = new Match(matchTypeArgs);
			const matchDisplay = new MatchSummary({
				name: 'Match ' + (index + 1),
				seed,
				teams,
				matchScorer: MatchScorer,
			});
			tournamentDisplay.appendChild(matchDisplay.dom());
			match.setGameHandler((seed, teams, index) => {
				const game = backgroundGames.make({
					baseGameConfig,
					basePlayConfig: basePlayHiddenConfig,
					baseDisplayConfig,
				});
				const gameDisplayToken = matchDisplay.addGame(seed);
				// TODO: better API for this
				matchDisplay.addEventListener('gametitleclick', (token) => {
					if(token === gameDisplayToken) {
						beginGame(seed, teams);
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

		function handleHashChange() {
			const hash = decodeURIComponent((window.location.hash || '#').substr(1));
			if(nav.goToHash(hash)) {
				return true;
			}
			if(hash.startsWith('T')) {
				nav.popTo(navRoot, {navigate: false});
				beginTournament({teams: baseTeams, seed: hash});
				return true;
			}
			if(hash.startsWith('M')) {
				// TODO
//				nav.popTo(navRoot, {navigate: false});
//				return true;
			}
			if(hash.startsWith('G')) {
				nav.popTo(navRoot, {navigate: false});
				beginGame(hash, baseTeams);
				return true;
			}
			console.log('Unknown hash request', hash);
			return false;
		}

		function beginGame(seed, teams) {
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
			function makeNav() {
				return {
					navElements: ['Game', docutil.make('p', {}, [singleGame.getSeed()])],
					hash: singleGame.getSeed(),
					page: gamePage,
				};
			}
			const navPos = nav.push(makeNav());
			singleGame.addEventListener('begin', () => nav.swap(navPos, makeNav()));
		}

		function beginTournament(config) {
			backgroundGames.terminateAll();
			docutil.empty(tournamentDisplay);
			tournament.begin(config);
			nav.push({
				navElements: ['Tournament', docutil.make('p', {}, [tournament.getSeed()])],
				hash: tournament.getSeed(),
				page: tournamentPage,
			});
			docutil.updateText(tournamentSeed, tournament.getSeed());
		}

		function begin(teams) {
			const btnTournament = docutil.make('button', {}, 'Begin Random Tournament');
			btnTournament.addEventListener('click', () => {
				beginTournament({teams});
			});

			let btnGame = null;
			if(!tournamentTypeArgs.matchTeamLimit) {
				btnGame = docutil.make('button', {}, 'Begin Random Game');
				btnGame.addEventListener('click', () => {
					beginGame(null, teams);
				});
			}

			welcomePage.appendChild(docutil.make('div', {'class': 'initial-options'}, [btnTournament, btnGame]));

			baseTeams = teams;
			window.addEventListener('hashchange', handleHashChange);
			if(handleHashChange()) {
				return;
			}
			if(tournamentTypeArgs.matchTeamLimit) { // TODO: support entry picking
				beginTournament({teams});
				return;
			}
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
