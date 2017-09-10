define([
	'display/documentUtils',
	'display/NestedNav',
	'display/Loader',
], (
	docutil,
	NestedNav,
	Loader
) => {
	'use strict';

	return class Navigation {
		constructor() {
			this.nav = new NestedNav();
			this.loader = new Loader('initial-load');

			this.base = docutil.make('div', {}, [
				docutil.make('nav', {}, [this.nav.navDOM()]),
				this.nav.pageDOM(),
				this.loader.dom(),
			]);

			this.pageProviders = [];
		}

		addPageProvider(provider) {
			this.pageProviders.push(provider);
		}

		checkNavigation() {
			const hash = decodeURIComponent((window.location.hash || '#').substr(1));
			if(this.nav.goToHash(hash)) {
				return true;
			}
			for(let i = 0; i < this.pageProviders.length; ++ i) {
				if(this.pageProviders[i].providePage(hash)) {
					return true;
				}
			}
			/* globals console */
			console.log('Unknown hash request', hash);
			return false;
		}

		setLoadState(label, progress) {
			this.loader.setState(label, progress);
		}

		removeLoader() {
			docutil.setParent(this.loader.dom(), null);
		}

		dom() {
			return this.base;
		}
	};
});
