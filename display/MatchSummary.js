define([
	'core/EventObject',
	'./document_utils',
	'./HierarchyTable',
	'./Loader',
	'./style.css',
], (
	EventObject,
	docutil,
	HierarchyTable,
	Loader,
) => {
	'use strict';

	return class MatchSummary extends EventObject {
		constructor({name = 'Match', seed = '', teams, matchScorer}) {
			super();

			this.name = name;
			this.matchSeed = seed;
			this.teams = teams;
			this.matchScorer = matchScorer;
			this.gameScores = [];
			this.games = [];
			this.tableTeamsLookup = new Map();
			teams.forEach((team) => {
				this.tableTeamsLookup.set(team.id, {
					key: team.id,
					className: 'team-' + team.id,
					score: {value: '', className: ''},
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
			const matchScore = this.matchScorer.score(this.teams, this.gameScores);
			this.table.setData(matchScore.teams.map((matchTeamScore) => {
				const tableTeam = this.tableTeamsLookup.get(matchTeamScore.id);
				if(matchTeamScore.score) {
					tableTeam.score.value = matchTeamScore.score.toFixed(1);
				} else {
					tableTeam.score.value = '';
				}
				tableTeam.score.className = matchTeamScore.winner ? 'win' : '';
				return tableTeam;
			}));
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

			this.sendData();
		}

		addGame(seed) {
			const index = this.games.length;
			const link = docutil.make('a', {'href': '#' + seed}, ['G' + (index + 1)]);
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
			this.gameScores.push({teams: []});
			this.updateColumns();
			return index;
		}

		updateGameState(token, progress, gameScore) {
			const game = this.games[token];
			game.progress.setState(progress);

			this.gameScores[token] = gameScore;
			gameScore.teams.forEach((gameTeamScore) => {
				this.tableTeamsLookup.get(gameTeamScore.id)['game' + token] = {
					value: gameTeamScore.score,
					className: gameTeamScore.winner ? 'win' : '',
				};
			});

			this.sendData();
		}

		dom() {
			return this.table.dom();
		}
	}
});
