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
	const teamViewColumns = JSON.parse(docutil.getMetaTagValue('team-view-columns', '[]'));
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
		'display/TreeTable',
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
		TreeTable,
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

		let allTeams = null;
		let managedTeams = null;

		const btnTournament = docutil.make('button', {}, ['Begin Random Tournament']);
		btnTournament.addEventListener('click', () => {
			beginTournament({teams: managedTeams});
		});

		const btnGame = docutil.make('button', {}, ['Begin Random Game']);
		btnGame.addEventListener('click', () => {
			beginGame(null, managedTeams);
		});

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
			// TODO: filter teams according to hash (need to store team choices in hash somehow)
			const teams = allTeams;
			if(hash.startsWith('T')) {
				nav.popTo(navRoot, {navigate: false});
				beginTournament({teams, seed: hash});
				return true;
			}
			if(hash.startsWith('M')) {
				// TODO
//				nav.popTo(navRoot, {navigate: false});
//				return true;
			}
			if(hash.startsWith('G')) {
				nav.popTo(navRoot, {navigate: false});
				beginGame(hash, teams);
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

		function renderEntryManagement(teams) {
			// TODO:
			// * Allow drag+drop to reorder teams & entries, and switch entry teams
			// * Add change handler to 'enabled' chekboxes & reordering to update managedTeams
			// * Load code into codemirror when selecting
			// * Default code for new entries (via meta tag)
			// * Persist in local storage (maybe use answer_id as unique refs)

			let titleEditor = docutil.make('input');
			let codeEditor = docutil.make('textarea');
			const tree = new TreeTable({
				className: 'team-table',
				columns: [
					{title: 'Entry', attribute: 'label'},
					...teamViewColumns,
					{title: '', attribute: 'enabled', className: 'enabled-opt'},
				],
			});

			function rebuildTree() {
				let treeData = [];
				if(teamType === 'free_for_all') {
					teams.forEach((team) => team.entries.forEach((entry) => {
						const changed = entry.code !== entry.originalCode;
						treeData.push({
							key: entry.id,
							className: changed ? 'changed' : '',
							label: {
								value: entry.title,
								title: entry.title + (changed ? ' (changed)' : ''),
							},
							user_id: entry.user_id,
							answer_id: entry.answer_id,
							enabled: docutil.make('input', {type: 'checkbox', checked: 'checked', disabled: 'disabled'}),
							baseEntry: entry,
						});
					}));
					treeData.push({label: docutil.make('button', {disabled: 'disabled'}, ['+ Add Entry']), selectable: false});
				} else {
					treeData = teams.map((team) => {
						const nested = team.entries.map((entry) => {
							const changed = entry.code !== entry.originalCode;
							return {
								key: team.id + '-' + entry.id,
								className: changed ? 'changed' : '',
								label: {
									value: entry.title,
									title: entry.title + (changed ? ' (changed)' : ''),
								},
								user_id: entry.user_id,
								answer_id: entry.answer_id,
								enabled: docutil.make('input', {type: 'checkbox', checked: 'checked', disabled: 'disabled'}),
								baseEntry: entry,
							};
						});
						nested.push({label: docutil.make('button', {disabled: 'disabled'}, ['+ Add Entry']), selectable: false});
						return {
							key: team.id,
							className: 'team',
							label: 'Team ' + team.id,
							enabled: docutil.make('input', {type: 'checkbox', checked: 'checked', disabled: 'disabled'}),
							nested,
							baseTeam: team,
						};
					});
					treeData.push({label: docutil.make('button', {disabled: 'disabled'}, ['+ Add Team']), selectable: false});
				}
				tree.setData(treeData);
			}
			rebuildTree();

			function saveState() {
				if(!selectedEntry) {
					return;
				}
				const title = titleEditor.value;
				let code = null;
				if(codeEditor.getDoc) {
					code = codeEditor.getDoc().getValue();
				} else {
					code = codeEditor.value;
				}
				selectedEntry.title = title;
				selectedEntry.code = code;
				// TODO: this rebuild prevents clicking directly on an item in the tree
				// (the item is rebuilt on text area blur so the click never happens)
				// Should update TableTree to only re-render diff
				rebuildTree();
			}

			function setCode(code) {
				if(codeEditor.getDoc) {
					codeEditor.getDoc().setValue(code);
					let tabs = false;
					let indent = 4;
					if((code.match(/\n  [^ ]/g) || []).length) {
						indent = 2;
					} else if((code.match(/\n\t/g) || []).length > (code.match(/\n  /g) || []).length) {
						tabs = true;
					}

					codeEditor.setOption('indentUnit', indent);
					codeEditor.setOption('indentWithTabs', tabs);
					codeEditor.setOption('mode', {
						name: 'javascript',
						statementIndent: indent,
					});
				} else {
					codeEditor.value = code;
				}
			}

			let selectedEntry = null;
			tree.addEventListener('select', (item) => {
				saveState();
				if(item && item.baseEntry) {
					docutil.updateStyle(entrybox, {'display': 'inline-block'});
					setCode(item.baseEntry.code);
					titleEditor.value = item.baseEntry.title;
					selectedEntry = item.baseEntry;
				} else {
					docutil.updateStyle(entrybox, {'display': 'none'});
					selectedEntry = null;
				}
			});

			titleEditor.addEventListener('change', saveState);
			codeEditor.addEventListener('change', saveState);

			const entrybox = docutil.make('div', {'class': 'entry-editor'}, [
				docutil.make('label', {}, ['Title ', titleEditor]),
				docutil.make('div', {'class': 'code-editor'}, [codeEditor]),
			]);
			docutil.updateStyle(entrybox, {'display': 'none'});
			const manager = docutil.make('div', {'class': 'team-manager'}, [
				docutil.make('div', {'class': 'team-table-hold'}, [tree.dom()]),
				entrybox
			]);

			welcomePage.appendChild(manager);

			require([
				'codemirror/lib/codemirror',
				'codemirror/mode/javascript/javascript',
				'codemirror/addon/comment/comment',
				'codemirror/addon/edit/matchbrackets',
				'codemirror/addon/edit/trailingspace',
				'codemirror/lib/codemirror.css',
			], (CodeMirror) => {
				const code = codeEditor.value;
				codeEditor = CodeMirror.fromTextArea(codeEditor, {
					mode: {
						name: 'javascript',
					},
					lineNumbers: true,
					matchBrackets: true,
					showTrailingSpace: true,
					extraKeys: {
						'Tab': (cm) => cm.execCommand('indentMore'),
						'Shift-Tab': (cm) => cm.execCommand('indentLess'),
						'Cmd-/': (cm) => cm.execCommand('toggleComment'),
						'Ctrl-/': (cm) => cm.execCommand('toggleComment'),
					},
				});
				setCode(code);
				codeEditor.on('blur', saveState);
				// TODO: support searching (plugins: searchcursor, search + UI)
				// TODO: support line jumping (jump-to-line + UI)
				codeEditor.refresh(); // TODO: call after displaying page
			});

			// TODO
//			managedTeams = allTeams.map((team) => Object.assign({}, team, {
//				entries: team.entries.map((entry) => Object.assign({}, entry, {
//					pauseOnError: true,
//				})),
//			}));
		}

		function begin(teams) {
			teams.forEach((team) => team.entries.forEach((entry) => {
				entry.originalCode = entry.code;
			}));
			allTeams = teams;
			managedTeams = allTeams;

			welcomePage.appendChild(docutil.make('div', {'class': 'initial-options'}, [btnTournament, btnGame]));

			renderEntryManagement(allTeams);

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
			}
		});

		sandbox.postMessage({
			action: 'LOAD_ENTRIES',
			site,
			qid,
		});
	});
});
