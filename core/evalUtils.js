define(() => {
	'use strict';

	/* jshint worker: true */

	function invoke(src) {
		try {
			importScripts(URL.createObjectURL(new Blob(
				[src],
				{type: 'text/javascript'}
			)));
		} catch(e) {
			// WORKAROUND (Safari): blobs inaccessible when run
			// from the filesystem, so fall-back to a nasty eval
			if(e.toString().includes('DOM Exception 19')) {
				try {
					/* jshint evil: true */
					eval(src);
				} catch(e2) {
					throw e2;
				}
			} else {
				throw e;
			}
		}
	}

	return {
		invoke,
	};
});
