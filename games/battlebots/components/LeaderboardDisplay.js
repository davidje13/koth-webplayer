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

	return class LeaderboardDisplay extends EventObject {
		constructor() {
			super();

			this.tableTeamsLookup = new Map();
			this.tableEntriesLookup = new Map();
			this.seedLabel = docutil.text();

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
					title: 'Alive?',
					attribute: 'alive',
				}, {
					title: 'Kills',
					attribute: 'kills',
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
						alive: '',
						kills: '',
						time: '',
					});
				});
			});
		}

		clear() {
		}

		updateGameConfig({seed, teams}) {
			docutil.updateText(this.seedLabel, seed);
			this.updateTeams(teams);
		}

		updateDisplayConfig() {
		}

		updateState(state) {
			state.teams.forEach((team) => team.entries.forEach((entry) => {
				const tableEntry = this.tableEntriesLookup.get(entry.id);
				tableEntry.alive = entry.alive ? 'yes' : 'no';
				tableEntry.kills = entry.kills;
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
