define([
	'core/EventObject',
	'display/documentUtils',
	'display/HierarchyTable',
	'../GameScorer',
], (
	EventObject,
	docutil,
	HierarchyTable,
	GameScorer
) => {
	'use strict';

	return class LeaderboardDisplay extends EventObject {
		constructor() {
			super();

			this.tableTeamsLookup = new Map();
			this.tableEntriesLookup = new Map();
			this.seedLabel = docutil.text();

			this.table = new HierarchyTable({
				className: 'match',
				columns: [{
					title: docutil.make('header', {}, [
						docutil.make('h3', {}, ['Game']),
						docutil.make('p', {}, [this.seedLabel]),
					]),
					className: 'player',
					attribute: 'name',
				}, {
					title: 'Jailed?',
					attribute: 'captured',
				}, {
					title: 'Has Flag?',
					attribute: 'hasFlag',
				}, {
					title: 'Captures',
					attribute: 'captures',
				}, {
					title: 'Strength',
					attribute: 'strength',
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
						captured: '',
						hasFlag: '',
						captures: '',
						strength: '',
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
				tableEntry.captured = entry.captured ? 'yes' : 'no';
				tableEntry.hasFlag = entry.hasFlag ? 'yes' : 'no';
				tableEntry.captures = entry.captures;
				tableEntry.strength = entry.strength.toFixed(1);
				tableEntry.className = (entry.disqualified ? 'disqualified' : '');
				if(entry.codeSteps > 0) {
					tableEntry.time = (entry.elapsedTime / entry.codeSteps).toFixed(3) + 'ms';
				} else {
					tableEntry.time = '';
				}
			}));

			const teamScores = GameScorer.score(null, state).teams;
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

		dom() {
			return this.table.dom();
		}
	};
});
