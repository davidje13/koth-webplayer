define(() => {
	'use strict';

	return class BoardRenderer {
		constructor() {
			this.width = 0;
			this.height = 0;
		}

		clear() {
			this.width = 0;
			this.height = 0;
		}

		updateGameConfig({width, height}) {
			if(width !== this.width || height !== this.height) {
				this.width = width;
				this.height = height;
			}
		}

		getSize() {
			return {
				width: this.width,
				height: this.height,
			};
		}
	};
});
