define(['fetch/entryUtils'], (entryUtils) => {
	'use strict';

	function loadEntries(site, qid) {
		entryUtils.load(site, qid, (loaded, total) => {
			self.postMessage({
				action: 'LOADING',
				loaded,
				total,
			});
		}).then((entries) => {
			self.postMessage({
				action: 'LOADED',
				entries,
			});
		}).catch((error) => {
			self.postMessage({
				action: 'LOAD_FAILED',
				error: error.message,
			});
		});
	}

	self.addEventListener('message', (event) => {
		const data = event.data;
		switch(data.action) {
		case 'LOAD_ENTRIES':
			self.postMessage({
				action: 'BEGIN_LOAD',
			});
			loadEntries(data.site, data.qid);
			break;
		}
	});
});
