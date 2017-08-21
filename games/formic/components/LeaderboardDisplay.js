define([
	'core/EventObject',
	'display/document_utils',
	'display/ResultTable',
	'../GameScorer',
], (
	EventObject,
	docutil,
	ResultTable,
	GameScorer,
) => {
	'use strict';

	const WORKER_COUNT = 4;

	return class LeaderboardDisplay extends EventObject {
		constructor() {
			super();

			this.tableDataLookup = new Map();
			this.seedLabel = docutil.text();

			const workerColumns = [];
			for(let i = 0; i < WORKER_COUNT; ++ i) {
				workerColumns.push({
					title: 'Type ' + (i + 1),
					attribute: 'type' + i,
				});
			}

			this.table = new ResultTable({
				className: 'match',
				columns: [{
					title: docutil.make('header', {}, [
						docutil.make('h3', {}, ['Game']),
						docutil.make('p', {}, [this.seedLabel]),
					]),
					className: 'player',
					attribute: 'name',
				}, {
					title: 'Food',
					attribute: 'food',
				}, {
					title: 'Workers',
					nested: workerColumns
				}, {
					title: 'Thinking Time',
					attribute: 'time',
				}, {
					title: 'Score',
					attribute: 'score',
					className: 'result',
				}],
			});
		}

		updateEntries(entries) {
			this.tableDataLookup.clear();

			entries.forEach((entry) => {
				this.tableDataLookup.set(entry.id, {
					key: entry.id,
					baseClassName: 'team-' + entry.id,
					name: {
						value: entry.title,
						title: entry.title,
					},
					food: 0,
					time: '',
					score: {value: '', className: ''},
				});
			});
		}

		clear() {
		}

		updateGameConfig({seed, entries}) {
			docutil.updateText(this.seedLabel, seed);
			this.updateEntries(entries);
		}

		updateDisplayConfig() {
		}

		updateState(state) {
			state.entries.forEach((entry) => {
				const data = this.tableDataLookup.get(entry.id);
				data.food = entry.food;
				entry.workers.forEach((count, index) => {
					data['type' + index] = count;
				});
				data.className = (
					data.baseClassName +
					(entry.active ? '' : ' disqualified')
				);
				if(entry.antSteps > 0) {
					data.time = (entry.elapsedTime / entry.antSteps).toFixed(3) + 'ms';
				} else {
					data.time = '';
				}
			});

			this.table.setData(GameScorer.score(null, state).map((place) => {
				const data = this.tableDataLookup.get(place.id);
				data.score.className = (place.winner ? 'win' : '');
				data.score.value = place.score || '';
				return data;
			}));
		}

		dom() {
			return this.table.dom();
		}
	}
});
