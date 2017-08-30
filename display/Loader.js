define(['./document_utils', './style.css'], (docutil) => {
	'use strict';

	return class Loader {
		constructor(className = '', message = '', progress = 0) {
			this.lastMessage = '';
			this.bar = docutil.make('div', {'class': 'bar-filled'});
			docutil.updateStyle(this.bar, {'width': '0%'});
			this.back = docutil.make('div', {'class': 'bar-back'}, [this.bar]);
			if(message === null) {
				this.label = null;
				this.container = this.back;
			} else {
				this.label = docutil.text();
				this.container = docutil.make('div', {'class': 'loader ' + className}, [
					docutil.make('div', {'class': 'message'}, [this.label]),
					this.back,
				]);
			}
			this.setState(message, progress);
		}

		setState(message, progress = null) {
			if(typeof message === 'number' && progress === null) {
				progress = message;
				message = this.lastMessage;
			}

			if(this.label && this.lastMessage !== message) {
				this.lastMessage = message;
				docutil.updateText(this.label, message);
			}

			docutil.updateAttrs(this.back, {
				'class': 'bar-back' + (progress >= 1 ? ' bar-done' : ''),
			});
			docutil.updateStyle(this.bar, {'width': (progress * 100) + '%'});
		}

		dom() {
			return this.container;
		}
	}
});
