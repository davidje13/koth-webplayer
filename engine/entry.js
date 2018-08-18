'use strict';

// TODO:
// * currently using the code editor mutates the original team object state;
//   it should be considered immutable, and copies made (will need some
//   thought on how to handle propagating changes made in a game back to
//   tournaments / welcome screen)

requirejs([
	'requirejs',
	'display/documentUtils',
	'engine/configuration',
	'engine/Navigation',
	'engine/style.css',
], (
	requirejs,
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

	function stringifyError(e) {
		if(!e) {
			return '';
		}
		let msg = e.toString();
		if(e.stack) {
			// WORKAROUND (Safari): e.stack is not string-like unless it
			// has a non-empty string appended
			const stack = e.stack + '.';
			if(stack.indexOf(msg) !== -1) {
				msg = stack;
			} else {
				msg += ' : ' + stack;
			}
		}
		return msg;
	}

	function removeLoader() {
		window.removeEventListener('error', handleLoadError);
		window.removeEventListener('unhandledrejection', handleLoadError);
		navigation.removeLoader();
	}

	function handleLoadError(e) {
		removeLoader();
		docutil.body.appendChild(docutil.make('div', {'class': 'error wide'}, [
			'Failed to load',
			docutil.make('pre', {}, [stringifyError(e)]),
		]));
	}

	window.addEventListener('error', handleLoadError);
	window.addEventListener('unhandledrejection', handleLoadError);

	navigation.setLoadState('user interface', 0.1);
	requirejs(['engine/Engine'], (Engine) => {
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
			removeLoader();
			engine.begin();
			navigation.addPageProvider(engine);
			navigation.checkNavigation();
		}, (error) => {
			removeLoader();
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
		}).catch(handleLoadError);
	});
});
