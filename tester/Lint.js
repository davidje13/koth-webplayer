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
			maxparams: 5,
			maxstatements: 30,
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
		'identicalTo',
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

	function log(target, type, message) {
		const element = document.createElement('div');
		element.setAttribute('class', type);
		element.appendChild(document.createTextNode(message));
		target.appendChild(element);
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

	return class Lint {
		constructor() {
			this.baseLintElement = document.createElement('div');
			this.baseLintElement.setAttribute('class', 'lint-hold');
			const lintTitle = document.createElement('h1');
			this.lintTitleText = document.createTextNode('Linter');
			lintTitle.appendChild(this.lintTitleText);
			this.baseLintElement.appendChild(lintTitle);

			this.invokeOne = this.invokeOne.bind(this);
		}

		dom() {
			return this.baseLintElement;
		}

		log(type, message) {
			log(this.baseLintElement, type, message);
		}

		invokeOne(module) {
			return require(['def:' + module], (def) => {
				let code = def.code();
				if(!code) {
					this.log('lint-skip', module + ' SKIP');
					return true;
				}

				if(code.startsWith('require.define')) {
					code = code.substr('require.'.length);
				}

				// Ignore number of args in module definitions
				code = (
					'/* jshint -W072 */\n' +
					code.replace(/\{/, '{\n/* jshint +W072 */\n')
				);

				if(module.indexOf('/example/') !== -1) {
					// Don't warn about unused vars or empty blocks in examples;
					// they are for guidance
					code = '/* jshint -W098 *//* jshint -W035 */' + code;
				}

				jshint.JSHINT(
					code,
					module.endsWith('_test') ? JSHINT_OPTIONS_TEST : JSHINT_OPTIONS
				);
				const errors = jshint.JSHINT.errors;

				const messages = (
					errors
					.map((error) => formatError(error))
					.filter((error) => (error !== null))
				);

				const testStyle = (regex, errCode, message, ln, lineNumber) => {
					const match = ln.match(regex);
					if(match) {
						messages.push(
							errCode + ' @' + (lineNumber + 1 - LINE_DIFF) +
							':' + match.index +
							': ' + message
						);
					}
				};

				code.split('\n').forEach((ln, lineNumber) => {
					testStyle(
						/^ [^*]/,
						'WHITESPACE', 'incorrect indentation (prefer tabs)',
						ln, lineNumber
					);
					testStyle(
						/ \t/,
						'WHITESPACE', 'space followed by tab',
						ln, lineNumber
					);
					testStyle(
						/[ \t]$/,
						'WHITESPACE', 'trailing whitespace',
						ln, lineNumber
					);
					testStyle(
						/\)\{/,
						'WHITESPACE', 'missing whitespace before code block',
						ln, lineNumber
					);
				});

				if(messages.length > 0) {
					this.log('lint-failure', module + ' FAIL');
					messages.forEach((error) => this.log('lint-item', error));
					return false;
				} else {
					this.log('lint-pass', module + ' PASS');
					return true;
				}
			});
		}

		invoke(modules) {
			return (
				Promise.all(modules.map(this.invokeOne))
				.then((passes) => {
					const allPass = passes.every((pass) => pass);
					let title = '';
					if(allPass) {
						title = 'Linter: All done (' + passes.length + ').';
					} else {
						title = 'Linter: FAIL';
					}
					this.lintTitleText.nodeValue = title;
				})
			);
		}
	};
});
