define(() => {
	'use strict';

	const SCORING = [1, 0];

	const teamScoreSorter = (a, b) => {
		if(a.disqualified !== b.disqualified) {
			return a.disqualified ? 1 : -1;
		}
		if(a.survivors !== b.survivors) {
			return b.survivors - a.survivors;
		}
		return b.kills - a.kills;
	};

	const entryScoreSorter = (a, b) => {
		if(a.disqualified !== b.disqualified) {
			return a.disqualified ? 1 : -1;
		}
		if(a.alive !== b.alive) {
			return a.alive ? -1 : 1;
		}
		return b.kills - a.kills;
	};

	return {
		score: (config, {teams}) => {
			const gameTeamScores = teams.map((team) => {
				let teamSurvivors = 0;
				let teamKills = 0;
				let disqualified = true;
				const entries = [];
				team.entries.forEach((entry) => {
					if(!entry.disqualified) {
						disqualified = false;
						teamKills += entry.kills;
						teamSurvivors += (entry.alive ? 1 : 0);
					}
					entries.push({
						id: entry.id,
						alive: entry.alive,
						kills: entry.kills,
						disqualified: entry.disqualified,
					});
				});
				entries.sort(entryScoreSorter);
				return {
					id: team.id,
					survivors: teamSurvivors,
					kills: teamKills,
					disqualified,
					winner: false,
					score: 0,
					entries,
				};
			});
			gameTeamScores.sort(teamScoreSorter);

			let tiedPos = 0;
			let tiedSurvivors = 0;
			for(let i = 0; i < gameTeamScores.length; ++ i) {
				const place = gameTeamScores[i];
				if(place.survivors !== tiedSurvivors) {
					tiedPos = i;
					tiedSurvivors = place.survivors;
				}
				if(!place.disqualified && place.survivors > 0) {
					place.winner = (tiedPos === 0);
					place.score = SCORING[tiedPos];
				}
			}
			return {teams: gameTeamScores};
		},
	};
});
