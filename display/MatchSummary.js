define([
	'core/EventObject',
	'./document_utils',
	'./ResultTable',
	'./Loader',
	'./style.css',
], (
	EventObject,
	docutil,
	ResultTable,
	Loader,
) => {
	'use strict';

	return class MatchSummary extends EventObject {
		constructor({name = 'Match', seed = '', entries, matchScorer}) {
			super();

			this.name = name;
			this.matchSeed = seed;
			this.entries = entries;
			this.matchScorer = matchScorer;
			this.allScores = [];
			this.games = [];
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

			this.table = new ResultTable({className: 'match expanded'});
			this.updateColumns(0);
		}

		updateColumns() {
			const gameCols = this.games.map((game, index) => ({
				title: game.title,
				attribute: 'game' + index,
				autohide: true,
			}));

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
			const index = this.games.length;
			const link = docutil.make('a', {'href': '#'}, ['G' + (index + 1)]);
			link.addEventListener('click', (e) => {
				e.preventDefault();
				this.trigger('gametitleclick', [index]);
			});
			const progress = new Loader('', null);
			this.games.push({
				seed,
				link,
				progress,
				title: docutil.make('header', {}, [
					docutil.make('h4', {}, [link]),
					progress.dom(),
//					docutil.make('p', {}, [seed]),
				]),
			});
			this.allScores.push([]);
			this.updateColumns();
			return index;
		}

		updateGameState(token, progress, scores) {
			const game = this.games[token];
			game.progress.setState(progress);

			this.allScores[token] = scores;
			scores.forEach((result) => {
				this.entryDataLookup.get(result.id)['game' + token] = {
					value: result.score,
					className: result.winner ? 'win' : '',
				};
			});

			const aggScores = this.matchScorer.score(this.entries, this.allScores);
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
