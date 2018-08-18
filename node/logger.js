/* jshint maxparams: 9 */ //Yes, all these are used
define([
	'node/nodeUtils',
	'fs',
	'winston',
	'os',
	'path',
	'zlib',
], (
	nodeUtils,
	fs,
	winston,
	os,
	path,
	zlib
) => {
	'use strict';
	/* globals process */
	class LoggingWriter {
		constructor(tag, handle=null) {
			this.logHandle = handle;
			this.tag = tag;
		}

		log(message, severity='info') {
			this.logHandle.log(severity, {tag: this.tag, message});
		}

		openHandle(nextHandle) {
			return new LoggingWriter(this.tag + '/' + nextHandle, this.logHandle);
		}
	}

	//If you're running more than one batch tournament a millisecond, you're
	//doing something wrong
	//This runner has capabilities for running any number of tournaments in a batch,
	//so turn that up if you somehow can complete a normal batch in less than
	//a millisecond
	this.topLevel = undefined;

	//The linter insists that this.topLevel can't be defined.
	//Experience with this code says otherwise.
	/* jshint validthis: true */
	function topLevelInstantiate(level) {
		if (this.topLevel === undefined) {
			nodeUtils.mkdirExistSync(path.join(os.homedir(), 'koth-webplayer'));
			let date = new Date();
			this.topLevel = new LoggingWriter('', winston.createLogger({
				transports: [
					new winston.transports.File({
						filename: path.join(
							os.homedir(),
							'koth-webplayer',
							date.toISOString()
						),
						eol: '\n',
						level: level,
					}),
				],
			}));
			process.on('exit', () => {
				this.topLevel.logHandle.end();
				this.topLevel.logHandle.close();
				//This is the end, so perform this synchronously
				let oldFile = fs.readFileSync(path.join(
					os.homedir(),
					'koth-webplayer',
					date.toISOString()
				));
				fs.writeFileSync(
					path.join(os.homedir(), 'koth-webplayer', date.toISOString()+'.gz'),
					zlib.gzipSync(oldFile)
				);
				fs.unlinkSync(path.join(os.homedir(), 'koth-webplayer', date.toISOString()));
			});
		}
	}

	return {
		topLevel: this.topLevel,
		topLevelInstantiate,
	};

})
