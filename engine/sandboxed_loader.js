'use strict';

define(['fetch/entry_utils'], (entry_utils) => {
	function loadEntries(site, qid) {
		entry_utils.load(site, qid, (loaded, total) => {
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
