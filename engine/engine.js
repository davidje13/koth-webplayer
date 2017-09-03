define([
	'require',
	'display/documentUtils',
	'display/NestedNav',
	'display/Loader',
	'path:engine/sandboxedLoader',
	'style.css',
], (
	require,
	docutil,
	NestedNav,
	Loader,
	pathSandboxedLoader
) => {
	'use strict';

	// TODO:
	// * remember display config in local storage / cookies
	// * remember custom entries in local storage (maybe)
	// * permalinks need to store which entries were chosen (& ordering)
	// * jump-to-entry in editor when pausing due to an error
	// * currently using the code editor mutates the original team object state; it
	//   should be considered immutable, and copies made (will need some thought on
	//   how to handle propagating changes made in a game back to tournaments /
	//   welcome screen)

	const pageTitle = docutil.getTitle();
	const gameType = docutil.getMetaTagValue('game-type');
	const teamType = docutil.getMetaTagValue('team-type', 'free_for_all');
	const teamTypeArgs = JSON.parse(docutil.getMetaTagValue('team-type-args', '{}'));
	const tournamentType = docutil.getMetaTagValue('tournament-type', 'single_match');
	const tournamentTypeArgs = JSON.parse(docutil.getMetaTagValue('tournament-type-args', '{}'));
	const matchType = docutil.getMetaTagValue('match-type', 'brawl');
	const matchTypeArgs = JSON.parse(docutil.getMetaTagValue('match-type-args', '{}'));
	const baseGameConfig = JSON.parse(docutil.getMetaTagValue('game-config', '{}'));
	const basePlayConfig = JSON.parse(docutil.getMetaTagValue('play-config', '{}'));
	const basePlayHiddenConfig = JSON.parse(docutil.getMetaTagValue(
		'play-hidden-config',
		'{"speed": -1, "maxTime": 250}'
	));
	const baseDisplayConfig = JSON.parse(docutil.getMetaTagValue('display-config', '{}'));
	const teamViewColumns = JSON.parse(docutil.getMetaTagValue('team-view-columns', '[]'));
	const defaultCode = docutil.getMetaTagValue('default-code', '// Code here\n');
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
		navElements: [pageTitle, docutil.make('p', {}, [
			docutil.make('a', {
				'href': questionURL,
				'target': '_blank',
			}, ['Question']),
		])],
		hash: '',
		page: welcomePage,
	}, {changeHash: false});

	/* jshint -W072 */
	require([
		'math/Random',
		'engine/GameOrchestrator',
		'engine/EntryManager',
		'core/sandboxUtils',
		'display/SplitView',
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
		EntryManager,
		sandboxUtils,
		SplitView,
		MatchSummary,
		TeamMaker,
		Tournament,
		Match,
		pathGameManager,
		Display,
		GameScorer,
		MatchScorer
	) => {
		/* jshint +W072 */
		loader.setState('game engine', 0.2);
		const sandbox = sandboxUtils.make(pathSandboxedLoader);
		const backgroundGames = new GameOrchestrator(pathGameManager, {
			maxConcurrency: Math.max(1, Math.min(8, navigator.hardwareConcurrency - 3)),
		});

		const foregroundGames = new GameOrchestrator(pathGameManager, {
			maxConcurrency: 1,
		});

		let allTeams = null;

		function getManagedTeams() {
			return allTeams.map((team) => Object.assign({}, team, {
				entries: team.entries.filter((entry) => (entry.enabled)),
			})).filter((team) => (team.entries.length > 0));
		}

		const btnTournament = docutil.make('button', {}, ['Begin Random Tournament']);
		const btnGame = docutil.make('button', {}, ['Begin Random Game']);
		const generalOptions = docutil.make('span', {'class': 'general-options'}, [
			btnTournament,
			btnGame,
		]);

		const tournamentSeed = docutil.text();
		const tournamentDisplay = docutil.make('section', {'class': 'tournament'}, [
			docutil.make('header', {}, [
				docutil.make('h2', {}, ['Tournament']),
				docutil.make('p', {}, [tournamentSeed]),
			]),
		]);
		const tournamentPage = docutil.make('div', {}, [tournamentDisplay]);

		const singleGameDisplay = new Display();
		const gamePageContent = docutil.make('div', {'class': 'game-page-content'}, [
			singleGameDisplay.dom(),
		]);
		const gamePage = new SplitView([gamePageContent], {
			direction: SplitView.VERTICAL,
			fixedSize: false,
			className: 'game-page',
		});
		let singleGame = null;

		const popupManager = new EntryManager({
			className: 'popup-team-manager',
			extraColumns: teamViewColumns,
			showTeams: teamType !== 'free_for_all',
			allowTeamModification: false,
		});
		popupManager.emptyStateDOM().appendChild(docutil.make('h1', {}, [
			'Live Entry Editor / Debugger',
		]));
		popupManager.emptyStateDOM().appendChild(docutil.make('ul', {}, [
			docutil.make('li', {}, [
				'Select an entry on the left to begin',
				docutil.make('div', {}, [
					'While an entry is selected, you will see it highlighted ' +
					'in the game view.',
				]),
			]),
			docutil.make('li', {}, [
				'Changes will take effect when the code editor loses focus',
				docutil.make('div', {}, [
					'You do not need to restart the current game.',
				]),
			]),
			docutil.make('li', {}, [
				'Entries with yellow or red dots have encountered issues',
				docutil.make('div', {}, [
					'You can see the details in the pane on the right ' +
					'once you have selected the entry.',
				]),
			]),
		]));

		const popupClose = docutil.make('button', {'class': 'close'}, ['Close']);
		popupManager.optionsDOM().appendChild(popupClose);

		function updateEntryFocus(focussedEntry) {
			if(!singleGame) {
				return;
			}
			const focussed = focussedEntry ? [focussedEntry.id] : [];
			singleGame.updateDisplayConfig({focussed});
		}

		popupManager.addEventListener('change', ({entry, title, code, pauseOnError}) => {
			if(title !== undefined) {
				entry.title = title;
			}
			if(code !== undefined) {
				entry.code = code;
			}
			if(pauseOnError !== undefined) {
				entry.pauseOnError = pauseOnError;
			}
			if(singleGame) {
				singleGame.updateEntry({
					id: entry.id,
					title,
					code,
					pauseOnError,
				});
			}
			popupManager.rebuild();
		});
		popupManager.addEventListener('select', updateEntryFocus);

		tournamentPage.addEventListener('pop', () => {
			backgroundGames.terminateAll();
		});

		function updateEntryManager({teams}) {
			popupManager.setTeamStatuses(teams);
		}

		singleGameDisplay.addEventListener('editentries', () => {
			if(!singleGame) {
				return;
			}
			popupManager.setTeams(singleGame.getTeams());
			gamePage.setPanes([gamePageContent, popupManager.dom()], {
				fixedSize: true,
			});
			updateEntryFocus(popupManager.getSelectedEntry());
		});

		gamePage.addEventListener('resize', () => {
			popupManager.refresh();
		});

		function hidePopupTeamManager() {
			gamePage.setPanes([gamePageContent], {
				fixedSize: false,
			});
			updateEntryFocus(null);
		}

		popupClose.addEventListener('click', hidePopupTeamManager);
		gamePage.dom().addEventListener('leave', hidePopupTeamManager);
		gamePage.dom().addEventListener('pop', () => {
			if(singleGame) {
				singleGame.terminate();
			}
			singleGame = null;
		});

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
			singleGame.addEventListener('update', updateEntryManager);
			singleGame.begin({seed, teams});
			function makeNav() {
				return {
					navElements: ['Game', docutil.make('p', {}, [singleGame.getSeed()])],
					hash: singleGame.getSeed(),
					page: gamePage.dom(),
				};
			}
			const navPos = nav.push(makeNav());
			singleGame.addEventListener('begin', () => nav.swap(navPos, makeNav()));
		}

		// TODO: extract all of this & improve separation / APIs
		const tournament = new Tournament(tournamentTypeArgs);
		tournament.setMatchHandler((matchSeed, matchTeams, matchIndex) => {
			const match = new Match(matchTypeArgs);
			const matchDisplay = new MatchSummary({
				name: 'Match ' + (matchIndex + 1),
				seed: matchSeed,
				teams: matchTeams,
				matchScorer: MatchScorer,
			});
			tournamentDisplay.appendChild(matchDisplay.dom());
			match.setGameHandler((gameSeed, gameTeams) => {
				const game = backgroundGames.make({
					baseGameConfig,
					basePlayConfig: basePlayHiddenConfig,
					baseDisplayConfig,
				});
				const gameDisplayToken = matchDisplay.addGame(gameSeed);
				// TODO: better API for this
				matchDisplay.addEventListener('gametitleclick', (token) => {
					if(token === gameDisplayToken) {
						beginGame(gameSeed, gameTeams);
					}
				});
				return new Promise((resolve) => {
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
					game.begin({seed: gameSeed, teams: gameTeams});
				});
			});
			return new Promise((resolve) => {
				match.addEventListener('complete', (matchScores) => {
					resolve(MatchScorer.score(matchTeams, matchScores));
				});
				match.begin({seed: matchSeed, teams: matchTeams});
			});
		});
		tournament.addEventListener('complete', (finalScores) => {
			/* global console */
			console.log('Tournament complete', finalScores);
			// TODO
		});

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

		btnTournament.addEventListener('click', () => {
			beginTournament({teams: getManagedTeams()});
		});

		btnGame.addEventListener('click', () => {
			beginGame(null, getManagedTeams());
		});

		function handleHashChange() {
			const hash = decodeURIComponent((window.location.hash || '#').substr(1));
			if(nav.goToHash(hash)) {
				return true;
			}
			// TODO: filter teams according to hash (need to store team choices in hash somehow)
			const teams = allTeams;
			if(hash.startsWith('T')) {
				nav.popTo(navRoot, {navigate: false});
				beginTournament({teams, seed: hash});
				return true;
			}
//			if(hash.startsWith('M')) {
//				nav.popTo(navRoot, {navigate: false}); // TODO
//				return true;
//			}
			if(hash.startsWith('G')) {
				nav.popTo(navRoot, {navigate: false});
				beginGame(hash, teams);
				return true;
			}
			/* global console */
			console.log('Unknown hash request', hash);
			return false;
		}

		function begin(teams) {
			teams.forEach((team) => team.entries.forEach((entry) => {
				entry.originalCode = entry.code;
			}));
			allTeams = teams;

			const manager = new EntryManager({
				className: 'team-manager',
				extraColumns: teamViewColumns,
				showTeams: teamType !== 'free_for_all',
				defaultCode,
			});
			manager.addEventListener('change', ({entry, title, code, pauseOnError, enabled}) => {
				if(title !== undefined) {
					entry.title = title;
				}
				if(code !== undefined) {
					entry.code = code;
				}
				if(pauseOnError !== undefined) {
					entry.pauseOnError = pauseOnError;
				}
				if(enabled !== undefined) {
					entry.enabled = enabled;
				}
				manager.rebuild();
			});
			manager.optionsDOM().appendChild(generalOptions);
			manager.emptyStateDOM().appendChild(docutil.make('h1', {}, [
				'Online web player for ' + pageTitle,
			]));
			manager.emptyStateDOM().appendChild(docutil.make('ul', {}, [
				docutil.make('li', {}, [
					'Watch a game by clicking "Begin Random Game" in the top-right',
				]),
				docutil.make('li', {}, [
					'Run a tournament by clicking "Begin Random Tournament" in the top-right',
					docutil.make('div', {}, [
						'(Within a tournament, you can view any game by ' +
						'clicking on the "G(n)" column header)',
					]),
				]),
				docutil.make('li', {}, [
					'Edit the code for an entry, or add a new entry, using the list on the left',
					docutil.make('div', {}, [
						'(Changes will apply to games and tournaments within ' +
						'your browser session. Modified entries are marked in yellow)',
					]),
				]),
			]));

			welcomePage.appendChild(manager.dom());
			welcomePage.addEventListener('enter', () => {
				manager.rerender();
			});
			manager.setTeams(allTeams);

			window.addEventListener('hashchange', handleHashChange);
			handleHashChange();
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

			case 'LOAD_FAILED':
				docutil.body.removeChild(loader.dom());
				const ignoreBtn = docutil.make('button', {}, ['Continue Anyway']);
				const errorDom = docutil.make('div', {'class': 'error'}, [
					'Failed to load entries: ' + data.error,
					ignoreBtn,
				]);
				ignoreBtn.addEventListener('click', () => {
					docutil.body.removeChild(errorDom);
					begin([]);
				});
				docutil.body.appendChild(errorDom);
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
