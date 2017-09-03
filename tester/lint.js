define(['require', 'document', 'jshint/jshint'], (require, document, jshint) => {
	'use strict';

	function makeJSHintOptions(predef) {
		return {
			// Environment
			predef,
			esversion: 6,
			browser: true,
			typed: true,

			// Error verbosity
			bitwise: true,
			curly: true,
			eqeqeq: true,
			forin: true,
			freeze: true,
			futurehostile: true,
			latedef: true,
			maxcomplexity: 10,
			maxdepth: 3,
			maxparams: 6,
			maxstatements: 50,
			noarg: true,
			nocomma: true,
			nonbsp: true,
			nonew: true,
			shadow: 'outer',
			singleGroups: false,
			strict: true,
			trailingcomma: true,
			undef: true,
			unused: true,
			varstmt: true,

			// Deprecated code-style flags:
			camelcase: true,
			immed: true,
			indent: 4,
			maxlen: 100,
			newcap: true,
			noempty: true,
			quotmark: 'single',

			// Output options
			maxerr: 100,
		};
	}

	const PREDEF = [
		'-document',
		'self',
		'define',
		'crypto',
		'ImageData',
	];

	const PREDEF_TEST = [
		'describe',
		'it',
		'itAsynchronously',
		'expect',
		'not',
		'equals',
		'hasType',
		'isInteger',
		'isGreaterThan',
		'isLowerThan',
		'isNear',
		'fail',
	].concat(PREDEF);

	const LINE_DIFF = 3;

	const JSHINT_OPTIONS = makeJSHintOptions(PREDEF);
	const JSHINT_OPTIONS_TEST = makeJSHintOptions(PREDEF_TEST);

	const baseLintElement = document.createElement('div');
	baseLintElement.setAttribute('class', 'lint-hold');
	const lintTitle = document.createElement('h1');
	const lintTitleText = document.createTextNode('Linter');
	lintTitle.appendChild(lintTitleText);
	baseLintElement.appendChild(lintTitle);
	document.body.appendChild(baseLintElement);

	function log(type, message) {
		const element = document.createElement('div');
		element.setAttribute('class', type);
		element.appendChild(document.createTextNode(message));
		baseLintElement.appendChild(element);
	}

	function formatError(error) {
		const evidence = error.evidence && error.evidence.replace(/\t/g, '    ');
		if(error.code === 'W140') {
			// Don't warn about lack of trailing comma for inline objects/lists
			const c = evidence.charAt(error.character - 1);
			if(c === ']' || c === '}') {
				return null;
			}
		}
		return (
			error.code +
			' @' + (error.line - LINE_DIFF) + ':' + error.character +
			': ' + error.reason +
			'\n' + evidence
		);
	}

	function invokeOne(path) {
		return require(['def:' + path], (def) => {
			let code = def.code();
			if(!code) {
				log('lint-skip', path + ' SKIP');
				return true;
			}

			if(code.startsWith('require.define')) {
				code = code.substr('require.'.length);
			}

			// Ignore number of args in module definitions
			code = '/* jshint -W072 */\n' + code.replace(/\{/, '{\n/* jshint +W072 */\n');

			if(path.indexOf('/example/') !== -1) {
				// Don't warn about unused vars or empty blocks; they are for guidance
				code = '/* jshint -W098 *//* jshint -W035 */' + code;
			}

			jshint.JSHINT(
				code,
				path.endsWith('_test') ? JSHINT_OPTIONS_TEST : JSHINT_OPTIONS
			);
			const errors = jshint.JSHINT.errors;

			const messages = (
				errors
				.map((error) => formatError(error))
				.filter((error) => (error !== null))
			);

			if(messages.length > 0) {
				log('lint-failure', path + ' FAIL');
				messages.forEach((error) => log('lint-item', error));
				return false;
			} else {
				log('lint-pass', path + ' PASS');
				return true;
			}
		});
	}

	return {
		invoke: (paths) => {
			return (
				Promise.all(paths.map((path) => invokeOne(path)))
				.then((passes) => {
					const allPass = passes.every((pass) => pass);
					let title = '';
					if(allPass) {
						title = 'Linter: All done (' + passes.length + ').';
					} else {
						title = 'Linter: FAIL';
					}
					lintTitleText.nodeValue = title;
				})
			);
		},
	};
});
