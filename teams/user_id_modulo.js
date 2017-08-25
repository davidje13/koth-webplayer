define(() => {
	'use strict';

	return {
		pickTeams: (entries, {count = 2}) => {
			const teams = [];
			for(let i = 0; i < count; ++ i) {
				teams[i] = {
					id: 'T' + i,
					entries: [],
				};
			}
			entries.forEach((entry) => {
				teams[entry.user_id % count].entries.push(entry);
			});
			return teams;
		},
	};
});
