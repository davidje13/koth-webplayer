define([
	'require',
	'core/sandboxUtils',
	'display/documentUtils',
	'display/SplitView',
	'display/MatchSummary',
	'math/Random',
	'./TournamentRunner',
	'./GameOrchestrator',
	'./EntryManager',
	'./MatchScorer',
	'path:./sandboxedLoader',
], (
	require,
	sandboxUtils,
	docutil,
	SplitView,
	MatchSummary,
	Random,
	TournamentRunner,
	GameOrchestrator,
	EntryManager,
	MatchScorer,
	pathSandboxedLoader
) => {
	'use strict';

	const teamTypes = new Map();
	const matchTypes = new Map();
	const gameTypes = new Map();

	function loadTeamType(type) {
		return require(['teams/' + type], (TeamMaker) => {
			teamTypes.set(type, TeamMaker);
			return TeamMaker;
		});
	}

	function loadMatchType(type) {
		return require(['matches/' + type], (Match) => {
			matchTypes.set(type, Match);
			return Match;
		});
	}

	function loadGameType(type) {
		const gameDir = 'games/' + type;
		return require([
			'path:' + gameDir + '/GameManager',
			gameDir + '/Display',
			gameDir + '/GameScorer',
		], (
			pathGameManager,
			Display,
			GameScorer
		) => {
			const game = {
				pathGameManager,
				Display,
				GameScorer,
			};
			gameTypes.set(type, game);
			return game;
		});
	}

	function parseEntryCode(format, codeBlocks) {
		return format.replace(/\{\{(codeblock:.*?)\}\}/g, (match, p) => {
			const params = {
				codeblock: 0,
				prefix: '',
			};
			p.split(/, +/).forEach((param) => {
				const kv = param.split(':', 2);
				params[kv[0]] = kv[1];
			});
			const code = (codeBlocks[Number(params.codeblock)] || '');
			return (code
				.replace(/\n$/, '')
				.replace(/(^|\n)([^\n])/g, '$1' + params.prefix + '$2')
			);
		});
	}

	class TournamentGameRunner {
		constructor({gameRunner, gameOpts, GameScorer}, display) {
			this.GameScorer = GameScorer;
			this.display = display;
			this.game = gameRunner.make(gameOpts);
		}

		begin(seed, teams) {
			return new Promise((resolve) => {
				this.game.addEventListener('complete', (state) => {
					const config = this.game.getGameConfig();
					this.game.terminate();
					resolve(this.GameScorer.score(config, state));
				});
				this.game.begin(seed, teams);
			});
		}
	}

	return class Engine {
		constructor(pageConfig, nav) {
			this.pageConfig = pageConfig;
			this.nav = nav;

			this.pathGameManager = null;
			this.Display = null;
			this.GameScorer = null;
			this.TeamMaker = null;
			this.Tournament = null;
			this.Match = null;

			this.rawEntries = [];
			this.allTeams = [];

			this.backgroundGames = null;
			this.foregroundGames = null;
			this.singleGame = null;

			this.welcomePage = docutil.make('div');

			this.navRoot = this.nav.push({
				navElements: [this.pageConfig.pageTitle, docutil.make('p', {}, [
					docutil.make('a', {
						'href': this.pageConfig.questionURL,
						'target': '_blank',
					}, ['Question']),
				])],
				hash: '',
				page: this.welcomePage,
			}, {changeHash: false});
		}

		getManagedTeams() {
			return this.allTeams.map((team) => Object.assign({}, team, {
				entries: team.entries.filter((entry) => (entry.enabled)),
			})).filter((team) => (team.entries.length > 0));
		}

		getHashTeams(/*hash*/) {
			// TODO: filter teams according to hash (need to store team
			// choices in hash somehow)
			return this.allTeams;
		}

		buildTournament() {
			const structureGame = {
				seedPrefix: 'G',
				runner: TournamentGameRunner,
				args: {
					gameRunner: this.backgroundGames,
					gameOpts: {
						baseGameConfig: this.pageConfig.baseGameConfig,
						basePlayConfig: this.pageConfig.basePlayHiddenConfig,
						baseDisplayConfig: this.pageConfig.baseDisplayConfig,
					},
					GameScorer: this.GameScorer,
				},
				display: ({seed, teams, parentDisplay, runner, args}) => {
					const displayToken = parentDisplay.addGame(seed);
					const game = runner.game;
					// TODO: better API for this
					parentDisplay.addEventListener('gametitleclick', (token) => {
						if(token === displayToken) {
							this.beginGame(seed, teams);
						}
					});
					game.addEventListener('update', (state) => {
						const config = game.getGameConfig();
						parentDisplay.updateGameState(
							displayToken,
							state.progress,
							args.GameScorer.score(config, state)
						);
					});
				},
			};

			const structureMatch = {
				seedPrefix: 'M',
				runner: this.Match,
				args: this.pageConfig.matchTypeArgs,
				scorer: MatchScorer,
				display: ({seed, teams, index, parentDisplay, scorer}) => {
					const matchDisplay = new MatchSummary({
						name: 'Match ' + (index + 1),
						seed,
						teams,
						matchScorer: scorer,
					});
					parentDisplay.appendChild(matchDisplay.dom());
					return matchDisplay;
				},
				sub: structureGame,
			};

			const structureTournament = {
				seedPrefix: 'T',
				runner: this.Tournament,
				args: this.pageConfig.tournamentTypeArgs,
				scorer: null,
				display: () => {
					return this.tournamentDisplay;
				},
				sub: structureMatch,
			};

			this.tournament = new TournamentRunner(structureTournament);
		}

		buildTournamentPage() {
			this.buildTournament();

			this.tournamentSeed = docutil.text();
			this.tournamentDisplay = docutil.make('section', {'class': 'tournament'}, [
				docutil.make('header', {}, [
					docutil.make('h2', {}, ['Tournament']),
					docutil.make('p', {}, [this.tournamentSeed]),
				]),
			]);
			this.tournamentPage = docutil.make('div', {}, [this.tournamentDisplay]);

			this.tournamentPage.addEventListener('pop', () => {
				this.backgroundGames.terminateAll();
			});
		}

		beginTournament(seed, teams) {
			this.backgroundGames.terminateAll();
			docutil.empty(this.tournamentDisplay);
			this.tournament.begin(seed, teams).then((scores) => {
				/* globals console */
				console.log('Tournament complete', scores);
				// TODO
			});
			this.nav.push({
				navElements: ['Tournament', docutil.make('p', {}, [seed])],
				hash: seed,
				page: this.tournamentPage,
			});
			docutil.updateText(this.tournamentSeed, seed);
		}

		beginRandomTournament() {
			this.beginTournament(
				'T' + Random.makeRandomSeed(),
				this.getManagedTeams()
			);
		}

		buildGamePage() {
			this.singleGameDisplay = new this.Display({});
			const gamePageContent = docutil.make('div', {'class': 'game-page-content'}, [
				this.singleGameDisplay.dom(),
			]);
			this.gamePage = new SplitView([gamePageContent], {
				direction: SplitView.VERTICAL,
				fixedSize: false,
				className: 'game-page',
			});

			this.popupManager = new EntryManager({
				className: 'popup-team-manager',
				extraColumns: this.pageConfig.teamViewColumns,
				showTeams: this.pageConfig.teamType !== 'free_for_all',
				allowTeamModification: false,
			});
			this.popupManager.emptyStateDOM().appendChild(docutil.make('h1', {}, [
				'Live Entry Editor / Debugger',
			]));
			this.popupManager.emptyStateDOM().appendChild(docutil.make('ul', {}, [
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
			this.popupManager.optionsDOM().appendChild(popupClose);

			const updateEntryFocus = (focussedEntry) => {
				if(!this.singleGame) {
					return;
				}
				const focussed = focussedEntry ? [focussedEntry.id] : [];
				this.singleGame.updateDisplayConfig({focussed});
			};

			this.popupManager.addEventListener('change', ({entry, title, code, pauseOnError}) => {
				if(title !== undefined) {
					entry.title = title;
				}
				if(code !== undefined) {
					entry.code = code;
				}
				if(pauseOnError !== undefined) {
					entry.pauseOnError = pauseOnError;
				}
				if(this.singleGame) {
					this.singleGame.updateEntry({
						id: entry.id,
						title,
						code,
						pauseOnError,
					});
				}
				this.popupManager.rebuild();
			});
			this.popupManager.addEventListener('select', updateEntryFocus);

			this.singleGameDisplay.addEventListener('editentries', () => {
				if(!this.singleGame) {
					return;
				}
				this.popupManager.setTeams(this.singleGame.getTeams());
				this.gamePage.setPanes([gamePageContent, this.popupManager.dom()], {
					fixedSize: true,
				});
				updateEntryFocus(this.popupManager.getSelectedEntry());
			});

			const hidePopupTeamManager = () => {
				this.gamePage.setPanes([gamePageContent], {
					fixedSize: false,
				});
				updateEntryFocus(null);
			};

			popupClose.addEventListener('click', hidePopupTeamManager);
			this.gamePage.dom().addEventListener('leave', hidePopupTeamManager);
			this.gamePage.dom().addEventListener('pop', () => {
				if(this.singleGame) {
					this.singleGame.terminate();
				}
				this.singleGame = null;
			});
			this.gamePage.addEventListener('resize', () => {
				this.popupManager.refresh();
			});
		}

		buildScreensaverPage() {
			this.screensaverDisplay = new this.Display({screensaver: true});
			this.screensaverPage = docutil.make('div', {'class': 'game-page-content'}, [
				this.screensaverDisplay.dom(),
			]);

			this.screensaverPage.addEventListener('pop', () => {
				if(this.singleGame) {
					this.singleGame.terminate();
				}
				this.singleGame = null;
			});
		}

		beginGame(seed, teams) {
			if(this.singleGame) {
				this.singleGame.terminate();
			}
			const game = this.singleGame = this.foregroundGames.make({
				display: this.singleGameDisplay,
				baseGameConfig: this.pageConfig.baseGameConfig,
				basePlayConfig: this.pageConfig.basePlayConfig,
				baseDisplayConfig: this.pageConfig.baseDisplayConfig,
			});

			game.addEventListener('update', (state) => {
				this.popupManager.setTeamStatuses(state.teams);
			});
			game.begin(seed, teams);
			const makeNav = () => {
				return {
					navElements: ['Game', docutil.make('p', {}, [game.getSeed()])],
					hash: game.getSeed(),
					page: this.gamePage.dom(),
				};
			};
			const navPos = this.nav.push(makeNav());
			game.addEventListener('begin', () => this.nav.swap(navPos, makeNav()));
		}

		beginRandomGame() {
			this.beginGame(
				'G' + Random.makeRandomSeed(),
				this.getManagedTeams()
			);
		}

		beginScreensaver() {
			if(this.singleGame) {
				this.singleGame.terminate();
			}
			const game = this.singleGame = this.foregroundGames.make({
				display: this.screensaverDisplay,
				baseGameConfig: this.pageConfig.baseGameConfig,
				basePlayConfig: this.pageConfig.basePlayScreensaverConfig,
				baseDisplayConfig: this.pageConfig.baseDisplayConfig,
			});
			const beginNext = () => {
				const gameProps = this.tournament.randomGame(
					'T' + Random.makeRandomSeed(),
					this.getManagedTeams()
				);
				game.begin(gameProps.seed, gameProps.teams);
			};
			const makeNav = () => {
				return {
					navElements: ['Screensaver', docutil.make('p', {}, [
						game.getSeed(),
					])],
					hash: 'screensaver',
					page: this.screensaverPage,
				};
			};

			beginNext();
			const navPos = this.nav.push(makeNav());
			game.addEventListener('complete', () => {
				setTimeout(() => {
					if(game !== this.singleGame) {
						// Page has been closed
						return;
					}
					beginNext();
					this.nav.swap(navPos, makeNav());
				}, this.pageConfig.basePlayScreensaverConfig.swapDelay);
			});
		}

		buildWelcomePage() {
			const btnScreensaver = docutil.make('button', {}, [
				'Begin Screensaver',
			]);
			btnScreensaver.addEventListener('click',
				this.beginScreensaver.bind(this));

			const btnTournament = docutil.make('button', {}, [
				'Begin Random Tournament',
			]);
			btnTournament.addEventListener('click',
				this.beginRandomTournament.bind(this));

			const btnGame = docutil.make('button', {}, [
				'Begin Random Game',
			]);
			btnGame.addEventListener('click',
				this.beginRandomGame.bind(this));

			const generalOptions = docutil.make('span', {'class': 'general-options'}, [
				btnScreensaver,
				btnTournament,
				btnGame,
			]);

			const manager = new EntryManager({
				className: 'team-manager',
				extraColumns: this.pageConfig.teamViewColumns,
				showTeams: this.pageConfig.teamType !== 'free_for_all',
				defaultCode: this.pageConfig.defaultCode,
			});
			manager.addEventListener('change', ({
				entry,
				title,
				code,
				pauseOnError,
				enabled,
			}) => {
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
				'Online web player for ' + this.pageConfig.pageTitle,
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
			this.welcomePage.appendChild(manager.dom());
			this.welcomePage.addEventListener('enter', () => {
				manager.rerender();
			});
			manager.setTeams(this.allTeams);
		}

		providePage(hash) {
			if(hash === 'screensaver') {
				this.nav.popTo(this.navRoot, {navigate: false});
				this.beginScreensaver();
				return true;
			}
			if(hash.startsWith('T')) {
				this.nav.popTo(this.navRoot, {navigate: false});
				this.beginTournament(hash, this.getHashTeams(hash));
				return true;
			}
//			if(hash.startsWith('M')) {
//				this.nav.popTo(navRoot, {navigate: false}); // TODO
//				return true;
//			}
			if(hash.startsWith('G')) {
				this.nav.popTo(this.navRoot, {navigate: false});
				this.beginGame(hash, this.getHashTeams(hash));
				return true;
			}
			return false;
		}

		loadGame() {
			return Promise.all([
				loadGameType(this.pageConfig.gameType),
				loadTeamType(this.pageConfig.teamType),
				loadMatchType(this.pageConfig.tournamentType),
				loadMatchType(this.pageConfig.matchType),
			]).then(([
				{pathGameManager, Display, GameScorer},
				TeamMaker,
				Tournament,
				Match,
			]) => {
				this.pathGameManager = pathGameManager;
				this.Display = Display;
				this.GameScorer = GameScorer;
				this.TeamMaker = TeamMaker;
				this.Tournament = Tournament;
				this.Match = Match;

				this.backgroundGames = new GameOrchestrator(this.pathGameManager, {
					maxConcurrency: this.pageConfig.maxConcurrency,
				});

				this.foregroundGames = new GameOrchestrator(this.pathGameManager, {
					maxConcurrency: 1,
				});
			});
		}

		loadEntries(progressCallback) {
			return new Promise((resolve, reject) => {
				const sandbox = sandboxUtils.make(pathSandboxedLoader);
				sandbox.addEventListener('message', (event) => {
					const data = event.data;
					switch(data.action) {
					case 'BEGIN_LOAD':
						break;

					case 'LOADING':
						if(progressCallback) {
							progressCallback({
								loaded: data.loaded,
								total: data.total,
							});
						}
						break;

					case 'LOADED':
						this.rawEntries = data.entries;
						sandbox.terminate();
						resolve();
						break;

					case 'LOAD_FAILED':
						sandbox.terminate();
						reject(data.error);
						break;
					}
				});

				sandbox.postMessage({
					action: 'LOAD_ENTRIES',
					site: this.pageConfig.site,
					qid: this.pageConfig.qid,
				});
			});
		}

		begin() {
			this.rawEntries.forEach((entry) => {
				entry.originalCode = entry.code = parseEntryCode(
					this.pageConfig.codeTemplate,
					entry.codeBlocks
				);
			});

			this.allTeams = this.TeamMaker.pickTeams(
				this.rawEntries,
				this.pageConfig.teamTypeArgs
			);

			this.buildWelcomePage();
			this.buildTournamentPage();
			this.buildGamePage();
			this.buildScreensaverPage();
		}
	};
});
