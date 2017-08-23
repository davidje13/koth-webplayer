define(['core/EventObject', './document_utils', './style.css'], (EventObject, docutil) => {
	'use strict';

	return class Overlay extends EventObject {
		constructor() {
			super();

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
			this.element = null;
			this.visible = false;
		}

		show(element, {dismissable = true, inline = false} = {}) {
			this.element = element;
			if(inline) {
				docutil.setParent(this.element, null);
				docutil.body.insertBefore(this.element, this.container);
				this.visible = true;
				return;
			}
			docutil.empty(this.hold);
			docutil.setParent(this.element, this.hold);
			docutil.updateStyle(this.dismiss, {'display': dismissable ? 'block' : 'none'});
			docutil.updateStyle(this.container, {'display': 'block'});
			this.visible = true;
		}

		hide() {
			docutil.setParent(this.element, null);
			docutil.updateStyle(this.container, {'display': 'none'});
			this.visible = false;
			this.trigger('dismissed');
		}

		dom() {
			return this.container;
		}
	}
});
