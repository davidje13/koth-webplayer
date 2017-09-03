define(() => {
	'use strict';

	// This calculates scores for game results, which are used by matches to
	// decide winners.

	return {
		score: (gameConfig, state) => {
			// - gameConfig is the game configuration object which was given to
			//   the game being scored (it will have a seed, entries and the
			//   configuration you specified in <meta name="game-config" ...>)
			// - state is from the last call to GameManager.getState

			// You should return an object containing an ordered (best-to-worst)
			// list of teams and their scores. Each team should contain an
			// ordered (best-to-worst) list of their entries:
			// {teams: [
			//   {
			//     id: 'myWinningTeamID',
			//     score: 7,
			//     winner: true, // true for any team to be considered a winner
			//     (any other properties you want to pass down for display)
			//     entries: [
			//       {
			//         id: 'myBestEntryID',
			//         score: 3,
			//         winner: true, // true for any entry to be considered a winner
			//         (any other properties you want to pass down for display)
			//       },
			//       (more entries for this team...)
			//     ]
			//   },
			//   (more teams...)
			// ]}

			return {teams: []};
		},
	};
});
