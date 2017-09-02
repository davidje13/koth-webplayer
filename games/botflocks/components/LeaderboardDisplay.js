define([
	'core/EventObject',
	'display/documentUtils',
	'display/HierarchyTable',
	'../GameScorer',
], (
	EventObject,
	docutil,
	HierarchyTable,
	GameScorer,
) => {
	'use strict';

	return class LeaderboardDisplay extends EventObject {
		constructor() {
			super();

			this.tableTeamsLookup = new Map();
			this.tableEntriesLookup = new Map();
			this.seedLabel = docutil.text();
			this.colourChoices = {};
			this.colourscheme = '';

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
					title: 'Points',
					attribute: 'points',
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

		setColourChoices(colourChoices) {
			this.colourChoices = colourChoices;
			this.redraw();
		}

		updateTeams(teams) {
			this.tableTeamsLookup.clear();
			this.tableEntriesLookup.clear();

			teams.forEach((team, teamIndex) => {
				const colSample = docutil.make('div', {'class': 'colour-sample'});
				this.tableTeamsLookup.set(team.id, {
					key: team.id,
					teamIndex,
					className: 'team-' + team.id,
					colSample,
				});
				team.entries.forEach((entry) => {
					this.tableEntriesLookup.set(entry.id, {
						key: entry.id,
						className: '',
						name: {
							value: docutil.make('span', {}, [colSample, entry.title]),
							title: entry.title,
						},
						points: '',
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

		updateDisplayConfig({colourscheme}) {
			if(colourscheme !== this.colourscheme) {
				this.colourscheme = colourscheme;
				this.redraw();
			}
		}

		redraw() {
			const scheme = this.colourChoices[this.colourscheme];
			if(scheme) {
				const palette = scheme.palette;
				this.tableTeamsLookup.forEach((team) => {
					const c = palette[team.teamIndex + 3] || palette[2];
					docutil.updateStyle(team.colSample, {
						background: 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')',
					});
				});
			}
		}

		updateState(state) {
			state.teams.forEach((team) => team.entries.forEach((entry) => {
				const tableEntry = this.tableEntriesLookup.get(entry.id);
				tableEntry.points = entry.points;
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

			this.redraw();
		}

		dom() {
			return this.table.dom();
		}
	}
});
