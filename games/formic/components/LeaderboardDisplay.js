define(['core/EventObject', 'display/document_utils'], (EventObject, docutil) => {
	'use strict';

	const WORKER_COUNT = 4;
	const SCORING = [
		15,
		14,
		13,
		12,
		11,
		10,
		9,
		8,
		7,
		6,
		5,
		4,
		3,
		2,
		1,
	];

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
			for(let i = 0; i < this.entries.length; ++ i) {
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
				const tr = docutil.make('tr', {'class': 'team-' + (i + 1)}, [
					docutil.make('td', {
						'class': 'player',
						'title': this.entries[i].title,
					}, [this.entries[i].title]),
					docutil.make('td', {}, [food]),
					...workerCells,
					docutil.make('td', {}, [thinkingTime]),
					tdScore,
				]);
//				tr.addEventListener('mouseover', () => {
//					this.hoveringTeam = i;
//					this.latestHoverTeam = i;
//				});
//				tr.addEventListener('mouseout', () => {
//					if(this.hoveringTeam === i) {
//						this.hoveringTeam = null;
//					}
//				});
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

		updateState({entries}) {
			for(let i = 0; i < entries.length; ++ i) {
				const entry = entries[i];
				const display = this.tableEntries[entry.id];
				docutil.update_text(display.food, entry.food);
				for(let j = 0; j < WORKER_COUNT; ++ j) {
					docutil.update_text(display.workers[j], entry.workers[j]);
				}
				docutil.update_attrs(display.tr, {
					'class': (
						'team-' + (entry.id + 1) +
						(entry.active ? '' : ' disqualified')
//						((this.hoveringTeam === entry.id) ? ' cur-hover' :
//						(this.latestHoverTeam === entry.id) ? ' last-hover' : '')
					)
				});
				let avg = '';
				if(entry.antSteps > 0) {
					avg = (entry.elapsedTime / entry.antSteps).toFixed(3) + 'ms';
				}
				docutil.update_text(display.thinkingTime, avg);
			}

			const scoreBoard = [];
			for(let i = 0; i < entries.length; ++ i) {
				const entry = entries[i];
				let totalWorkers = 0;
				for(let j = 0; j < WORKER_COUNT; ++ j) {
					totalWorkers += entry.workers[j];
				}
				scoreBoard.push({
					index: i,
					food: entry.food,
					workers: totalWorkers,
					active: entry.active,
				});
			}
			scoreBoard.sort((a, b) => {
				if(a.active !== b.active) {
					return a.active ? -1 : 1;
				}
				if(a.food !== b.food) {
					return b.food - a.food;
				}
				return b.workers - a.workers;
			});
			const changed = (
				this.lastRowOrder === null ||
				this.lastRowOrder.length !== scoreBoard.length ||
				scoreBoard.some((v, i) => (this.lastRowOrder[i].index !== v.index))
			);
			if(changed) {
				while(this.tbody.lastChild) {
					this.tbody.removeChild(this.tbody.lastChild);
				}
				for(let i = 0; i < scoreBoard.length; ++ i) {
					const place = scoreBoard[i];
					this.tbody.appendChild(this.tableEntries[place.index].tr);
				}
				this.lastRowOrder = scoreBoard;
			}
			let tiedPos = 0;
			let tiedFood = 0;
			for(let i = 0; i < scoreBoard.length; ++ i) {
				const place = scoreBoard[i];
				const record = this.tableEntries[place.index];
				if(place.food !== tiedFood) {
					tiedPos = i;
					tiedFood = place.food;
				}
				let score = 0;
				if(place.active && place.food > 0) {
					docutil.update_attrs(record.tdScore, {
						'class': 'result' + ((tiedPos === 0) ? ' win' : '')
					});
					docutil.update_text(record.score, SCORING[tiedPos]);
				} else {
					docutil.update_attrs(record.tdScore, {
						'class': 'result'
					});
					docutil.update_text(record.score, '');
				}
			}
		}

		dom() {
			return this.table;
		}
	}
});
