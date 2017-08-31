define(['core/EventObject', './document_utils', './style.css'], (EventObject, docutil) => {
	'use strict';

	// TODO: might be possible to merge this with HierarchyTable, or at least share lots of functionality

	function countNesting(items) {
		if(!items || !items.length) {
			return 0;
		}

		return 1 + items.reduce((max, child) => Math.max(max, countNesting(child.nested)), 0);
	}

	function countEntries(item) {
		if(!item.nested) {
			return 1;
		}

		return item.nested.reduce((total, child) => total + countEntries(child), 0);
	}

	function buildColumns(output, targetRows, columns, commonClasses = [], autohideAll = false) {
		if(!columns) {
			return 0;
		}

		const childRows = targetRows.slice(1);
		let colSpan = 0;
		columns.forEach((column) => {
			let title = column.title;
			if(title === undefined) {
				title = [];
			}
			if(!Array.isArray(title)) {
				title = [title];
			}
			(title || []).forEach((o) => {
				if(typeof o !== 'string') {
					docutil.setParent(o, null);
				}
			});
			const autohide = autohideAll || column.autohide;
			const classes = (
				column.className
				? [...commonClasses, column.className]
				: commonClasses
			);

			const className = (autohide ? [...classes, 'autohide'] : classes).join(' ');

			if(column.nested) {
				const childColSpan = buildColumns(
					output,
					childRows,
					column.nested,
					classes,
					autohide
				);
				if(childColSpan > 0) {
					targetRows[0].appendChild(docutil.make('th', {
						'class': className,
						'colspan': childColSpan,
					}, title));
					colSpan += childColSpan;
				}
			} else {
				output.push({
					attribute: column.attribute,
					columnClass: className,
				});
				targetRows[0].appendChild(docutil.make('th', {
					'class': className,
					'rowspan': targetRows.length,
				}, title));
				++ colSpan;
			}
		});

		return colSpan;
	}

	function buildRows(target, output, cols, datum, nesting = 0) {
		const row = docutil.make('tr', {'class': datum.className});
		if(datum.selectable !== false) {
			row.addEventListener('click', () => target.select(datum));
		}
		cols.forEach(({attribute, columnClass}, index) => {
			let v = datum[attribute];
			let className = columnClass;
			let title = '';
			if(v && typeof v === 'object' && v.hasOwnProperty('value')) {
				if(v.className) {
					className += ' ' + v.className;
				}
				title = v.title || '';
				v = v.value;
			}
			const cell = docutil.make('td', {
				'class': className,
				'title': title,
			}, [v]);
			if(index === 0) {
				cell.style.paddingLeft = (5 + nesting * 20) + 'px';
			}
			row.appendChild(cell);
		});
		output.push({key: datum.key, datum, row});
		if(datum.nested) {
			datum.nested.forEach((child) => buildRows(target, output, cols, child, nesting + 1));
		}
	}

	return class TreeTable extends EventObject {
		constructor({className = '', columns = [], data = []} = {}) {
			super();

			this.columns = columns;
			this.data = data;
			this.rows = [];
			this.rowLookup = new Map();
			this.selected = null;
			this.selectedKey = null;
			this.columnData = [];
			this.thead = docutil.make('thead');
			this.tbody = docutil.make('tbody');
			this.table = docutil.make(
				'table',
				{'class': 'tree-table ' + className},
				[this.thead, this.tbody]
			);
			this.redrawColumns();
		}

		redrawColumns() {
			docutil.empty(this.thead);

			const headerCount = countNesting(this.columns);
			const headerRows = [];
			for(let i = 0; i < headerCount; ++ i) {
				headerRows.push(docutil.make('tr'));
			}
			this.columnData.length = 0;
			buildColumns(this.columnData, headerRows, this.columns);
			headerRows.forEach((row) => this.thead.appendChild(row));

			this.redrawRows();
		}

		getItemByKey(key) {
			return this.rowLookup.get(key) || null;
		}

		getItemWhere(predicate) {
			let found = null;
			this.rowLookup.forEach((item) => {
				if(predicate(item)) {
					found = item;
				}
			});
			return found;
		}

		getSelectedItem() {
			return this.selected;
		}

		select(datum) {
			if(this.selected && this.selected.datum === datum) {
				return;
			}
			if(this.selected) {
				docutil.removeClass(this.selected.row, 'selected');
			}
			this.selected = null;
			this.selectedKey = null;
			if(datum && datum.selectable !== false) {
				this.rows.forEach((row) => {
					if(row.key === datum.key) {
						this.selected = row;
						this.selectedKey = row.key;
					}
				});
				if(this.selected) {
					docutil.addClass(this.selected.row, 'selected');
				}
			}
			this.trigger('select', [this.selected ? this.selected.datum : null]);
		}

		redrawRows() {
			docutil.empty(this.tbody);
			this.selected = null;

			// TODO: only redraw changed values
			// - each result has an associated row
			//   - rows need to account for rowspans; maybe group @ outermost level
			// - create any missing row entities and delete extras
			//   - maybe use 'key' concept from react to reduce rerendering due to reordering
			// - ensure rows are in correct order in table
			//   - note that rowspan'd cells will need to be kept on the top-most row of the block
			// - ensure data in rows is up to date

			this.rows.length = 0;
			this.rowLookup.clear();
			this.data.forEach((datum) => {
				buildRows(this, this.rows, this.columnData, datum);
			});
			this.rows.forEach((row) => {
				this.tbody.appendChild(row.row);
				this.rowLookup.set(row.key, row);
				if(row.key === this.selectedKey) {
					this.selected = row;
				}
			});
			if(this.selected) {
				docutil.addClass(this.selected.row, 'selected');
			} else {
				this.selectedKey = null;
			}
		}

		setColumns(columns) {
			this.columns = columns;
			this.redrawColumns();
		}

		setData(data) {
			this.data = data;
			this.redrawRows();
		}

		dom() {
			return this.table;
		}
	}
});
