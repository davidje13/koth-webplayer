define(['./document_utils', './style.css'], (docutil) => {
	'use strict';

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

	function populateRows(targetRows, datum, attribute, columnClass) {
		if(datum.hasOwnProperty(attribute) || !datum.nested) {
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
			const rowCount = countEntries(datum);
			targetRows[0].appendChild(docutil.make('td', {
				'class': className,
				'rowspan': rowCount,
				'title': title,
			}, [v]));
			return rowCount;
		}
		let offset = 0;
		datum.nested.forEach((child) => {
			offset += populateRows(targetRows.slice(offset), child, attribute, columnClass);
		});
		return offset;
	}

	function createRows(output, datum, commonClasses = []) {
		const classes = (
			datum.className
			? [...commonClasses, datum.className]
			: commonClasses
		);

		if(datum.nested) {
			datum.nested.forEach((child) => createRows(output, child, classes));
		} else {
			output.push(docutil.make('tr', {'class': classes.join(' ')}));
		}
	}

	function buildRows(cols, datum) {
		const rows = [];
		createRows(rows, datum);
		cols.forEach(({attribute, columnClass}) => {
			populateRows(rows, datum, attribute, columnClass);
		});
		return rows;
	}

	return class HierarchyTable {
		constructor({className = '', columns = [], data = []} = {}) {
			this.columns = columns;
			this.data = data;
			this.columnData = [];
			this.thead = docutil.make('thead');
			this.tbody = docutil.make('tbody');
			this.table = docutil.make(
				'table',
				{'class': 'hierarchy-table ' + className},
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

		redrawRows() {
			docutil.empty(this.tbody);

			// TODO: only redraw changed values
			// - each result has an associated row
			//   - rows need to account for rowspans; maybe group @ outermost level
			// - create any missing row entities and delete extras
			//   - maybe use 'key' concept from react to reduce rerendering due to reordering
			// - ensure rows are in correct order in table
			//   - note that rowspan'd cells will need to be kept on the top-most row of the block
			// - ensure data in rows is up to date

			this.data.forEach((datum) => {
				const rows = buildRows(this.columnData, datum);
				rows.forEach((row) => this.tbody.appendChild(row));
			});
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
