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

	// TODO:
	// * Make this into a reusable component for all games

	const WORKER_COUNT = 4;

	return class LeaderboardDisplay extends EventObject {
		constructor() {
			super();

			this.tableTeamsLookup = new Map();
			this.tableEntriesLookup = new Map();
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

		updateTeams(teams) {
			this.tableTeamsLookup.clear();
			this.tableEntriesLookup.clear();

			teams.forEach((team) => {
				this.tableTeamsLookup.set(team.id, {
					key: team.id,
					className: 'team-' + team.id,
				});
				team.entries.forEach((entry) => {
					this.tableEntriesLookup.set(entry.id, {
						key: entry.id,
						className: '',
						name: {
							value: entry.title,
							title: entry.title,
						},
						food: 0,
						time: '',
					});
				});
			});
		}

		clear() {
			this.table.setData([]);
		}

		updateGameConfig({seed, teams}) {
			docutil.updateText(this.seedLabel, seed);
			this.updateTeams(teams);
		}

		updateState(state) {
			state.teams.forEach((team) => team.entries.forEach((entry) => {
				const tableEntry = this.tableEntriesLookup.get(entry.id);
				tableEntry.food = entry.food;
				entry.workers.forEach((count, index) => {
					tableEntry['type' + index] = count;
				});
				tableEntry.className = (entry.disqualified ? 'disqualified' : '');
				if(entry.codeSteps > 0) {
					tableEntry.time = (entry.elapsedTime / entry.codeSteps).toFixed(3) + 'ms';
				} else {
					tableEntry.time = '';
				}
			}));

			this.table.setData(GameScorer.score(null, state).teams.map((teamScore) => Object.assign({
				score: {
					value: teamScore.score || '',
					className: (teamScore.winner ? 'win' : ''),
				},
				nested: teamScore.entries.map((entryScore) => this.tableEntriesLookup.get(entryScore.id)),
			}, this.tableTeamsLookup.get(teamScore.id))));
		}

		dom() {
			return this.table.dom();
		}
	}
});
