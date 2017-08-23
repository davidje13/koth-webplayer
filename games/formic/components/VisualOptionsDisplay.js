define(['core/EventObject', 'display/document_utils'], (EventObject, docutil) => {
	'use strict';

	function makeSelect(eventObj, options, key) {
		const lookup = new Map();
		const rlookup = new Map();
		const select = docutil.make('select');
		select.addEventListener('change', () => {
			eventObj.trigger('changedisplay', [{[key]: lookup.get(select.value)}]);
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

	return class VisualOptionsDisplay extends EventObject {
		constructor() {
			super();

			this.colourChoices = {};

			this.colourPicker = makeSelect(this, [], 'colourscheme');

			this.dimPicker = makeSelect(this, [
				{value: false, label: '2D'},
				{value: true, label: '3D'},
			], 'view3D');

			this.queenPicker = makeSelect(this, [
				{value: '', label: 'None'},
				{value: 'ring', label: 'Ring'},
				{value: 'pointer', label: 'Pointer'},
			], 'queenMarkerType');

			this.workerPicker = makeSelect(this, [
				{value: '', label: 'None'},
				{value: 'pointer', label: 'Pointer'},
			], 'workerMarkerType');

			this.foodPicker = makeSelect(this, [
				{value: '', label: 'None'},
				{value: 'pointer', label: 'Pointer'},
			], 'foodMarkerType');

			this.bar = docutil.make('div', {'class': 'options'}, [
				this.colourPicker.select,
				this.dimPicker.select,
				docutil.make('label', {}, [
					'Queen marker ',
					this.queenPicker.select,
				]),
				docutil.make('label', {}, [
					'Worker marker ',
					this.workerPicker.select,
				]),
				docutil.make('label', {}, [
					'Food marker ',
					this.foodPicker.select,
				]),
			]);
		}

		setColourChoices(colourChoices) {
			this.colourChoices = colourChoices;
			const opts = [];
			for(let i in this.colourChoices) {
				if(this.colourChoices.hasOwnProperty(i)) {
					opts.push({value: i, label: this.colourChoices[i].name});
				}
			}
			this.colourPicker.replace(opts);
		}

		clear() {
		}

		updateGameConfig(config) {
		}

		updateDisplayConfig(config) {
			this.colourPicker.setFrom(config);
			this.dimPicker.setFrom(config);
			this.queenPicker.setFrom(config);
			this.workerPicker.setFrom(config);
			this.foodPicker.setFrom(config);
		}

		updateState(state) {
		}

		dom() {
			return this.bar;
		}
	}
});
