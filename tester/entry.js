'use strict';

require(['require', 'document', 'tester/test', 'tester/lint'], (require, document, test, lint) => {
	const elements = document.getElementsByTagName('meta');
	const testModules = [];
	const lintModules = [];
	for(let i = 0; i < elements.length; ++ i) {
		const meta = elements[i];
		if(meta.getAttribute('name') === 'module') {
			testModules.push(meta.getAttribute('content'));
		}
		if(meta.getAttribute('name') === 'lint-module') {
			lintModules.push(meta.getAttribute('content'));
		}
	}

	test.invoke(testModules).then(() => {
		const jsPaths = require.getAllPaths().filter((path) => !path.endsWith('.css'));
		lintModules.forEach((module) => {
			if(jsPaths.indexOf(module) === -1) {
				jsPaths.push(module);
			} else {
				console.warn('Unnecessary lint-module entry: ' + module);
			}
		});
		lint.invoke(jsPaths);
	});
});
