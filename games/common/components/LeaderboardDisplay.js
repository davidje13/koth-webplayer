define([
	'core/EventObject',
	'display/documentUtils',
	'display/HierarchyTable',
], (
	EventObject,
	docutil,
	HierarchyTable
) => {
	'use strict';

	function thinkingTimeGenerator(entry) {
		if(entry.codeSteps <= 0) {
			return '';
		}
		return (entry.elapsedTime / entry.codeSteps).toFixed(3) + 'ms';
	}

	function parseColumns(columns, flatColumns, prefix) {
		return columns.map((column, index) => {
			const attribute = column.attribute || (prefix + index);
			let nested = null;
			if(column.nested) {
				nested = parseColumns(
					column.nested,
					flatColumns,
					attribute + '-'
				);
			}
			flatColumns.push({
				attribute,
				generator: column.generator || (() => null),
			});
			return Object.assign(column, {attribute, nested});
		});
	}

	return class LeaderboardDisplay extends EventObject {
		constructor({
			columns,
			GameScorer,
			includeThinkingTime = true,
			labelDecorator = null,
		}) {
			super();

			this.tableTeamsLookup = new Map();
			this.tableEntriesLookup = new Map();
			this.seedLabel = docutil.text();
			this.data = {};
			this.latestTeams = null;
			this.latestState = null;
			this.GameScorer = GameScorer;
			this.labelDecorator = labelDecorator || ((entry) => (entry.title));

			this.flatColumns = [];
			const allColumns = parseColumns(columns, this.flatColumns, 'col-');

			if(includeThinkingTime) {
				allColumns.push({
					title: 'Thinking Time',
					attribute: 'time',
					className: 'thinkingTime',
				});
				this.flatColumns.push({
					attribute: 'time',
					generator: thinkingTimeGenerator,
				});
			}

			this.table = new HierarchyTable({
				className: 'match',
				columns: [{
					title: docutil.make('header', {}, [
						docutil.make('h3', {}, ['Game']),
						docutil.make('p', {}, [this.seedLabel]),
					]),
					className: 'player',
					attribute: 'name',
				}, ...allColumns, {
					title: 'Score',
					attribute: 'score',
					className: 'result',
				}],
			});
		}

		updateTeams(teams) {
			this.tableTeamsLookup.clear();
			this.tableEntriesLookup.clear();

			this.latestTeams = teams;
			this.latestTeams.forEach((team) => {
				this.tableTeamsLookup.set(team.id, {
					key: team.id,
					className: 'team-' + team.id,
				});
				team.entries.forEach((entry) => {
					this.tableEntriesLookup.set(entry.id, {
						key: entry.id,
						className: '',
						name: null,
					});
				});
			});

			this.rerenderLabels();
		}

		rerenderLabels() {
			if(!this.latestTeams) {
				return;
			}

			this.latestTeams.forEach((team, teamIndex) =>
				team.entries.forEach((entry, entryIndex) => {
					const tableEntry = this.tableEntriesLookup.get(entry.id);
					tableEntry.name = {
						value: this.labelDecorator(
							entry,
							entryIndex,
							teamIndex,
							this.data
						),
						title: entry.title,
					};
				})
			);
		}

		rerenderData() {
			if(!this.latestState) {
				return;
			}

			this.latestState.teams.forEach((team, teamIndex) =>
				team.entries.forEach((entry, entryIndex) => {
					const tableEntry = this.tableEntriesLookup.get(entry.id);
					this.flatColumns.forEach((column) => {
						tableEntry[column.attribute] = column.generator(
							entry,
							entryIndex,
							teamIndex,
							this.data
						);
					});
					tableEntry.className = (entry.disqualified ? 'disqualified' : '');
				})
			);

			const teamScores = this.GameScorer.score(null, this.latestState).teams;
			this.table.setData(teamScores.map((teamScore) => Object.assign({
				score: {
					value: teamScore.score || '',
					className: (teamScore.winner ? 'win' : ''),
				},
				nested: teamScore.entries.map((entryScore) =>
					this.tableEntriesLookup.get(entryScore.id)
				),
			}, this.tableTeamsLookup.get(teamScore.id))));
		}

		clear() {
			this.tableTeamsLookup.clear();
			this.tableEntriesLookup.clear();
			this.latestTeams = null;
			this.latestState = null;
			this.table.setData([]);
		}

		updateGameConfig({seed, teams}) {
			docutil.updateText(this.seedLabel, seed);
			this.updateTeams(teams);
		}

		setCustomData(data) {
			Object.assign(this.data, data);
			this.rerenderLabels();
			this.rerenderData();
		}

		updateState(state) {
			this.latestState = state;
			this.rerenderData();
		}

		dom() {
			return this.table.dom();
		}
	};
});
