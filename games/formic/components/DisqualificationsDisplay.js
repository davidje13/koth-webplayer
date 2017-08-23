define(['core/EventObject', 'display/document_utils'], (EventObject, docutil) => {
	'use strict';

	return class DisqualificationsDisplay extends EventObject {
		constructor() {
			super();

			this.entryLookup = new Map();
			this.lastRows = null;

			this.tbody = docutil.make('tbody');
			this.table = docutil.make('table', {'class': 'fouls'}, [
				docutil.make('thead', {}, [
					docutil.make('tr', {}, [
						docutil.make('th', {}, ['Player']),
						docutil.make('th', {}, ['Disqualification Reason']),
					]),
				]),
				this.tbody,
			]);
		}

		clear() {
		}

		updateGameConfig({entries}) {
			this.entryLookup.clear();
			entries.forEach((entry) => this.entryLookup.set(entry.id, entry));
		}

		updateDisplayConfig() {
		}

		updateState({entries}) {
			const rows = [];
			entries.forEach((entry) => {
				if(!entry.active) {
					rows.push({
						id: entry.id,
						error: entry.error,
						input: entry.errorInput,
						output: entry.errorOutput,
					});
				}
			});

			const changed = (
				this.lastRows === null ||
				this.lastRows.length !== rows.length ||
				rows.some((v, i) => (
					this.lastRows[i].id !== v.id ||
					this.lastRows[i].error !== v.error ||
					this.lastRows[i].input !== v.input ||
					this.lastRows[i].output !== v.output
				))
			);
			if(changed) {
				docutil.empty(this.tbody);
				for(let i = 0; i < rows.length; ++ i) {
					const row = rows[i];
					this.tbody.appendChild(docutil.make('tr', {}, [
						docutil.make('td', {}, [this.entryLookup.get(row.id).title]),
						docutil.make('td', {'class': 'foul-reason'}, [
							row.error +
							(row.input
								? ' (gave ' + row.output + ' for ' + row.input + ')'
								: ''
							)
						]),
					]));
				}
				this.lastRows = rows;
			}
		}

		dom() {
			return this.table;
		}
	}
});
