'use strict';

require(['document', 'tester/test.css'], (document) => {
	const testedModules = [];

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

	let running = false;
	const describeQueue = [];

	function invokeDescribe({object, fn}) {
		path.push(object);
		try {
			fn();
		} catch(e) {
			logFailure(e);
		} finally {
			path.pop();
		}
	}

	self.describe = (object, fn) => {
		if(running) {
			invokeDescribe({object, fn});
		} else {
			describeQueue.push({object, fn});
		}
	};

	self.it = (behaviour, fn) => {
		if(!running) {
			throw 'it() must be inside describe()!';
		}
		path.push(behaviour);
		try {
			fn();
		} catch(e) {
			logTestFailure(e);
		} finally {
			path.pop();
		}
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

	Promise.all(testedModules.map((module) => require([module + '_test']).then(() => {
		path.push(module + '_test');
		log('module-begin', module + '_test');
		if(describeQueue.length === 0) {
			logFailure('No tests!');
		} else {
			running = true;
			describeQueue.forEach((desc) => invokeDescribe(desc));
			describeQueue.length = 0;
			running = false;
		}
		log('module-done', module + '_test done');
		path.pop();
	}).catch((e) => {
		path.push(module + '_test');
		logFailure(e);
		path.pop();
	}))).then(() => {
		log('done', 'All done.');
	});
});
