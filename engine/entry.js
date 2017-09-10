'use strict';

// TODO:
// * currently using the code editor mutates the original team object state;
//   it should be considered immutable, and copies made (will need some
//   thought on how to handle propagating changes made in a game back to
//   tournaments / welcome screen)

require([
	'require',
	'display/documentUtils',
	'engine/configuration',
	'engine/Navigation',
	'engine/style.css',
], (
	require,
	docutil,
	pageConfig,
	Navigation
) => {
	const navigation = new Navigation();
	docutil.body.appendChild(navigation.dom());
	window.addEventListener('hashchange', () => navigation.checkNavigation());

	navigation.nav.push({
		navElements: ['WebPlayer', docutil.make('p', {}, [
			docutil.make('a', {
				'href': pageConfig.githubLink,
				'target': '_blank',
			}, ['GitHub']),
		])],
	});

	navigation.setLoadState('user interface', 0.1);
	require(['engine/Engine'], (Engine) => {
		const engine = new Engine(pageConfig, navigation.nav);
		navigation.setLoadState('game engine', 0.2);
		engine.loadGame().then(() => {
			navigation.setLoadState('entries', 0.3);
			return engine.loadEntries(({loaded, total}) => {
				navigation.setLoadState(
					'entries (' + loaded + '/' + total + ')',
					0.3 + 0.7 * (loaded / total)
				);
			});
		}).then(() => {
			navigation.removeLoader();
			engine.begin();
			navigation.addPageProvider(engine);
			navigation.checkNavigation();
		}).catch((error) => {
			navigation.removeLoader();
			const ignoreBtn = docutil.make('button', {}, ['Continue Anyway']);
			const errorDom = docutil.make('div', {'class': 'error'}, [
				'Failed to load entries: ' + error,
				ignoreBtn,
			]);
			ignoreBtn.addEventListener('click', () => {
				docutil.body.removeChild(errorDom);
				engine.begin();
				navigation.addPageProvider(engine);
				navigation.checkNavigation();
			});
			docutil.body.appendChild(errorDom);
		});
	});
});
