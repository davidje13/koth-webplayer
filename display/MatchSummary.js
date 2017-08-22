define([
	'core/EventObject',
	'./document_utils',
	'./ResultTable',
	'./style.css',
], (
	EventObject,
	docutil,
	ResultTable,
) => {
	'use strict';

	return class MatchSummary extends EventObject {
		constructor({name = 'Match', seed = '', entries, scorer}) {
			super();

			this.name = name;
			this.matchSeed = seed;
			this.entries = entries;
			this.scorer = scorer;
			this.allScores = [];
			this.gameSeeds = [];
			this.entryDataLookup = new Map();
			entries.forEach((entry) => {
				this.entryDataLookup.set(entry.id, {
					key: entry.id,
					baseClassName: 'team-' + entry.id,
					name: {
						value: entry.title,
						title: entry.title,
					},
					score: {value: '', className: ''},
				});
			});

			this.table = new ResultTable({className: 'match'});
			this.updateColumns(0);
		}

		updateColumns() {
			const gameCols = this.gameSeeds.map((gameSeed, index) => {
				const link = docutil.make('a', {'href': '#'}, ['Game ' + (index + 1)]);
				// TODO: is this a DOM/JS memory leak? Are dangling event handlers still an issue?
				link.addEventListener('click', (e) => {
					e.preventDefault();
					this.trigger('gametitleclick', [index]);
				});
				return {
					title: docutil.make('header', {}, [
						docutil.make('h4', {}, [link]),
//						docutil.make('p', {}, [gameSeed]),
					]),
					attribute: 'game' + index,
					autohide: true,
				};
			});

			this.table.setColumns([{
				title: docutil.make('header', {}, [
					docutil.make('h3', {}, [this.name]),
					docutil.make('p', {}, [this.matchSeed]),
				]),
				className: 'player',
				attribute: 'name',
			}, ...gameCols, {
				title: '',
				attribute: 'score',
				className: 'result',
			}]);
		}

		addGame(seed) {
			const index = this.gameSeeds.length;
			this.gameSeeds.push(seed);
			this.allScores.push([]);
			this.updateColumns();
			return index;
		}

		updateGameScores(token, scores) {
			this.allScores[token] = scores;
			scores.forEach((result) => {
				this.entryDataLookup.get(result.id)['game' + token] = {
					value: result.score,
					className: result.winner ? 'win' : '',
				};
			});

			const aggScores = this.scorer.score(this.entries, this.allScores);
			this.table.setData(aggScores.map((result) => {
				const line = this.entryDataLookup.get(result.id);
				line.score.value = result.score || '';
				line.score.className = result.winner ? 'win' : '';
				line.className = line.baseClassName;
				return line;
			}));
		}

		dom() {
			return this.table.dom();
		}
	}
});
