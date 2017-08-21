define(['document'], (document) => {
	'use strict';

	return {
		body: document.body,

		getMetaTagValue: (name, fallback = null) => {
			const elements = document.getElementsByTagName('meta');
			for(let i = 0; i < elements.length; ++ i) {
				const meta = elements[i];
				if(meta.getAttribute('name') === name) {
					return meta.getAttribute('content');
				}
			}
			return fallback;
		},

		text: (text = '') => {
			return document.createTextNode(text);
		},

		make: (type, attrs = {}, children = []) => {
			const o = document.createElement(type);
			for(let k in attrs) {
				if(attrs.hasOwnProperty(k)) {
					o.setAttribute(k, attrs[k]);
				}
			}
			for(let i = 0; i < children.length; ++ i) {
				const child = children[i];
				let obj = null;
				if(typeof child === 'string') {
					obj = document.createTextNode(child);
				} else if(typeof child === 'number') {
					obj = document.createTextNode(String(child));
				} else {
					obj = child;
				}
				if(obj) {
					o.appendChild(obj);
				}
			}
			return o;
		},

		updateAttrs: (element, attrs) => {
			for(let k in attrs) {
				if(attrs.hasOwnProperty(k)) {
					if(element.getAttribute(k) !== attrs[k]) {
						element.setAttribute(k, attrs[k]);
					}
				}
			}
		},

		updateStyle: (element, style) => {
			for(let k in style) {
				if(style.hasOwnProperty(k)) {
					if(element.style[k] !== style[k]) {
						element.style[k] = style[k];
					}
				}
			}
		},

		updateText: (textNode, text) => {
			if(textNode.nodeValue !== text) {
				textNode.nodeValue = text;
			}
		},

		setParent: (element, parent) => {
			if(!parent) {
				if(element.parentNode) {
					element.parentNode.removeChild(element);
				}
			} else if(element.parentNode !== parent) {
				if(element.parentNode) {
					element.parentNode.removeChild(element);
				}
				parent.appendChild(element);
			}
		},

		addDragHandler: (element, handler) => {
			let dragX = null;
			let dragY = null;

			const mmHandler = (e) => {
				const dx = e.pageX - dragX;
				const dy = e.pageY - dragY;
				handler(dx, dy);
				dragX = e.pageX;
				dragY = e.pageY;
			};

			const muHandler = (e) => {
				mmHandler(e);
				window.removeEventListener('mousemove', mmHandler);
				window.removeEventListener('mouseup', muHandler);
				e.preventDefault();
			};

			element.addEventListener('mousedown', (e) => {
				dragX = e.pageX;
				dragY = e.pageY;
				window.addEventListener('mousemove', mmHandler);
				window.addEventListener('mouseup', muHandler);
				e.preventDefault();
			});
		},
	};
});
