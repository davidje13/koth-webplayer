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
						docutil.make('th', {}, ['Issue']),
					]),
				]),
				this.tbody,
			]);
		}

		clear() {
			docutil.empty(this.tbody);
			this.lastRows = [];
		}

		updateGameConfig({teams}) {
			this.entryLookup.clear();
			teams.forEach((team) => team.entries.forEach((entry) => this.entryLookup.set(entry.id, entry)));
		}

		updateState({teams}) {
			const rows = [];
			teams.forEach((team) => team.entries.forEach((entry) => {
				if(entry.disqualified) {
					rows.push({
						id: entry.id,
						error: entry.error,
						warn: false,
					});
				} else if(entry.error) {
					rows.push({
						id: entry.id,
						error: entry.error,
						warn: true,
					});
				}
			}));

			const changed = (
				this.lastRows === null ||
				this.lastRows.length !== rows.length ||
				rows.some((v, i) => (
					this.lastRows[i].id !== v.id ||
					this.lastRows[i].error !== v.error ||
					this.lastRows[i].warn !== v.warn
				))
			);
			if(changed) {
				docutil.empty(this.tbody);
				for(let i = 0; i < rows.length; ++ i) {
					const row = rows[i];
					this.tbody.appendChild(docutil.make('tr', {
						'class': (row.warn ? 'foul-warn' : 'foul-error'),
					}, [
						docutil.make('td', {}, [this.entryLookup.get(row.id).title]),
						docutil.make('td', {'class': 'foul-reason'}, [
							(row.warn ? 'WARNING: ' : 'DISQUALIFIED: ') +
							row.error
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