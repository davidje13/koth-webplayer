define(() => {
	'use strict';

	return {
		pickTeams: (entries, {offset = 0, divide = 1, count = 2}) => {
			const teams = [];
			for(let i = 0; i < count; ++ i) {
				teams[i] = {
					id: 'T' + i,
					entries: [],
				};
			}
			entries.forEach((entry) => {
				const teamIndex = Math.floor(
					(entry.userID + offset) / divide
				) % count;
				teams[teamIndex].entries.push(entry);
			});
			return teams;
		},
	};
});
