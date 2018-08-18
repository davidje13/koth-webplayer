define([
	'fs', 'path', 'os',
	'node-getopt', 'cheerio', 'cssesc', 'requirejs',
	'node/loaders', 'node/GameOrchestrator', 'node/nodeUtils',
	'node/TournamentSummary', 'node/MatchwiseSummary', 'node/logger',
	'engine/TournamentRunner',
], (
	fs, path, os,
	getopt, cheerio, cssesc, requirejs,
	loaders, GameOrchestrator, nodeUtils,
	TournamentSummary, MatchwiseSummary, logger,
	TournamentRunner
) => {
	/* globals process, console */
	'use strict';

	const EXIT_SUCCESS = 0;
	const EXIT_SUBMISSION_ERROR = 1;
	const EXIT_RUNTIME_ERROR = 2;
	const EXIT_LOAD_ERROR = 3;
	const EXIT_INVALID = 4;
	const nameDescription = 'koth-webplayer node tournament runner v0.1.4';
	Error.stackTraceLimit = 100;

	//Rewire signals so they unconditionally cause process exits
	process.on('SIGINT', ()=>{process.exit();});
	process.on('SIGTERM', ()=>{process.exit();});
	process.on('SIGBREAK', ()=>{process.exit();}); //Not everyone uses unix

	process.exitCode = EXIT_INVALID;

	const optParams = getopt.create([
		['d', 'dry-run',
			'Show configuration and players instead of running'],
		['n', 'number-of-games=GAMES',
			'Set number of games to play per match'],
		['N', 'number-of-workers=WORKERS',
			'Set number of worker processes'],
		['v', 'verbose',
			'Increase levels of diagnostic output'],
		['Q', 'question-id=QID',
			'Set question ID to obtain submissions from'],
		['o', 'offline',
			'Do not load submissions from the internet'],
		['g', 'gather+',
			'Gather and save online submissions, repeat to gather only'],
		['I', 'include=FILES+',
			'Additionally include local submissions from the koth-webplayer directory'],
		['e', 'exclude=FILES+',
			'Load these exclusion rules from the koth-webplayer directory'],
		['', 'matchwise',
			'Display by match, rather than by game'],
		['', 'no-disqualify-read',
			'Don\'t read the default exclude filter'],
		['', 'no-disqualify-write',
			'Don\'t write to the default exclude filter'],
		['q', 'quiet',
			'turn off the UI, letting error messages out unimpeded'],
		['s', 'silent',
			'turn off textual output completely, including error messages'],
		['', 'disqualify-reaction=(ignore|exclude|excise|teardown)',
			'Set reaction to entry disqualification'],
		['', 'error-reaction=(ignore|exclude|excise|teardown)',
			'Set reaction to entry error'],
		['i', 'with-seed=ARG',
			'Set the tournament seed'],
		['V', 'version',
			'show version'],
		['h', 'help',
			'Display this help'],
	]).setHelp(
		'Usage: node main.js [OPTIONS] [gamefile.htm]\n' +
		'       node main.js [OPTIONS] -h|--help\n' +
		'       node main.js [OPTIONS] -V|--version\n' +
		nameDescription + '\n' +
		'\n' +
		'[[OPTIONS]]'
	);

	const opts = optParams.parseSystem();

	//If the h or V flags are specified, then expect 0-len argv,
	//and perform the corresponding function
	const performHelp = opts.options.hasOwnProperty('help');
	const performVersion = opts.options.hasOwnProperty('version');
	const silent = opts.options.hasOwnProperty('silent');
	const quiet = opts.options.hasOwnProperty('quiet') || silent;
	const matchwise = opts.options.hasOwnProperty('matchwise');

	if (opts.argv.length === 0) {
		if (performHelp) {
			optParams.showHelp();
			process.exit(EXIT_SUCCESS);
		} else if (performVersion) {
			// eslint-disable-next-line no-console
			console.info(nameDescription);
			process.exit(EXIT_SUCCESS);
		} else {
			optParams.showHelp();
			process.exit(EXIT_INVALID);
		}
	}

	if (opts.argv.length === 1 && (performHelp || performVersion)) {
		optParams.showHelp();
		process.exit(EXIT_INVALID);
	}

	if (opts.argv.length > 1) {
		optParams.showHelp();
		process.exit(EXIT_INVALID);
	}

	//Okay, arguments validated.
	process.exitCode = EXIT_LOAD_ERROR;

	//If we've passed the first parts, scrape the given argument for meta tags

	let cpuLimit = Math.max(
		Math.min(
			os.cpus().length - 1,
			Math.floor(os.freemem()/1.2e8) - 1
		), 1
	);

	let $ = cheerio.load(fs.readFileSync(opts.argv[0], 'utf8'));

	function meta(doc, name, def=null) {
		let value = doc('meta[name=\'' + cssesc(name) + '\'][content]').attr('content');
		return (value === undefined)?def:value.toString();
	}

	let site = meta($, 'stack-exchange-site');
	let qid = opts.options.hasOwnProperty('question-id')?
		opts.options['question-id']:
		meta($, 'stack-exchange-qid');
	let title = $('title').html();
	let workerOverride = opts.options.hasOwnProperty('number-of-workers');
	let pageConfig = {
		pageTitle: (title===undefined)?null:title,
		maxConcurrency: workerOverride?opts.options['number-of-workers']:cpuLimit,
		gameType: meta($, 'game-type'),
		teamType: meta($, 'team-type', 'free_for_all'),
		teamTypeArgs: JSON.parse(meta($, 'team-type-args', '{}')),
		tournamentType: meta($, 'tournament-type', 'brawl'),
		tournamentTypeArgs: JSON.parse(meta($, 'tournament-type-args', '{}')),
		matchType: meta($, 'match-type', 'brawl'),
		matchTypeArgs: JSON.parse(meta($, 'match-type-args', '{}')),
		baseGameConfig: JSON.parse(meta($, 'game-config', '{}')),
		basePlayHiddenConfig: JSON.parse(meta($, 'play-hidden-config',
			'{"speed": -1, "checkbackTime": 2000}'
		)),
		baseDisplayConfig: {}, //Don't think we'll be displaying anything
		site,
		qid,
		codeTemplate: meta($, 'stack-exchange-code-template', '{{codeblock:0}}\n'),
		questionURL: meta($, 'stack-exchange-question-url',
			'https://'+site+'.stackexchange.com/questions/'+qid
		),
		githubLink: 'https://github.com/davidje13/koth-webplayer',
	};

	if (opts.options.hasOwnProperty('number-of-games')) {
		pageConfig.matchTypeArgs.count = opts.options['number-of-games'];
	}

	if ((!opts.options.hasOwnProperty('gather') || opts.options.gather.length <= 1)) {
		if (!opts.options.hasOwnProperty('dry-run')) {
			logger.topLevelInstantiate(
				opts.options.hasOwnProperty('verbose')?'verbose':'info'
			);
		}
	}

	let onlinePromise;
	if (opts.options.hasOwnProperty('offline')) {
		onlinePromise = Promise.resolve([]);
	} else {
		onlinePromise = loaders.loadEntriesOnline(pageConfig.site, pageConfig.qid);
	}

	let explicitFilterArray = opts.options.hasOwnProperty('exclude')?
		opts.options.exclude:
		[];
	let implicitFilterArray = opts.options.hasOwnProperty('no-disqualify-read')?
		[]:
		[opts.argv[0]+'-disqualified.json'];
	let openingPromise = nodeUtils.mkdirExistPromise(path.join(
		os.homedir(), 'koth-webplayer'
	));

	let fullLoadPromise;
	if (!opts.hasOwnProperty('no-disqualify-read')) {
		fullLoadPromise = new Promise((resolve, reject) => (
			openingPromise.then(() => {
				fs.writeFile(path.join(
					os.homedir(), 'koth-webplayer', opts.argv[0]+'-disqualified.json'
				), '', {flag: 'a+'}, (err) => err?reject(err):resolve());
			}, (err) => {
				reject(err);
			})
		));
	} else {
		fullLoadPromise = openingPromise;
	}

	let offlinePromise = openingPromise.then(() =>
		loaders.loadEntriesOffline(opts.options.include)
	);
	let filterPromise = fullLoadPromise.then(() =>
		loaders.loadFilters(explicitFilterArray.concat(implicitFilterArray))
	);

	let writeArrayPromise;
	if (opts.options.hasOwnProperty('gather')) {
		let multiPromise = Promise.all([onlinePromise, filterPromise]);
		writeArrayPromise = multiPromise.then((promiseArray) =>
			new Promise((resolve, reject) => {
				let date = new Date();
				fs.writeFile(path.join(
					os.homedir(),
					'koth-webplayer',
					'gathered-'+opts.argv[0]+'-'+date.toISOString()
				), JSON.stringify(promiseArray[0].filter(
					(ent => promiseArray[2](ent) === null)
				), null, 2), (err) => err?reject(err):resolve());
			})
		);
	} else {
		writeArrayPromise = Promise.resolve();
	}

	/* jshint maxcomplexity: 15 */
	/* jshint maxstatements: 60 */
	Promise.all([onlinePromise, offlinePromise, filterPromise]).then((promiseArray)=>{
		let entries = promiseArray[0].concat(promiseArray[1]);
		let excludeFilter = promiseArray[2];
		entries.forEach((entry, index) => {
			entry.pauseOnError = false;
			entry.id = 'E' + index;
			entry.code = nodeUtils.parseEntryCode(
				pageConfig.codeTemplate,
				entry.codeBlocks
			);
			Object.assign(entry, excludeFilter(entry));
		});

		let filteredEntries = entries.filter((entry) => entry.enabled);

		if (opts.options.hasOwnProperty('dry-run')) {
			console.log(JSON.stringify(pageConfig, null, 2));
			console.log(JSON.stringify(entries, [
				'answerID',
				'userName',
				'link',
				'title',
				'enabled',
				'id',
				'error',
			], 2));
			process.exit(EXIT_SUCCESS);
		} else if (opts.options.hasOwnProperty('gather') && opts.options.gather.length > 1) {
			writeArrayPromise.then(() => {
				if (!silent) {
					entries.forEach((entry) => {
						if (!entry.enabled) {
							console.warn('Entry from ' +
								entry.link + ' disabled:', entry.error
							);
						}
					});
				}
				process.exit(EXIT_SUCCESS);
			}, (err) => {
				console.log(err);
				process.exit(EXIT_LOAD_ERROR);
			});
		} else {
			let entryLogger = logger.topLevel.openHandle('entry');
			entries.forEach((entry) => {
				if (entry.enabled && !entry.disqualified && !entry.error) {
					entryLogger.log({
						title: entry.title,
						answerID: entry.answerID,
						blockHash: entry.blockHash,
						eachBlock: entry.codeBlocks.map(nodeUtils.hashBlock),
						userName: entry.userName,
						userID: entry.userID,
						enabled: entry.enabled,
					}, 'info');
				} else {
					entryLogger.log({
						title: entry.title,
						answerID: entry.answerID,
						blockHash: entry.blockHash,
						eachBlock: entry.codeBlocks.map(nodeUtils.hashBlock),
						userName: entry.userName,
						userID: entry.userID,
						enabled: entry.enabled,
						disqualified: entry.disqualified,
						error: entry.error,
						errorInput: entry.errorInput,
						errorOutput: entry.errorOutput,
					}, 'warn');
				}
			});

			let {pathGameManager, GameScorer} = loaders.loadGameType(pageConfig.gameType);
			let TeamMaker = loaders.loadTeamType(pageConfig.teamType);
			let Tournament = loaders.loadMatchType(pageConfig.tournamentType);
			let Match = loaders.loadMatchType(pageConfig.matchType);

			let allTeams = TeamMaker.pickTeams(filteredEntries, pageConfig.teamTypeArgs);
			let tSeed = opts.options.hasOwnProperty('with-seed')?
				opts.options['with-seed'].substr(opts.options['with-seed'].length-20):
				nodeUtils.makeRandomSeed();

			class TournamentGameRunner {
				constructor({gameRunner, gameOpts}) {
					this.game = gameRunner.make(gameOpts);
				}

				begin(seed, teams, progressCallback) {
					return new Promise((resolve) => {
						this.game.addEventListener('complete', (state) => {
							const config = this.game.getGameConfig();
							this.game.terminate();
							resolve({config, state});
						});
						this.game.addEventListener('update', (state) => {
							const config = this.game.getGameConfig();
							progressCallback(state.progress, {config, state});
						});
						this.game.begin(seed, teams);
					});
				}
			}

			let dqReaction;
			if (['ignore', 'exclude', 'excise', 'teardown'].includes(
				opts.options['disqualify-reaction']
			)) {
				dqReaction = opts.options['disqualify-reaction'];
			} else {
				dqReaction = 'exclude';
			}

			let errReaction;
			if (['ignore', 'exclude', 'excise', 'teardown'].includes(
				opts.options['error-reaction']
			)) {
				errReaction = opts.options['error-reaction'];
			} else {
				errReaction = 'ignore';
			}

			let tournamentDisplay;
			if (matchwise) {
				tournamentDisplay = new MatchwiseSummary({
					seed: tSeed,
					quiet: quiet,
					disqualifyReaction: dqReaction,
					errorReaction: errReaction,
				});
			} else {
				tournamentDisplay = new TournamentSummary({
					seed: tSeed,
					quiet: quiet,
					disqualifyReaction: dqReaction,
					errorReaction: errReaction,
				});
			}

			let scoreHandle = logger.topLevel.openHandle('score');

			const structureGame = {
				seedPrefix: 'G',
				runner: TournamentGameRunner,
				args: {
					gameRunner: new GameOrchestrator(pathGameManager, {
						maxConcurrency: pageConfig.maxConcurrency,
						pathToFilter: opts.options.hasOwnProperty('no-disqualify-write')?
							null:
							path.join(
								os.homedir(),
								'koth-webplayer',
								opts.argv[0]+'-disqualified.json'
							),
						disqualifyReaction: dqReaction,
						errorReaction: errReaction,
					}),
					gameOpts: {
						baseGameConfig: pageConfig.baseGameConfig,
						basePlayConfig: pageConfig.basePlayHiddenConfig,
						baseDisplayConfig: pageConfig.baseDisplayConfig,
					},
				},
				scorer: {
					score: (teams, {config, state}) => {
						return GameScorer.score(config, state);
					},
				},
				display: (parent, {seed, index}) => {
					const disp = parent.addGame(seed, 'G' + (index + 1));
					return disp;
				},
			};

			const structureMatch = {
				seedPrefix: 'M',
				runner: Match,
				args: pageConfig.matchTypeArgs,
				scorer: requirejs('engine/MatchScorer'),
				display: (parent, {seed, teams, index}) => {
					const matchDisplay = parent.createMatch({
						name: (matchwise?'M':'Match ') + (index + 1),
						seed,
						teams,
					});
					return matchDisplay;
				},
				sub: structureGame,
			};

			const structureTournament = {
				seedPrefix: 'T',
				runner: Tournament,
				args: pageConfig.tournamentTypeArgs,
				scorer: {score: (teams, scores) => scores},
				display: () => tournamentDisplay,
				sub: structureMatch,
			};

			process.exitCode = EXIT_RUNTIME_ERROR;

			if (allTeams.length < 2) { //Not much of a contest with fewer than 2 teams
				if (!silent) {
					tournamentDisplay.cleanup();
					console.log('Not enough teams participating');
				}
				scoreHandle.log('Not enough teams participating');
				process.exitCode = EXIT_SUBMISSION_ERROR;
				let finalGatherPromise;
				if (opts.options.hasOwnProperty('gather')) {
					let gatherHandle = logger.topLevel.openHandle('gather');
					finalGatherPromise = writeArrayPromise.then(() => {
						gatherHandle.log('Gathering succeeded');
					}, (err) => {
						gatherHandle.log(err, 'error');
						if (!silent) {
							console.warn('Gathering error:');
							console.warn(err.toString());
						}
					});
				} else {
					finalGatherPromise = Promise.resolve(null);
				}
				finalGatherPromise.then(() => {
					process.exit();
				}).catch(() => {
					process.exit();
				});
			} else {
				let fatalHandle = logger.topLevel.openHandle('fatal');
				process.on('unhandledRejection', (reason) => {
					if (!silent) {
						tournamentDisplay.cleanup();
						console.error('Unhandled Rejection: ' + reason.message);
						console.error(reason.stack);
					}
					fatalHandle.log('Unhandled Rejection: ' + reason, 'error');
					fatalHandle.log(reason.stack, 'error');
					process.exit(EXIT_RUNTIME_ERROR);
				});

				process.on('uncaughtException', (err) => {
					if (!silent) {
						tournamentDisplay.cleanup();
						console.error('Uncaught Exception: ' + err.message);
						console.error(err.stack);
					}
					fatalHandle.log('Uncaught Exception: ' + err.message, 'error');
					fatalHandle.log(err.stack, 'error');
					process.exit(EXIT_RUNTIME_ERROR);
				});

				process.exitCode = EXIT_SUCCESS;
				new TournamentRunner(structureTournament).begin(
					'T' + tSeed,
					allTeams,
					() => {}
				).then((scores) => {
					if (!quiet) {
						tournamentDisplay.cleanup();
						console.log('Tournament complete');
						scores.filter((score) => {
							if (['excise', 'teardown'].includes(dqReaction)) {
								if (score.teams.some(team => team.disqualified)) {
									return false;
								}
							}
							if (['excise', 'teardown'].includes(errReaction)) {
								if (score.teams.some(team => team.error)) {
									return false;
								}
							}
							return score.teams.some(team =>
								(dqReaction === 'ignore' || !team.disqualified) &&
								(errReaction === 'ignore' || !team.error)
							);
						}).forEach(function (score) {
							console.table(score.teams.map(s =>
								({
									id: s.id,
									total: s.total,
									certainty: s.certainty,
									disqualified: s.disqualified,
									error: s.error,
								})
							));
						});
					}
					scoreHandle.log(scores);
					let finalGatherPromise;
					if (opts.options.hasOwnProperty('gather')) {
						let gatherHandle = logger.topLevel.openHandle('gather');
						finalGatherPromise = writeArrayPromise.then(() => {
							gatherHandle.log('Gathering succeeded');
						}, (err) => {
							gatherHandle.log(err, 'error');
							if (!silent) {
								console.warn('Gathering error:');
								console.warn(err.toString());
							}
						});
					} else {
						finalGatherPromise = Promise.resolve(null);
					}
					finalGatherPromise.then(() => {
						process.exit();
					}).catch(() => {
						process.exit();
					});
				});
			}
		}
	});
});
