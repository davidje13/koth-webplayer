define(() => {
	'use strict';

	const teamScoreSorter = (a, b) => {
		if(a.disqualified !== b.disqualified) {
			return a.disqualified ? 1 : -1;
		}
		if(a.hasFlag !== b.hasFlag) {
			return a.hasFlag ? -1 : 1;
		}
		if(a.free !== b.free) {
			return b.free - a.free;
		}
		return b.captures - a.captures;
	};

	const entryScoreSorter = (a, b) => {
		if(a.disqualified !== b.disqualified) {
			return a.disqualified ? 1 : -1;
		}
		if(a.captured !== b.captured) {
			return a.captured ? 1 : -1;
		}
		if(a.hasFlag !== b.hasFlag) {
			return a.hasFlag ? -1 : 1;
		}
		return b.captures - a.captures;
	};

	return {
		score: (config, {teams}) => {
			const gameTeamScores = teams.map((team) => {
				let teamHasFlag = false;
				let teamFree = 0;
				let teamCaptures = 0;
				let disqualified = true;
				const entries = [];
				team.entries.forEach((entry) => {
					if(!entry.disqualified) {
						disqualified = false;
						if(entry.hasFlag) {
							teamHasFlag = true;
						}
						teamFree += (entry.captured ? 0 : 1);
						teamCaptures += entry.captures;
					}
					entries.push({
						id: entry.id,
						hasFlag: entry.hasFlag,
						captured: entry.captured,
						captures: entry.captures,
						disqualified: entry.disqualified,
					});
				});
				entries.sort(entryScoreSorter);
				return {
					id: team.id,
					hasFlag: teamHasFlag,
					free: teamFree,
					captures: teamCaptures,
					disqualified,
					winner: team.hasWon,
					score: team.hasWon ? 1 : 0,
					entries,
				};
			});
			gameTeamScores.sort(teamScoreSorter);

			return {teams: gameTeamScores};
		},
	};
});
