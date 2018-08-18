define([
	'crypto',
	'cheerio',
	'fs',
	'path',
], (
	crypto,
	cheerio,
	fs,
	path
) => {
	'use strict';

	const CHARS_PER_INT = 5;
	const BASE = (
		'0123456789' +
		'abcdefghij' +
		'klmnopqrst' +
		'uvwxyzABCD' +
		'EFGHIJKLMN' +
		'OPQRSTUVWX' +
		'YZ\u03B1\u03B2\u03B3\u03B4\u03B5\u03B6\u03B7\u03B8' +
		'\u03B9\u03BA\u03BB\u03BC\u03BD\u03BE\u03BF\u03C0\u03C1\u03C3' +
		'\u03C4\u03C5\u03C6\u03C7\u03C8'
	);

	function wrappedPath(src) {
		return path.resolve() + '/' + src + '.js';
	}

	function stringifySingle(o, multiline) {
		// Reformat module requirements to better fit the originals for the
		// linter (keeps line numbers correct and prevents initial line being
		// too long)
		let r = JSON.stringify(o).replace(/'/g, '\\\'').replace(/"/g, '\'');
		if(multiline && r[0] === '[') {
			r = (r
				.replace(/^\[/, '[\n')
				.replace(/','/g, '\',\n\'')
				.replace(/\]$/, ',\n]')
			);
		}
		return r;
	}

	function makeEncoded(v, l) {
		let r = '';
		let x = v;
		for(let i = 0; i < l; ++ i) {
			r = BASE[x % BASE.length] + r;
			x = Math.floor(x / BASE.length);
		}
		return r;
	}

	function hashBlock(src) {
		let blake2summer = crypto.createHash('blake2s256');
		blake2summer.update(JSON.stringify(src));
		let buffer = new Uint32Array(blake2summer.digest().buffer);
		let s = '';
		for(let i = 0; i < 8; ++ i) {
			s += makeEncoded(buffer[i], CHARS_PER_INT);
		}
		return s;
	}

	function parseAnswer(item) {
		//snake_case names are from api
		/* jshint camelcase:false */
		let title = 'Unknown competitor from ' + item.owner.display_name;
		try {
			const $ = cheerio.load('<div>' + item.body + '</div>');
			title = $('h1').slice(0, 1).text() || title; //Extract title, but just the first
			const codeBlocks = $('pre > code').map(function(i, element) {
				return $(element).text();
			}).get(); //Extract codeblocks
			if(!codeBlocks.length) {
				throw new Error('Code not found!');
			}
			return {
				answerID: item.answer_id,
				userName: item.owner.display_name,
				userID: item.owner.user_id,
				link: item.link,
				title,
				codeBlocks,
				blockHash: hashBlock(codeBlocks),
				enabled: true,
			};
		} catch(error) {
			return {
				answerID: item.answer_id,
				userName: item.owner.display_name,
				userID: item.owner.user_id,
				link: item.link,
				title,
				codeBlocks: [],
				blockHash: '',
				error: error.toString(),
				enabled: false,
			};
		}
	}

	function parseEntryCode(format, codeBlocks) {
		return format.replace(/\{\{(codeblock:.*?)\}\}/g, (match, p) => {
			const params = {
				codeblock: 0,
				prefix: '',
			};
			p.split(/, +/).forEach((param) => {
				const kv = param.split(':', 2);
				params[kv[0]] = kv[1];
			});
			const code = (codeBlocks[Number(params.codeblock)] || '');
			return (code
				.replace(/\n$/, '')
				.replace(/(^|\n)([^\n])/g, '$1' + params.prefix + '$2')
			);
		});
	}

	function unescapeHTML(code) {
		//Cheerio is an html parser/manipulator for node, so I assume that this is airtight
		//If it isn't, well...
		let $ = cheerio.load('<div></div>');
		return $('<div/>').html(code).text();
	}

	function parseEntry(entry, index) {
		return {
			id: 'E' + index,
			answerID: entry.answerID,
			userName: entry.userName,
			userID: entry.userID,
			title: unescapeHTML(entry.title),
			codeBlocks: entry.codeBlocks.map(unescapeHTML),
			enabled: entry.enabled,
			pauseOnError: false,
		};
	}

	function makeRandomSeed() {
		let buffer = new Uint8Array(16);
		crypto.randomFillSync(buffer);
		let newBuffer = new Uint32Array(buffer.buffer);
		let s = '';
		for(let i = 0; i < 4; ++ i) {
			s += makeEncoded(newBuffer[i], CHARS_PER_INT);
		}
		return s;
	}

	function mkdirExistSync(dir) {
		try {
			fs.mkdirSync(dir);
		} catch(err) {
			if (err.code !== 'EEXIST') {
				throw err;
			}
		}
	}

	function mkdirExistPromise(dir) {
		return new Promise((resolve, reject) => {
			fs.mkdir(dir, (err) => {
				if (!err || err.code === 'EEXIST') {
					resolve();
				} else {
					reject(err);
				}
			});
		});
	}

	return {
		wrappedPath,
		stringifySingle,
		parseAnswer,
		parseEntryCode,
		parseEntry,
		unescapeHTML,
		makeRandomSeed,
		mkdirExistSync,
		mkdirExistPromise,
		hashBlock,
	};
});
