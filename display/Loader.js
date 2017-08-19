define(['core/document_utils', './style.css'], (docutil) => {
	'use strict';

	return class Loader {
		constructor(className = '', message = '', progress = 0) {
			this.lastMessage = '';
			this.label = docutil.text();
			this.bar = docutil.make('div', {'class': 'bar-filled'});
			this.container = docutil.make('div', {'class': 'loader ' + className}, [
				docutil.make('div', {'class': 'message'}, [this.label]),
				docutil.make('div', {'class': 'bar'}, [this.bar]),
			]);
			this.setState(message, progress);
		}

		setState(message, progress) {
			if(typeof message === 'number' && progress === undefined) {
				progress = message;
				message = this.lastMessage;
			}
			if(this.lastMessage !== message) {
				this.lastMessage = message;
				docutil.update_text(this.label, message);
			}
			docutil.update_style(this.bar, {'width': (progress * 100) + '%'});
		}

		dom() {
			return this.container;
		}
	}
});
