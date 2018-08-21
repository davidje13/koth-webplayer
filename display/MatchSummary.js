define([
	'core/EventObject',
	'./documentUtils',
	'./HierarchyTable',
	'./Loader',
	'./style.css',
], (
	EventObject,
	docutil,
	HierarchyTable,
	Loader
) => {
	'use strict';

	class GameColumn extends EventObject {
		constructor(seed, label) {
			super();

			this.scoresCallback = null;
			const link = docutil.make('a', {'href': '#' + seed}, [label]);
			link.addEventListener('click', (e) => {
				e.preventDefault();
				this.trigger('titleclick');
			});
			this.progress = new Loader('', null);
			this.title = docutil.make('header', {}, [
				docutil.make('h4', {}, [link]),
				this.progress.dom(),
//				docutil.make('p', {}, [seed]),
			]);
		}

		setScoresCallback(callback) {
			this.scoresCallback = callback;
		}

		updateProgress(progress, scores) {
			this.progress.setState(progress);
			if(this.scoresCallback) {
				this.scoresCallback(scores);
			}
		}
	}

	return class MatchSummary extends EventObject {
		constructor({name = 'Match', seed = '', teams}) {
			super();

			this.name = name;
			this.matchSeed = seed;
			this.teams = teams;
			this.matchScores = {
				teams: teams.map((team) => ({
					id: team.id,
					winner: false,
					score: null,
					certainty: null,
				})),
			};
			this.games = [];
			this.tableTeamsLookup = new Map();
			teams.forEach((team) => {
				this.tableTeamsLookup.set(team.id, {
					key: team.id,
					className: 'team-' + team.id,
					score: {value: '', className: ''},
					certainty: '',
					nested: team.entries.map((entry) => ({
						name: {
							value: entry.title,
							title: entry.title,
						},
					})),
				});
			});

			this.table = new HierarchyTable({className: 'match expanded'});
			this.updateColumns(0);
		}

		sendData() {
			this.table.setData(this.matchScores.teams.map((matchTeamScore) => {
				const tableTeam = this.tableTeamsLookup.get(matchTeamScore.id);
				if(matchTeamScore.score !== null) {
					tableTeam.score.value = matchTeamScore.score.toFixed(1);
				} else {
					tableTeam.score.value = '';
				}
				tableTeam.score.className = matchTeamScore.winner ? 'win' : '';
				if(matchTeamScore.certainty !== null) {
					tableTeam.certainty = (
						(matchTeamScore.certainty * 100).toFixed(1) + '%'
					);
				} else {
					tableTeam.certainty = null;
				}
				return tableTeam;
			}));
		}

		updateColumns() {
			const gameCols = this.games.map((game) => ({
				title: game.title,
				attribute: game.id,
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
				title: 'Average',
				attribute: 'score',
				className: 'result',
			}, {
				title: 'M-W',
				tooltip: (
					'distinctness from next-highest entry' +
					' (Mann-Whitney U test)'
				),
				attribute: 'certainty',
				className: 'certainty',
			}]);

			this.sendData();
		}

		addGame(seed, name) {
			const game = new GameColumn(seed, name);
			game.id = 'game' + this.games.length;
			game.setScoresCallback((scores) => {
				scores.teams.forEach((gameTeamScore) => {
					this.tableTeamsLookup.get(gameTeamScore.id)[game.id] = {
						value: gameTeamScore.score,
						className: gameTeamScore.winner ? 'win' : '',
					};
				});

//				this.sendData();
			});
			this.games.push(game);
			this.updateColumns();
			return game;
		}

		updateProgress(progress, scores) {
			this.matchScores = scores;
			this.sendData();
		}

		dom() {
			return this.table.dom();
		}
	};
});
