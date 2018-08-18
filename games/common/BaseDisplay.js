define([
	'core/EventObject',
	'display/documentUtils',
	'games/common/style.css',
], (
	EventObject,
	docutil
) => {
	'use strict';

	return class NestedDisplay extends EventObject {
		constructor(mode) {
			super();

			this.mode = mode;
			this.children = [];
			this.latestPlayConfig = {};
			this.latestGameConfig = {};
			this.latestDisplayConfig = {};
			this.latestState = {};

			const entryEditButton = docutil.make(
				'button',
				{'class': 'entry-edit-button'},
				['Edit Entries']
			);
			entryEditButton.addEventListener('click', () => {
				this.trigger('editentries');
			});

			this.visContainer = docutil.make('div', {'class': 'visualisation-container'});

			this.root = docutil.make('section', {'class': 'game-container'}, [
				mode.screensaver ? null : entryEditButton,
				this.visContainer,
			]);
		}

		checkModeMask(modeMask) {
			for(let k in modeMask) {
				if(modeMask.hasOwnProperty(k)) {
					if(Boolean(this.mode[k]) !== Boolean(modeMask[k])) {
						return false;
					}
				}
			}
			return true;
		}

		addVisualisationChild(o, modeMask = {}) {
			if(!o || !this.checkModeMask(modeMask)) {
				return;
			}
			this.children.push(o);
			this.visContainer.appendChild(o.dom());
		}

		addChild(o, modeMask = {}) {
			if(!o || !this.checkModeMask(modeMask)) {
				return;
			}
			this.children.push(o);
			if(o.dom) {
				this.root.appendChild(o.dom());
			}
		}

		clear() {
			this.latestPlayConfig = {};
			this.latestGameConfig = {};
			this.latestDisplayConfig = {};
			this.latestState = {};
			this.children.forEach((child) => child.clear && child.clear());
		}

		updatePlayConfig(config) {
			this.latestPlayConfig = config;
			this.children.forEach((child) =>
				child.updatePlayConfig && child.updatePlayConfig(config));
		}

		updateGameConfig(config) {
			this.latestGameConfig = config;
			this.children.forEach((child) =>
				child.updateGameConfig && child.updateGameConfig(config));
		}

		updateDisplayConfig(config) {
			this.latestDisplayConfig = config;
			this.children.forEach((child) =>
				child.updateDisplayConfig && child.updateDisplayConfig(config));
		}

		updateState(state) {
			this.latestState = state;
			this.children.forEach((child) =>
				child.updateState && child.updateState(state));
		}

		dom() {
			return this.root;
		}
	};
});
