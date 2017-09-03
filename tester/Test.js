define([
	'require',
	'document',
	'./test.css',
], (
	require,
	document
) => {
	'use strict';

	function augment(target, source) {
		for(let key in source) {
			if(source.hasOwnProperty(key)) {
				target[key] = source[key];
			}
		}
	}

	function log(target, type, message, subMessage) {
		const element = document.createElement('div');
		element.setAttribute('class', type);
		element.appendChild(document.createTextNode(message));
		if(subMessage) {
			element.appendChild(document.createElement('br'));
			const sub = document.createElement('span');
			sub.appendChild(document.createTextNode(subMessage));
			element.appendChild(sub);
		}
		target.appendChild(element);
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

	return class Test {
		constructor(matchers) {
			this.matchers = matchers;

			this.globalErrorExpected = false;
			this.activeFailPath = null;
			this.scopes = [{description: '', skip: false, test: false}];
			this.scopeDepth = 1;
			this.count = 0;
			this.skipped = 0;
			this.failed = 0;
			this.totalCount = 0;
			this.totalSkipped = 0;
			this.totalFailed = 0;

			this.baseTestElement = document.createElement('div');
			this.baseTestElement.setAttribute('class', 'test-hold');
			const testTitle = document.createElement('h1');
			this.testTitleText = document.createTextNode('Unit Tests');
			testTitle.appendChild(this.testTitleText);
			this.baseTestElement.appendChild(testTitle);

			this.globals = {
				fail: this.fail.bind(this),

				describe: (description, fn) => {
					this.queue.push({description, fn, skip: false, test: false});
				},

				xdescribe: (description, fn) => {
					this.queue.push({description, fn, skip: true, test: false});
				},

				it: (description, fn) => {
					this.queue.push({description, fn, skip: false, test: true});
				},

				xit: (description, fn) => {
					this.queue.push({description, fn, skip: true, test: true});
				},

				itAsynchronously: (description, fn) => {
					this.queue.push({
						description,
						fn: () => new Promise((resolve) => fn(resolve)),
						skip: false,
						test: true,
					});
				},

				xitAsynchronously: (description, fn) => {
					this.queue.push({description, fn, skip: true, test: true});
				},
			};

			this.invokeQueueSynchronously = this.invokeQueueSynchronously.bind(this);
			this.leaveScope = this.leaveScope.bind(this);
			this.beginModule = this.beginModule.bind(this);
			this.completeModule = this.completeModule.bind(this);
		}

		fail(reason) {
			if(typeof reason !== 'object') {
				reason = new Error(reason);
			}
			if(this.activeFailPath) {
				this.activeFailPath(reason);
				this.globalErrorExpected = true;
				throw 'CAPTURED FAILURE'; // Escape current test
			} else {
				throw reason;
			}
		}

		currentPath() {
			let path = '';
			for(let i = 0; i < this.scopeDepth; ++ i) {
				if(path) {
					path += ' \u203A ';
				}
				path += this.scopes[i].description;
			}
			return path;
		}

		log(type, message, subMessage) {
			log(this.baseTestElement, type, message, subMessage);
		}

		logPath(type, subMessage) {
			this.log(type, this.currentPath(), subMessage);
		}

		logFailure(e) {
			this.logPath('failure', stringifyError(e));
		}

		logTestFailure(e) {
			this.logPath('test-failure', stringifyError(e));
		}

		currentScope() {
			return this.scopes[this.scopeDepth - 1];
		}

		enterScope(description) {
			const scope = {
				description,
				skip: this.currentScope().skip,
				test: false,
			};
			this.scopes[this.scopeDepth ++] = scope;
			return scope;
		}

		leaveScope() {
			-- this.scopeDepth;
		}

		invokeQueued({description, fn, skip, test}) {
			if(this.currentScope().test) {
				this.logTestFailure('attempt to nest inside it() block: ' + description);
				++ this.failed;
			}

			const scope = this.enterScope(description);
			if(skip) {
				scope.skip = true;
			}

			if(test) {
				scope.test = true;
				if(scope.skip) {
					++ this.skipped;
					this.leaveScope();
					return Promise.resolve();
				}
				++ this.count;
			}

			return (
				new Promise((resolve, reject) => {
					this.activeFailPath = reject;
					Promise.all([fn()]).then(resolve);
				})
				.then(this.invokeQueueSynchronously)
				.then(this.leaveScope)
				.catch((e) => {
					if(test) {
						this.logTestFailure(e);
						++ this.failed;
					} else {
						this.logFailure(e);
					}
					this.leaveScope();
				})
			);
		}

		invokeNextSynchronously(currentQueue) {
			if(!currentQueue.length) {
				return Promise.resolve();
			}
			return (
				this.invokeQueued(currentQueue.shift())
				.then(() => this.invokeNextSynchronously(currentQueue))
			);
		}

		invokeQueueSynchronously() {
			const currentQueue = this.queue;
			this.queue = [];
			return this.invokeNextSynchronously(currentQueue);
		}

		beginModule() {
			this.log('module-begin', this.currentModule + '_test');
			this.count = 0;
			this.skipped = 0;
			this.failed = 0;
		}

		completeModule() {
			this.totalCount += this.count;
			this.totalSkipped += this.skipped;
			this.totalFailed += this.failed;

			let label = this.currentModule + '_test';
			if(this.count) {
				label += ' done (' + this.count + ')';
				if(this.failed) {
					label += '; skipped ' + this.skipped;
					label += '; failed ' + this.failed;
					this.log('module-fail', label);
				} else if(this.skipped) {
					label += '; skipped ' + this.skipped;
					this.log('module-skip', label);
				} else {
					this.log('module-done', label);
				}
			} else {
				if(this.skipped) {
					label += ' skipped ' + this.skipped;
					this.log('module-skip', label);
				} else {
					this.log('failure', label + ' has no tests!');
				}
			}
		}

		runModule(module) {
			this.currentModule = module;
			return (
				require([module + '_test'])
				.then(this.beginModule)
				.then(this.invokeQueueSynchronously)
				.then(this.completeModule)
			);
		}

		dom() {
			return this.baseTestElement;
		}

		invoke(modules) {
			const originalTitle = document.title;
			document.title = originalTitle + ' \u2014 Running\u2026';

			this.globalErrorExpected = false;
			this.activeFailPath = null;
			this.scopeDepth = 1;

			this.count = 0;
			this.skipped = 0;
			this.failed = 0;
			this.totalCount = 0;
			this.totalSkipped = 0;
			this.totalFailed = 0;

			const matchers = this.matchers(this.globals.fail);
			augment(self, this.globals);
			augment(self, matchers);

			self.addEventListener('error', (e) => {
				if(this.globalErrorExpected) {
					this.globalErrorExpected = false;
					e.preventDefault();
					return;
				}
				this.log('compile-failure', 'Compilation error', stringifyError(e));
			});

			this.queue = modules.map((module) => ({
				description: module + '_test',
				fn: this.runModule.bind(this, module),
				skip: false,
				test: false,
			}));

			return this.invokeQueueSynchronously().then(() => {
				let label = 'All done (' + this.totalCount + ')';
				let title = originalTitle;
				if(this.totalFailed) {
					label += '; skipped ' + this.totalSkipped;
					label += '; failed ' + this.totalFailed;
					this.log('fail', label);
					title += ' \u2014 Failed ' + this.totalFailed;
				} else if(this.totalSkipped) {
					label += '; skipped ' + this.totalSkipped;
					this.log('skip', label);
					title += ' \u2014 Skipped ' + this.totalSkipped;
				} else {
					label += '.';
					this.log('done', label);
					title += ' \u2014 Pass (' + this.totalCount + ')';
				}
				this.testTitleText.nodeValue = 'Unit Tests: ' + label;
				document.title = title;
			});
		}
	};
});
