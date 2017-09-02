define(['./documentUtils', './style.css'], (docutil) => {
	'use strict';

	return class NestedNav {
		constructor() {
			this.nav = docutil.make('ol');
			this.hold = docutil.make('div');
			this.items = [];
			this.currentPage = null;
			this.currentIndex = -1;
		}

		_swapPage(page, toChild) {
			if(this.currentPage !== page) {
				if(this.currentPage) {
					this.currentPage.dispatchEvent(new CustomEvent('leave', {detail: {toChild}}));
					this.hold.removeChild(this.currentPage);
				}
				this.currentPage = page;
				if(page) {
					this.hold.appendChild(page);
					page.dispatchEvent(new CustomEvent('enter'));
				}
			}
		}

		goToIndex(index, {changeHash = true, trimAfter = true} = {}) {
			if(index < 0 || index >= this.items.length) {
				return false;
			}
			const item = this.items[index];
			if(this.currentIndex !== index) {
				this._swapPage(item.page, index > this.currentIndex);
				this.currentIndex = index;
				if(trimAfter) {
					this.popTo(index, {navigate: false});
				}
			}
			if(changeHash && item.hash !== null) {
				document.location.hash = item.hash;
			}
			return true;
		}

		goToHash(hash, opts) {
			for(let i = 0; i < this.items.length; ++ i) {
				const item = this.items[i];
				if(item.page && item.hash === hash) {
					return this.goToIndex(i, opts);
				}
			}
			return false;
		}

		_makeItem(index, {hash = null, page = null, navElements}) {
			let navDOM = null;
			let clickHandler = null;
			if(page) {
				navDOM = docutil.make('a', {'href': '#' + (hash || '')}, [
					docutil.make('li', {}, navElements),
				]);
				clickHandler = (e) => {
					if(e.target.tagName.toUpperCase() === 'A') {
						return;
					}
					e.preventDefault();
					this.goToIndex(index);
				};
				navDOM.addEventListener('click', clickHandler);
			} else {
				navDOM = docutil.make('li', {}, navElements);
			}
			return {
				navDOM,
				clickHandler,
				page,
				hash,
			};
		}

		_clearItem(item) {
			if(item.clickHandler) {
				item.navDOM.removeEventListener('click', item.clickHandler);
			}
		}

		push(details, {navigate = true, changeHash = true} = {}) {
			const index = this.items.length;
			const item = this._makeItem(index, details);
			this.nav.appendChild(item.navDOM);
			this.items.push(item);
			if(item.page) {
				item.page.dispatchEvent(new CustomEvent('push'));
			}
			if(navigate) {
				this.goToIndex(index, {changeHash});
			}
			return index;
		}

		swap(index, details, {navigate = true, changeHash = true} = {}) {
			if(index < 0 || index >= this.items.length) {
				return;
			}
			const item = this._makeItem(index, details);
			const oldItem = this.items[index];
			if(item.page !== oldItem.page && oldItem.page) {
				oldItem.page.dispatchEvent(new CustomEvent('pop'));
			}
			this.nav.replaceChild(item.navDOM, oldItem.navDOM);
			this.items[index] = item;
			if(item.page !== oldItem.page && item.page) {
				item.page.dispatchEvent(new CustomEvent('push'));
			}
			this._clearItem(oldItem);
			if(index === this.currentIndex && navigate) {
				this.goToIndex(index, {changeHash, trimAfter: false});
			}
		}

		pop(index = null, {navigate = true, changeHash = true} = {}) {
			if(index === null) {
				index = this.items.length - 1;
			}
			if(index < 0 || index >= this.items.length) {
				return;
			}
			const oldItem = this.items[index];
			if(oldItem.page) {
				oldItem.page.dispatchEvent(new CustomEvent('pop'));
			}
			this.nav.removeChild(oldItem.navDOM);
			this.items.splice(index, 1);
			this._clearItem(oldItem);
			if(index === this.currentIndex) {
				if(!navigate) {
					this.currentIndex = -1;
				} else if(index === 0) {
					this._swapPage(null, false);
					this.currentIndex = -1;
					if(changeHash) {
						document.location.hash = '';
					}
				} else {
					this.goToIndex(index - 1, {changeHash});
				}
			}
		}

		popTo(index, opts) {
			for(let i = this.items.length - 1; i > index; -- i) {
				this.pop(i, opts);
			}
		}

		navDOM() {
			return this.nav;
		}

		pageDOM() {
			return this.hold;
		}
	};
});
