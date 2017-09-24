define([
	'core/EventObject',
	'core/AnimatingProperty',
	'./documentUtils',
	'./Full2DBoard',
	'./Full3DBoard',
], (
	EventObject,
	AnimatingProperty,
	docutil,
	Full2DBoard,
	Full3DBoard
) => {
	'use strict';

	return class FullSwitchingBoard extends EventObject {
		constructor({
			renderer,
			markerStore = null,
			markerTypes3D = null,
			begin3D = false,
			scaleX = 1,
			scaleY = null,
		}) {
			super();

			this.renderer = renderer;
			this.markerStore = markerStore;
			this.markerTypes3D = markerTypes3D;
			this.board2D = null;
			this.board3D = null;
			this.active = null;
			this.latestWidth = 0;
			this.latestHeight = 0;

			this.blockFirstAnim = (begin3D === null);
			this.currentFrac = new AnimatingProperty(
				this._updateRendered.bind(this),
				begin3D ? 1 : 0,
				1000
			);
			this.drawnFrac = 0;
			this.wireframe = false;

			this.container = docutil.make('div');

			this.setScale(scaleX, scaleY);
			this._updateRendered();
		}

		_updateSizes() {
			if(this.board3D) {
				const ww = Math.round(this.latestWidth * this.scaleX);
				const hh = Math.round(this.latestHeight * this.scaleY);
				this.board3D.resize(ww, hh);
			}
			if(this.board2D) {
				this.board2D.setScale(this.scaleX, this.scaleY);
			}
		}

		_make2DBoard() {
			if(!this.board2D) {
				this.board2D = new Full2DBoard({
					renderer: this.renderer,
					markerStore: this.markerStore,
					scaleX: this.scaleX,
					scaleY: this.scaleY,
				});
			}
		}

		_make3DBoard() {
			if(!this.board3D) {
				const ww = Math.round(this.latestWidth * this.scaleX);
				const hh = Math.round(this.latestHeight * this.scaleY);
				this.board3D = new Full3DBoard({
					renderer: this.renderer,
					markerStore: this.markerStore,
					markerTypes: this.markerTypes3D,
					width: ww,
					height: hh,
				});
				this.board3D.setWireframe(this.wireframe);
			}
		}

		_updateRendered() {
			const frac = this.currentFrac.getValue();
			const is3D = frac > 0;
			if(is3D && !this.board3D) {
				this._make3DBoard();
			}
			if(!is3D && !this.board2D) {
				this._make2DBoard();
			}

			if(is3D && this.drawnFrac !== frac) {
				this.drawnFrac = frac;
				const smoothedFrac = 0.5 - Math.cos(frac * Math.PI) * 0.5;
				this.board3D.set3DRatio(smoothedFrac);
				if(this.active === this.board3D) {
					this.board3D.rerender();
				}
			}

			const desired = (is3D ? this.board3D : this.board2D);
			if(this.active !== desired) {
				if(this.active) {
					this.container.removeChild(this.active.dom());
					this.active.removeEventForwarding(this);
				}
				desired.addEventForwarding(this);
				this.container.appendChild(desired.dom());
				this.active = desired;
				this.active.repaint();
			}
		}

		setMarkerStore(markerStore) {
			this.markerStore = markerStore;
			if(this.board2D) {
				this.board2D.setMarkerStore(this.markerStore);
			}
			if(this.board3D) {
				this.board3D.setMarkerStore(this.markerStore);
			}
		}

		setmarkerTypes3D(markerTypes3D) {
			this.markerTypes3D = markerTypes3D;
			if(this.board3D) {
				this.board3D.setmarkerTypes(this.markerTypes3D);
			}
		}

		setScale(x, y = null) {
			if(y === null) {
				y = x;
			}
			this.scaleX = x;
			this.scaleY = y;
			this._updateSizes();
		}

		setWireframe(on) {
			this.wireframe = on;
			if(this.board3D) {
				this.board3D.setWireframe(on);
			}
		}

		rerender() {
			if(this.active) {
				this.active.rerender();
			}
		}

		repaint() {
			const data = this.renderer.getImageData();
			if(data) {
				const dataScale = this.renderer.scale || 1;
				this.latestWidth = data.width / dataScale;
				this.latestHeight = data.height / dataScale;
				this._updateSizes();
				if(!this.board3D) {
					// Prepare 3D board in advance to avoid glitchy animation
					// (might be worth using requestIdleCallback, but we can't
					// control how long it will take to build the canvas)
					setTimeout(this._make3DBoard.bind(this), 0);
				}
			}
			if(this.active) {
				this.active.repaint();
			}
		}

		is3D() {
			return this.target > 0;
		}

		switch3D(on, animated = true) {
			this.currentFrac.set((on ? 1 : 0), {
				animated: animated && !this.blockFirstAnim,
			});
			this.blockFirstAnim = false;
		}

		dom() {
			return this.container;
		}
	};
});
