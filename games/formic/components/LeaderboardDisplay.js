define(['core/EventObject', 'display/document_utils', '../GameScorer'], (EventObject, docutil, GameScorer) => {
	'use strict';

	const WORKER_COUNT = 4;

	return class LeaderboardDisplay extends EventObject {
		constructor() {
			super();

			this.entries = null;
			this.lastRowOrder = null;

			this.tbody = docutil.make('tbody');
			this.tableEntries = [];
			this.seedLabel = docutil.text();

			const workerLabels = [];
			for(let i = 0; i < WORKER_COUNT; ++ i) {
				workerLabels.push(docutil.make('th', {}, ['Type ' + (i + 1)]));
			}

			this.table = docutil.make('table', {
				'class': 'match expanded',
			}, [
				docutil.make('thead', {}, [
					docutil.make('tr', {}, [
						docutil.make('th', {
							'class': 'player',
							'rowspan': 2
						}, [
							docutil.make('header', {}, [
								docutil.make('h3', {}, ['Game']),
								docutil.make('p', {}, [this.seedLabel]),
							]),
						]),
						docutil.make('th', {'rowspan': 2}, ['Food']),
						docutil.make('th', {'colspan': 4}, ['Workers']),
						docutil.make('th', {'rowspan': 2}, ['Thinking Time']),
						docutil.make('th', {'class': 'result', 'rowspan': 2}, ['Score']),
					]),
					docutil.make('tr', {}, workerLabels),
				]),
				this.tbody,
			]);
		}

		updateEntries(entries) {
			if(this.entries === entries) {
				return;
			}

			this.entries = entries;
			for(let i = 0; i < this.tableEntries.length; ++ i) {
				this.tbody.removeChild(this.tableEntries[i].tr);
			}
			this.tableEntries.length = 0;
			for(let id in this.entries) {
				if(!entries.hasOwnProperty(id)) {
					continue;
				}
				const entry = this.entries[id];
				const food = docutil.text();
				const workers = [];
				const workerCells = [];
				for(let i = 0; i < WORKER_COUNT; ++ i) {
					const label = docutil.text();
					workers.push(label);
					workerCells.push(docutil.make('td', {}, [label]));
				}
				const thinkingTime = docutil.text();
				const score = docutil.text();
				const tdScore = docutil.make('td', {'class': 'result'}, [score]);
				const tr = docutil.make('tr', {'class': 'team-' + id}, [
					docutil.make('td', {
						'class': 'player',
						'title': entry.title,
					}, [entry.title]),
					docutil.make('td', {}, [food]),
					...workerCells,
					docutil.make('td', {}, [thinkingTime]),
					tdScore,
				]);
				this.tableEntries.push({
					tr,
					food,
					workers,
					thinkingTime,
					score,
					tdScore,
				});
				this.tbody.appendChild(tr);
			}
		}

		clear() {
		}

		updateGameConfig({seed, entries}) {
			docutil.update_text(this.seedLabel, seed);
			this.updateEntries(entries);
		}

		updateDisplayConfig() {
		}

		updateState(state) {
			for(let i = 0; i < state.entries.length; ++ i) {
				const entry = state.entries[i];
				const display = this.tableEntries[entry.id];
				docutil.update_text(display.food, entry.food);
				for(let j = 0; j < WORKER_COUNT; ++ j) {
					docutil.update_text(display.workers[j], entry.workers[j]);
				}
				docutil.update_attrs(display.tr, {
					'class': (
						'team-' + entry.id +
						(entry.active ? '' : ' disqualified')
					)
				});
				let avg = '';
				if(entry.antSteps > 0) {
					avg = (entry.elapsedTime / entry.antSteps).toFixed(3) + 'ms';
				}
				docutil.update_text(display.thinkingTime, avg);
			}

			const scoreBoard = GameScorer.score(null, state);
			const changed = (
				this.lastRowOrder === null ||
				this.lastRowOrder.length !== scoreBoard.length ||
				scoreBoard.some((v, i) => (
					this.lastRowOrder[i].id !== v.id ||
					this.lastRowOrder[i].score !== v.score
				))
			);

			if(changed) {
				while(this.tbody.lastChild) {
					this.tbody.removeChild(this.tbody.lastChild);
				}
				for(let i = 0; i < scoreBoard.length; ++ i) {
					const place = scoreBoard[i];
					const display = this.tableEntries[place.id];
					docutil.update_attrs(display.tdScore, {
						'class': 'result' + ((place.winner) ? ' win' : '')
					});
					docutil.update_text(display.score, place.score || '');
					this.tbody.appendChild(display.tr);
				}
				this.lastRowOrder = scoreBoard;
			}
		}

		dom() {
			return this.table;
		}
	}
});
