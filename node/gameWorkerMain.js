
var requirejs = require('requirejs');

requirejs.config({
	nodeRequire: require,
	baseUrl: __dirname+'/../',
	paths: {
		'fetch/entryUtils': 'node/entryUtils',
	},
	map: {
		'*':{
			'./style.css': 'node/dummy' //This gets all the style.css out of the way
		}
	}
});

//Polyfills
global.performance = require('perf_hooks').performance;
global.fetch = require('node-fetch');

process.on('unhandledRejection', (reason) => {
	process.send({
		action: 'UNHANDLED',
		details: {
			message: reason.message,
			stack: reason.stack,
		}
	});
	process.exit(1);
});

process.on('uncaughtException', (err) => {
	process.send({
		action: 'UNHANDLED',
		details: {
			message: err.message,
			stack: err.stack,
		}
	});
	process.exit(1);
});

requirejs('node/gameWorker')(requirejs('./'+process.argv[2]));
