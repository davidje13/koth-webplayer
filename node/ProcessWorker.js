define([
	'core/EventObject',
	'child_process',
	'node/logger',
	'assert',
], (
	EventObject,
	childProcess,
	logger,
	assert
) => {
	'use strict';

	let workerPool = [];
	let activeWorkers = 0;

	function make(dependencies) {
		//There's really only one way to do this, create a cluster worker,
		//then wrap it with an eventObject
		const listener = new EventObject();

		function messageHandler(message) {
			listener.trigger('message', [message]);
		}

		let w;
		function spawnWorker() {
			if (workerPool.length > 0) {
				w = workerPool.pop();
				w.on('message', messageHandler);
			} else {

				w = childProcess.fork('./node/gameWorkerMain', [dependencies.game], {
					exevArgv: ['--max-old-space-size=1024'],
				});
				w.setMaxListeners(1);
				let logHandle = logger.topLevel.openHandle('P'+w.pid);

				const errReport = function(err) {
					logHandle.log(err, 'error');
					throw new Error(err);
				};

				const exitReport = function(code, signal) {
					//Nonzero exit codes mean the worker died by a means other
					//than running out of work to do. This is generally
					//a bad thing.
					if (code !== 0) {
						logHandle.log({code: code, signal: signal}, 'error');
						listener.trigger('message', [{
							action: 'DISCONNECT',
						}]);
						throw new Error(w.pid + ' exited with code ' + code);
					}
					//Regenerate the worker
					w.off('error', errReport);
					w.off('exit', exitReport);
					w.off('message', messageHandler);
					w = undefined;
					activeWorkers--;
				};
				w.on('error', errReport);
				w.on('exit', exitReport);
				w.on('message', messageHandler);
			}
			activeWorkers++;
		}

		spawnWorker();

		listener.terminate = () => {
			if (w !== undefined) {
				w.send({action: 'END'});
				w.off('message', messageHandler);
				workerPool.unshift(w);
				w = undefined;
				activeWorkers--;
			}
		};

		listener.postMessage = (event)=>{
			assert.notDeepStrictEqual(w, undefined);
			w.send(event);
		};

		return listener;
	}

	function getActiveWorkerCount() {
		return activeWorkers;
	}

	function getInactiveWorkerCount() {
		return workerPool.length;
	}

	return {
		make,
		getActiveWorkerCount,
		getInactiveWorkerCount,
	};
});
