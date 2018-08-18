define([
	'requirejs',
	'fs',
	'path',
	'os',
	'node/StackExchangeAPI',
	'node/nodeUtils',
	'node/logger',
],(
	requirejs,
	fs,
	path,
	os,
	StackExchangeAPI,
	nodeUtils,
	logger
) => {
	'use strict';
	/* globals console */

	function loadTeamType(type) {
		return requirejs('teams/' + type);
	}

	function loadMatchType(type) {
		return requirejs('matches/' + type);
	}

	function loadGameType(type) {
		const gameDir = 'games/' + type;
		return {
			pathGameManager: gameDir + '/GameManager',
			GameScorer: requirejs(gameDir + '/GameScorer'),
		};
	}

	//Took some reverse engineering to figure out what the hell was going on
	//This basically turns
	//	define([$1], ($2) => {$3});
	//into
	//	requirejs.define($PATH, [$1], ($2) => {$3});
	//as far as I can tell. The original is in core/requirejs.js
	function wrappedDefinition(src) {
		let str = fs.readFileSync(nodeUtils.wrappedPath(src), 'utf8');
		return str.replace(
			'define(',
			'requirejs.define('+nodeUtils.stringifySingle(src, false)+', '
		);
	}

	function loadPromisify(p) {
		return new Promise((resolve, reject) => {
			fs.readFile(p, {encoding: 'utf8'}, (err, data) => (
				err?reject(err):resolve(data)
			));
		});
	}

	// Includes take the form of a path to a file consisting a JSON array
	// of JSON objects of the following form:
	// {
	//     answerID: <number>,
	//     userName: <string>,
	//     userID: <number>,
	//     link: <string>,
	//     title: <string>,
	//     codeBlocks: [<string>...]
	// }
	//
	// enabled is automatically put on if the import worked
	function includeParse(includePath) {
		return loadPromisify(path.join(
			os.homedir(),
			'koth-webplayer',
			includePath
		)).then((data) => {
			if (data === '') {
				return [];
			}
			let objArray = JSON.parse(data);
			if (!Array.isArray(objArray)) {
				throw new Error('Local submission file must be a JSON array');
			}
			objArray.forEach((obj, index) => {
				//Validate that obj elements has the properties expected of it
				if (!Number.isInteger(obj.answerID)) {
					throw new Error('Local submission ' +
						index + ' at ' + includePath +
						' is missing a numeric answer ID'
					);
				} else if (!Number.isInteger(obj.userID)) {
					throw new Error('Local submission ' +
						index + ' at ' + includePath +
						' is missing a numeric user ID'
					);
				} else if (!Array.isArray(obj.codeBlocks)) {
					throw new Error('Local submission ' +
						index + ' at ' + includePath +
						' is missing array of code blocks'
					);
				} else if (!obj.codeBlocks.every((block) => block.constructor === String)) {
					throw new Error('Local submission ' +
						index + ' at ' + includePath +
						' has a non-string in a code block'
					);
				}
				Object.assign(obj, {
					enabled: true,
					link: 'file://'+path.join(os.homedir(), 'koth-webplayer', includePath),
					blockHash: nodeUtils.hashBlock(obj.codeBlocks),
				});
				//This isn't ideal, but we can create reasonable ersatz values for these fields
				if (obj.userName.constructor !== String) {
					obj.userName = 'Unknown user ' + obj.userID;
				}
				if (obj.title.constructor !== String) {
					obj.title = 'Unknown competitor from ' + obj.link;
				}
			});
			return objArray;
		}).catch((err) => {
			throw err;
		});
	}

	// Excludes take the form of a path to a file consisting a JSON array
	// of JSON objects of the following form:
	// {
	//     field: one of 'blockHash', 'answerID', 'userID'
	//     value: <string> (for blockHash), <number> (for answerID or userID)
	//     reason: <object>
	// }
	//
	// This provides some basic, automatable answer moderation.
	//
	// If you need greater granularity or blocking power, then gather
	// the answers, filter them yourself (perhaps with json-understanding tools),
	// and run the tournament off of local entries. Or pull the source and
	// implement your own filtering logic right in the source code!
	function excludeParse(excludePath) {
		return loadPromisify(path.join(
			os.homedir(),
			'koth-webplayer',
			excludePath
		)).then((data) => {
			if (data === '') {
				return () => null;
			}
			let objArray = JSON.parse(data);
			if (!Array.isArray(objArray)) {
				throw new Error('Exclusion file must be a JSON array');
			}
			return objArray.map((obj, index) => {
				//Validate that obj elements has the properties expected of it
				if (!(obj.reason instanceof Object && obj.reason.constructor === Object)) {
					throw new Error('Exclude rule ' +
						index + ' at ' + excludePath +
						' is missing a reason object'
					);
				}
				if (obj.field === 'blockHash') {
					if (obj.value.constructor !== String) {
						throw new Error('Exclude rule ' +
							index + ' at ' + excludePath +
							' has a non-string for value'
						);
					} else {
						return (entry) => (entry.blockHash === obj.value)?obj.reason:null;
					}
				} else if (obj.field === 'answerID') {
					if (!Number.isInteger(obj.value)) {
						throw new Error('Exclude rule ' +
							index + ' at ' + excludePath +
							' has a non-integer for value'
						);
					} else {
						return (entry) => (entry.answerID === obj.value)?obj.reason:null;
					}
				} else if (obj.field === 'userID') {
					if (!Number.isInteger(obj.value)) {
						throw new Error('Exclude rule ' +
							index + ' at ' + excludePath +
							' has a non-integer for value'
						);
					} else {
						return (entry) => (entry.userID === obj.value)?obj.reason:null;
					}
				} else {
					throw new Error(
						'Exclude rule ' +
						index + ' at ' + excludePath +
						' needs a field attribute that is one of ' +
						'\'blockHash\', \'answerID\', or \'userID\''
					);
				}
			});
		}).catch((err) => {
			throw err;
		});
	}

	function loadEntriesOnline(site, qid) {
		return new StackExchangeAPI().requestAnswers(site, qid, nodeUtils.parseAnswer);
	}

	function loadEntriesOffline(includes=undefined) {
		let loadLogger = null;
		if (logger.topLevel) {
			loadLogger = logger.topLevel.openHandle('loader');
		}
		//Disassemble an array of promises, and rebuild it into a promise of an array
		//Log and skip the errant entries
		if (includes !== undefined) {
			let promiseArray = includes.map((includePath) => {
				return includeParse(includePath).then((parsedList) => {
					return parsedList;
				}, (reason) => {
					if (loadLogger) {
						loadLogger.log(reason.toString(), 'warn');
					} else {
						console.warn(reason.toString());
					}
					return [];
				});
			});
			return Promise.all(promiseArray).then((resolvedArray) => {
				return [].concat.apply([], resolvedArray);
			});
		} else {
			return Promise.resolve([]);
		}
	}

	function loadFilters(excludes=undefined) {
		//Disassemble an array of promises, and rebuild it into a promise of an array
		//Log and skip the errant entries
		let filterLogger = null;
		if (logger.topLevel) {
			filterLogger = logger.topLevel.openHandle('filter');
		}
		let promiseArray = excludes.map((excludePath) => {
			return excludeParse(excludePath).then((parsedList) => {
				return parsedList;
			}, (reason) => {
				if (filterLogger) {
					filterLogger.log(reason.toString(), 'warn');
				} else {
					console.warn(reason.toString());
				}
				return [];
			});
		});
		return Promise.all(promiseArray).then((resolvedArray) => {
			let completeArray = [].concat.apply([], resolvedArray);
			return (candidate) => {
				for (let filter of completeArray) {
					let reason = filter(candidate);
					if (reason !== null) {
						return reason;
					}
				}
				return null;
			};
		});
	}

	return {
		loadTeamType,
		loadMatchType,
		loadGameType,
		wrappedDefinition,
		loadEntriesOnline,
		loadEntriesOffline,
		loadFilters,
	};
});
