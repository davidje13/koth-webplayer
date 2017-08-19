'use strict';

require(['document', 'tester/test.css'], (document) => {
	const testedModules = [];
	const originalTitle = document.title;

	const elements = document.getElementsByTagName('meta');
	for(let i = 0; i < elements.length; ++ i) {
		const meta = elements[i];
		if(meta.getAttribute('name') === 'module') {
			testedModules.push(meta.getAttribute('content'));
		}
	}

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
			throw new Error((extraDesc ? extraDesc + ': ' : '') + result.message);
		}
	};

	self.fail = (reason) => {
		throw new Error(reason);
	};

	let running = false;
	let skipping = false;
	let count = 0;
	let skipped = 0;
	let failed = 0;
	let totalCount = 0;
	let totalSkipped = 0;
	let totalFailed = 0;
	const describeQueue = [];
	const path = [];

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

	function logFailure(e) {
		let msg = '';
		if(e) {
			msg = e.toString();
			if(e.stack) {
				msg = e.stack;
			}
		}
		log('failure', path.join(' \u203A '), msg);
	}

	function logTestFailure(e) {
		let msg = '';
		if(e) {
			msg = e.toString();
			if(e.stack) {
				msg = e.stack;
			}
		}
		log('test-failure', path.join(' \u203A '), msg);
	}

	function invokeDescribe({object, fn, skip}) {
		const wasSkipping = skipping;
		if(skip) {
			skipping = skip;
		}
		path.push(object);
		try {
			fn();
		} catch(e) {
			logFailure(e);
		}
		skipping = wasSkipping;
		path.pop();
	}

	self.describe = (object, fn) => {
		if(running) {
			invokeDescribe({object, fn, skip: false});
		} else {
			describeQueue.push({object, fn, skip: false});
		}
	};

	self.xdescribe = (object, fn) => {
		if(running) {
			invokeDescribe({object, fn, skip: true});
		} else {
			describeQueue.push({object, fn, skip: true});
		}
	};

	self.it = (behaviour, fn) => {
		if(!running) {
			throw 'it() must be inside describe()!';
		}
		if(skipping) {
			++ skipped;
			return;
		}
		path.push(behaviour);
		++ count;
		try {
			fn();
		} catch(e) {
			logTestFailure(e);
			++ failed;
		}
		path.pop();
	};

	self.xit = (behaviour, fn) => {
		if(!running) {
			throw 'it() must be inside describe()!';
		}
		++ skipped;
	};

	self.addEventListener('error', (e) => {
		let msg = '';
		if(e.error) {
			msg = e.error.toString();
			if(e.error.stack) {
				msg = e.stack;
			}
		} else {
			msg = e.message;
		}
		log('compile-failure', 'Compilation error', msg);
	});

	document.title = originalTitle + ' \u2014 Running\u2026';
	Promise.all(testedModules.map((module) => require([module + '_test']).then(() => {
		log('module-begin', module + '_test');

		path.push(module + '_test');
		count = 0;
		skipped = 0;
		failed = 0;
		running = true;
		describeQueue.forEach((desc) => invokeDescribe(desc));
		describeQueue.length = 0;
		running = false;
		path.pop();

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
	}).catch((e) => {
		path.push(module + '_test');
		logFailure(e);
		path.pop();
	}))).then(() => {
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
