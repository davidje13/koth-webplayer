'use strict';

requirejs([
	'requirejs',
	'document',
	'tester/Test',
	'tester/matchers',
	'tester/Lint',
], (
	requirejs,
	document,
	Test,
	matchers,
	Lint
) => {
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

	const test = new Test(matchers);
	const lint = new Lint();
	document.body.appendChild(test.dom());
	document.body.appendChild(lint.dom());

	test.invoke(testModules).then(() => {
		const jsPaths = requirejs.getAllPaths().filter((path) => !path.endsWith('.css'));
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
