define(() => {
	'use strict';

	return {
		pickTeams: (entries) => {
			return entries.map((entry, index) => ({
				id: 'T' + index,
				entries: [entry],
			}));
		},
	};
});
