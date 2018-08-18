//
// This is the designated entrypoint for nodejs. Currently,
// it is only aimed at batch processing of tournaments, but
// contributions to extend this to hosting are welcome.
//
// Exit statuses:
// 0: Tournament loaded and ran successfully to completion, or was stopped gracefully
// 1: Tournament loaded, but did not run successfully due to submission problems
// 2: Tournament loaded, but did not run successfully due to tournament problems
// 3: Tournament could not be loaded
// 4: An invalid combination or parameters was passed
//

/* globals __dirname, require, global */
'use strict';

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

requirejs('node/driver');
