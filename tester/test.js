'use strict';

require(['document', 'tester/test.css'], (document) => {
	const originalTitle = document.title;

	let globalErrorExpected = false;
	let activeFailPath = null;
	let queue = [];
	const scopes = [{description: '', skip: false, test: false}];
	let scopeDepth = 1;

	self.not = (submatch) => (actual) => {
		const result = submatch(actual);
		return {
			match: !result.match,
			message: submatch.negatedMessage,
			negatedMessage: submatch.message,
		};
	};

	self.equals = (expected) => (actual) => ({
		match: actual === expected,
		message: 'Expected ' + expected + ' but got ' + actual,
		negatedMessage: 'Expected not to get ' + expected,
	});

	self.isNear = (expected, tolerance) => (actual) => ({
		match: (
			actual >= expected - tolerance &&
			actual <= expected + tolerance
		),
		message: 'Expected ' + expected + ' +/- ' + tolerance + ' but got ' + actual,
		negatedMessage: 'Expected not to be within ' + tolerance + ' of ' + expected,
	});

	self.expect = (value, matcher, extraDesc) => {
		const result = matcher(value);
		if(!result.match) {
			self.fail(new Error((extraDesc ? extraDesc + ': ' : '') + result.message));
		}
	};

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

	let count = 0;
	let skipped = 0;
	let failed = 0;
	let totalCount = 0;
	let totalSkipped = 0;
	let totalFailed = 0;

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
		document.body.appendChild(element);
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
		let msg = '';
		if(e) {
			msg = e.toString();
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
		}
		return msg;
	}

	function logFailure(e) {
		log('failure', currentPath(), stringifyError(e));
	}

	function logTestFailure(e) {
		log('test-failure', currentPath(), stringifyError(e));
	}

	function invokeNextSynchronously(queue) {
		if(!queue.length) {
			return Promise.resolve();
		}
		return invoke(queue.shift()).then(() => invokeNextSynchronously(queue));
	}

	function invokeQueueSynchronously() {
		const currentQueue = queue;
		queue = [];
		return invokeNextSynchronously(currentQueue);
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
		queue.push({description, fn: () => {
			return new Promise((resolve, reject) => fn(resolve));
		}, skip: false, test: true});
	};

	self.xitAsynchronously = (description, fn) => {
		queue.push({description, fn: null, skip: true, test: true});
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

	document.title = originalTitle + ' \u2014 Running\u2026';

	const testedModules = [];
	const elements = document.getElementsByTagName('meta');
	for(let i = 0; i < elements.length; ++ i) {
		const meta = elements[i];
		if(meta.getAttribute('name') === 'module') {
			const module = meta.getAttribute('content');
			queue.push({
				description: module + '_test',
				fn: () => (
					require([module + '_test'])
					.then(() => beginModule(module))
					.then(invokeQueueSynchronously)
					.then(() => completeModule(module))
				),
				skip: false,
				test: false,
			});
		}
	}

	invokeQueueSynchronously().then(() => {
		const label = 'All done (' + totalCount + ')';
		if(totalFailed) {
			log('fail', label + '; skipped ' + totalSkipped + '; failed ' + totalFailed);
			document.title = originalTitle + ' \u2014 Failed ' + totalFailed;
		} else if(totalSkipped) {
			log('skip', label + '; skipped ' + totalSkipped);
			document.title = originalTitle + ' \u2014 Skipped ' + totalSkipped;
		} else {
			log('done', label + '.');
			document.title = originalTitle + ' \u2014 Pass (' + totalCount + ')';
		}
	});
});
