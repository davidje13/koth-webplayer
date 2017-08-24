define(['core/EventObject', './document_utils'], (EventObject, docutil) => {
	'use strict';

	function makeSelect(eventObj, eventType, options, key) {
		const lookup = new Map();
		const rlookup = new Map();
		const select = docutil.make('select');
		select.addEventListener('change', () => {
			eventObj.trigger(eventType, [{[key]: lookup.get(select.value)}]);
		});

		const replace = (opts) => {
			lookup.clear();
			rlookup.clear();
			docutil.empty(select);
			let uniqueValue = 0;
			for(let i = 0; i < opts.length; ++ i) {
				const option = opts[i];
				const v = String(uniqueValue ++);
				lookup.set(v, option.value);
				rlookup.set(option.value, v);
				select.appendChild(docutil.make('option', {'value': v}, option.label));
			}
		};
		replace(options);

		return {
			select,
			replace,
			setFrom: (o) => {
				select.value = rlookup.get(o[key]);
			},
		};
	}

	return class OptionsBar extends EventObject {
		constructor(eventType, opts) {
			super();

			this.bar = docutil.make('div', {'class': 'options'});

			this.optPickers = opts.map((opt) => {
				const picker = makeSelect(this, eventType, opt.values, opt.attribute);
				if(opt.label) {
					this.bar.appendChild(docutil.make('label', {}, [opt.label, ' ', picker.select]));
				} else {
					this.bar.appendChild(picker.select);
				}
				return picker;
			});
		}

		updateAttributes(attrs) {
			this.optPickers.forEach((optPicker) => optPicker.setFrom(attrs));
		}

		dom() {
			return this.bar;
		}
	}
});
