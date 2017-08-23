define(['display/document_utils', './style.css'], (docutil) => {
	'use strict';

	return class Overlay {
		constructor() {
			this.shade = docutil.make('div', {'class': 'overlay-shade'});
			this.hold = docutil.make('div', {'class': 'overlay-hold'});
			this.dismiss = docutil.make('div', {'class': 'overlay-dismiss', 'title': 'Close'});
			this.dismiss.addEventListener('click', this.hide.bind(this));
			this.container = docutil.make('div', {'class': 'overlay-container'}, [
				this.shade,
				this.hold,
				this.dismiss,
			]);
			docutil.updateStyle(this.container, {'display': 'none'});
		}

		show(element, dismissable = true) {
			docutil.empty(this.hold);
			docutil.setParent(element, this.hold);
			docutil.updateStyle(this.dismiss, {'display': dismissable ? 'block' : 'none'});
			docutil.updateStyle(this.container, {'display': 'block'});
		}

		hide() {
			docutil.updateStyle(this.container, {'display': 'none'});
		}

		dom() {
			return this.container;
		}
	}
});
