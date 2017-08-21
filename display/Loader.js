define(['display/document_utils', './style.css'], (docutil) => {
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

		setState(message, progress = null) {
			if(typeof message === 'number' && progress === null) {
				progress = message;
				message = this.lastMessage;
			}
			if(this.lastMessage !== message) {
				this.lastMessage = message;
				docutil.updateText(this.label, message);
			}
			docutil.updateStyle(this.bar, {'width': (progress * 100) + '%'});
		}

		dom() {
			return this.container;
		}
	}
});
