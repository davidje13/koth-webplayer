define(['./StackExchangeAPI'], (StackExchangeAPI) => {
	'use strict';

	const seAPI = new StackExchangeAPI();

	const REG_TITLE = /<(h[1-6])\b(?:[^'">]|'[^']*'|"[^"]*")*>(.*?)<\/\1>/;
	const REG_CODE = /<pre\b(?:[^'">]|'[^']*'|"[^"]*")*><code\b(?:[^'">]|'[^']*'|"[^"]*")*>([^]*?)<\/code><\/pre>/;

	function findRegex(content, r, index) {
		const match = r.exec(content);
		if(!match || !match[index]) {
			return null;
		}
		return match[index];
	}

	function parseAnswer(item, index, loaded, total) {
		let title = 'Unknown competitor from ' + item.owner.display_name;
		try {
			title = findRegex(item.body, REG_TITLE, 2) || title;
			const code = findRegex(item.body, REG_CODE, 1);
			if(!code) {
				throw 'Code not found!';
			}
			const entry = {
				user_name: item.owner.display_name,
				user_id: item.owner.user_id,
				title,
				code,
			};

			self.postMessage({
				loaded: loaded + 1,
				total
			});

			return entry;
		} catch(error) {
			return {
				user_name: item.owner.display_name,
				user_id: item.owner.user_id,
				title,
				code: '',
				error,
			};
		}
	}

	function sendEntries(entries) {
		self.postMessage({
			loaded: entries.length,
			total: entries.length,
			entries
		});
	}

	function sendError(error) {
		self.postMessage({
			error: {
				message: error.toString(),
				stack: error.stack,
			},
		});
	}

	self.addEventListener('message', (event) => {
		seAPI
			.requestAnswers(event.data.site, event.data.qid, parseAnswer)
			.then(sendEntries)
			.catch(sendError)
	});
});
