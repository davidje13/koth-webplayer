define([
	'require',
	'document',
	'./matchers',
	'./test.css',
], (
	require,
	document,
	matchers
) => {
	'use strict';

	let globalErrorExpected = false;
	let activeFailPath = null;
	let queue = [];
	const scopes = [{description: '', skip: false, test: false}];
	let scopeDepth = 1;

	self.fail = (reason) => {
		if(typeof reason !== 'object') {
			reason = new Error(reason);
		}
		if(activeFailPath) {
			activeFailPath(reason);
			globalErrorExpected = true;
			throw 'CAPTURED FAILURE'; // Escape current test
		} else {
			throw reason;
		}
	};

	matchers(self, self.fail);

	let count = 0;
	let skipped = 0;
	let failed = 0;
	let totalCount = 0;
	let totalSkipped = 0;
	let totalFailed = 0;

	const baseTestElement = document.createElement('div');
	baseTestElement.setAttribute('class', 'test-hold');
	const testTitle = document.createElement('h1');
	const testTitleText = document.createTextNode('Unit Tests');
	testTitle.appendChild(testTitleText);
	baseTestElement.appendChild(testTitle);
	document.body.appendChild(baseTestElement);

	function log(type, message, subMessage) {
		const element = document.createElement('div');
		element.setAttribute('class', type);
		element.appendChild(document.createTextNode(message));
		if(subMessage) {
			element.appendChild(document.createElement('br'));
			const sub = document.createElement('span');
			sub.appendChild(document.createTextNode(subMessage));
			element.appendChild(sub);
		}
		baseTestElement.appendChild(element);
	}

	function currentPath() {
		let path = '';
		for(let i = 0; i < scopeDepth; ++ i) {
			if(path) {
				path += ' \u203A ';
			}
			path += scopes[i].description;
		}
		return path;
	}

	function stringifyError(e) {
		if(!e) {
			return '';
		}
		let msg = e.toString();
		if(e.stack) {
			// WORKAROUND (Safari): e.stack is not string-like unless it
			// has a non-empty string appended
			const stack = e.stack + '.';
			if(stack.indexOf(msg) !== -1) {
				msg = stack;
			} else {
				msg += ' : ' + stack;
			}
		}
		return msg;
	}

	function logFailure(e) {
		log('failure', currentPath(), stringifyError(e));
	}

	function logTestFailure(e) {
		log('test-failure', currentPath(), stringifyError(e));
	}

	function currentScope() {
		return scopes[scopeDepth - 1];
	}

	function enterScope(description) {
		const scope = {
			description,
			skip: currentScope().skip,
			test: false,
		};
		scopes[scopeDepth] = scope;
		++ scopeDepth;
		return scope;
	}

	function leaveScope() {
		-- scopeDepth;
	}

	let invokeQueueSynchronously = null;

	function invoke({description, fn, skip, test}) {
		if(currentScope().test) {
			logTestFailure('attempt to nest inside it() block: ' + description);
			++ failed;
		}

		const scope = enterScope(description);
		if(skip) {
			scope.skip = true;
		}

		if(test) {
			scope.test = true;
			if(scope.skip) {
				++ skipped;
				leaveScope();
				return Promise.resolve();
			}
			++ count;
		}

		return (
			new Promise((resolve, reject) => {
				activeFailPath = reject;
				Promise.all([fn()]).then(resolve);
			})
			.then(invokeQueueSynchronously)
			.then(leaveScope)
			.catch((e) => {
				if(test) {
					logTestFailure(e);
					++ failed;
				} else {
					logFailure(e);
				}
				leaveScope();
			})
		);
	}

	function invokeNextSynchronously(currentQueue) {
		if(!currentQueue.length) {
			return Promise.resolve();
		}
		return (
			invoke(currentQueue.shift())
			.then(() => invokeNextSynchronously(currentQueue))
		);
	}

	invokeQueueSynchronously = () => {
		const currentQueue = queue;
		queue = [];
		return invokeNextSynchronously(currentQueue);
	};

	self.describe = (description, fn) => {
		queue.push({description, fn, skip: false, test: false});
	};

	self.xdescribe = (description, fn) => {
		queue.push({description, fn, skip: true, test: false});
	};

	self.it = (description, fn) => {
		queue.push({description, fn, skip: false, test: true});
	};

	self.xit = (description, fn) => {
		queue.push({description, fn, skip: true, test: true});
	};

	self.itAsynchronously = (description, fn) => {
		queue.push({
			description,
			fn: () => new Promise((resolve) => fn(resolve)),
			skip: false,
			test: true,
		});
	};

	self.xitAsynchronously = (description, fn) => {
		queue.push({description, fn, skip: true, test: true});
	};

	self.addEventListener('error', (e) => {
		if(globalErrorExpected) {
			globalErrorExpected = false;
			e.preventDefault();
			return;
		}
		let msg = '';
		if(e.error) {
			msg = e.error.toString();
			if(e.error.stack) {
				msg = e.error.stack;
			}
		} else {
			msg = e.message;
		}
		log('compile-failure', 'Compilation error', msg);
	});

	function beginModule(module) {
		log('module-begin', module + '_test');
		count = 0;
		skipped = 0;
		failed = 0;
	}

	function completeModule(module) {
		totalCount += count;
		totalSkipped += skipped;
		totalFailed += failed;

		if(count) {
			let label = module + '_test done (' + count + ')';
			if(failed) {
				log('module-fail', label + '; skipped ' + skipped + '; failed ' + failed);
			} else if(skipped) {
				log('module-skip', label + '; skipped ' + skipped);
			} else {
				log('module-done', label);
			}
		} else {
			if(skipped) {
				log('module-skip', module + '_test skipped ' + skipped);
			} else {
				log('failure', module + ' has no tests!');
			}
		}
	}

	function runModule(module) {
		return (
			require([module + '_test'])
			.then(() => beginModule(module))
			.then(invokeQueueSynchronously)
			.then(() => completeModule(module))
		);
	}

	return {
		invoke: (modules) => {
			const originalTitle = document.title;
			document.title = originalTitle + ' \u2014 Running\u2026';

			queue = modules.map((module) => ({
				description: module + '_test',
				fn: runModule.bind(null, module),
				skip: false,
				test: false,
			}));

			return invokeQueueSynchronously().then(() => {
				let label = 'All done (' + totalCount + ')';
				if(totalFailed) {
					label += '; skipped ' + totalSkipped + '; failed ' + totalFailed;
					log('fail', label);
					document.title = originalTitle + ' \u2014 Failed ' + totalFailed;
				} else if(totalSkipped) {
					label += '; skipped ' + totalSkipped;
					log('skip', label);
					document.title = originalTitle + ' \u2014 Skipped ' + totalSkipped;
				} else {
					label += '.';
					log('done', label);
					document.title = originalTitle + ' \u2014 Pass (' + totalCount + ')';
				}
				testTitleText.nodeValue = 'Unit Tests: ' + label;
			});
		},
	};
});
