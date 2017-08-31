define([
	'core/EventObject',
	'display/document_utils',
	'display/SplitView',
	'display/TreeTable',
], (
	EventObject,
	docutil,
	SplitView,
	TreeTable,
) => {
	'use strict';

	// TODO:
	// * Allow drag+drop to reorder teams & entries, and switch entry teams
	// * Add change handler to 'enabled' chekboxes & reordering to update managedTeams
	// * Persist in local storage (maybe use answer_id as unique refs)

	function buildEntryRow(team, entry) {
		const changed = entry.code !== entry.originalCode;
		return {
			key: team.id + '-' + entry.id,
			className: changed ? 'changed' : '',
			label: {
				value: entry.title,
				title: entry.title + (changed ? ' (changed)' : ''),
			},
			user_id: entry.user_id,
			answer_id: entry.answer_id,
			enabled: docutil.make('input', {type: 'checkbox', checked: 'checked', disabled: 'disabled'}),
			baseEntry: entry,
		};
	}

	return class EntryManager extends EventObject {
		constructor({
			className = '',
			extraColumns = [],
			showTeams = true,
			allowTeamModification = true,
			defaultCode = ''
		} = {}) {
			super();

			this.teams = null;
			this.teamStatuses = null;
			this.defaultCode = defaultCode;
			this.showTeams = showTeams;
			this.allowTeamModification = allowTeamModification;

			this._triggerChange = this._triggerChange.bind(this);
			this.addTeam = this.addTeam.bind(this);
			this.addEntry = this.addEntry.bind(this);

			this.titleEditor = docutil.make('input', {'type': 'text'});
			this.pauseToggle = docutil.make('input', {'type': 'checkbox'});
			this.codeEditor = docutil.make('textarea');
			const columns = [
				{title: 'Entry', attribute: 'label'},
				...extraColumns
			];
			if(allowTeamModification) {
				columns.push({title: '', attribute: 'enabled', className: 'enabled-opt'});
			}
			this.tree = new TreeTable({
				className: 'team-table',
				columns,
			});

			this.titleEditor.addEventListener('change', this._triggerChange);
			this.pauseToggle.addEventListener('change', this._triggerChange);
			this.codeEditor.addEventListener('change', this._triggerChange);

			this.entryOptions = docutil.make('span', {}, [
				docutil.make('label', {}, ['Title ', this.titleEditor]),
				docutil.make('label', {}, [this.pauseToggle, ' pause on error']),
			]);

			this.optionsBar = docutil.make('div', {'class': 'options-bar'}, [this.entryOptions]);
			this.infoBoxContent = docutil.text();
			this.infoBox = docutil.make('div', {'class': 'info-box'}, [this.infoBoxContent]);

			this.entryHold = new SplitView([
				docutil.make('div', {}, [this.codeEditor]),
				{element: this.infoBox, fraction: 0.3},
			], {direction: SplitView.HORIZONTAL, className: 'code-editor'});

			docutil.updateStyle(this.entryOptions, {'display': 'none'});
			docutil.updateStyle(this.entryHold.dom(), {'display': 'none'});

			this.emptyState = docutil.make('div', {'class': 'entry-editor-empty'});
			this.manager = new SplitView([
				{
					element: docutil.make('div', {'class': 'team-table-hold'}, [this.tree.dom()]),
					fraction: 0.3,
				},
				docutil.make('div', {'class': 'entry-editor'}, [
					this.optionsBar,
					this.entryHold.dom(),
					this.emptyState,
				]),
			], {direction: SplitView.HORIZONTAL, className}),

			this.tree.addEventListener('select', () => {
				this._update();
				this.trigger('select', [this.getSelectedEntry()]);
			});

			require([
				'codemirror/lib/codemirror',
				'codemirror/mode/javascript/javascript',
				'codemirror/addon/comment/comment',
				'codemirror/addon/dialog/dialog',
				'codemirror/addon/dialog/dialog.css',
				'codemirror/addon/search/search',
				'codemirror/addon/search/searchcursor',
				'codemirror/addon/search/jump-to-line',
				'codemirror/addon/edit/matchbrackets',
				'codemirror/addon/edit/trailingspace',
				'codemirror/lib/codemirror.css',
			], (CodeMirror) => {
				const code = this.codeEditor.value;
				// TODO: does this need to be fromTextArea?
				this.codeEditor = CodeMirror.fromTextArea(this.codeEditor, {
					mode: {
						name: 'javascript',
					},
					lineNumbers: true,
					matchBrackets: true,
					showTrailingSpace: true,
					extraKeys: {
						'Tab': (cm) => cm.execCommand('indentMore'),
						'Shift-Tab': (cm) => cm.execCommand('indentLess'),
						'Cmd-/': (cm) => cm.toggleComment({padding: ''}),
						'Ctrl-/': (cm) => cm.toggleComment({padding: ''}),
					},
				});
				this.setCode(code);
				this.codeEditor.on('blur', this._triggerChange);
			});
		}

		getSelectedEntry() {
			const selectedItem = this.tree.getSelectedItem();
			return (selectedItem ? selectedItem.datum.baseEntry : null);
		}

		_triggerChange() {
			const selectedItem = this.tree.getSelectedItem();
			if(!selectedItem) {
				return;
			}
			const title = this.titleEditor.value;
			let code = null;
			if(this.codeEditor.getDoc) {
				code = this.codeEditor.getDoc().getValue();
			} else {
				code = this.codeEditor.value;
			}
			this.trigger('change', [{
				entry: selectedItem.datum.baseEntry,
				title,
				code,
				pauseOnError: this.pauseToggle.checked,
			}]);
		}

		rebuild() {
			// TODO: this rebuild prevents clicking directly on an item in the tree
			// (the item is rebuilt on text area blur so the click never happens)
			// Should update TableTree to only re-render diff
			let treeData = [];
			if(this.showTeams) {
				treeData = this.teams.map((team) => {
					const nested = team.entries.map((entry) => buildEntryRow(team, entry));
					if(this.allowTeamModification) {
						const button = docutil.make('button', {'data-team': team.id}, ['+ Add Entry']);
						button.addEventListener('click', this.addEntry);
						nested.push({label: button, selectable: false});
					}
					return {
						key: team.id,
						className: 'team',
						label: 'Team ' + team.id,
						enabled: docutil.make('input', {type: 'checkbox', checked: 'checked', disabled: 'disabled'}),
						nested,
						baseTeam: team,
					};
				});
				if(this.allowTeamModification) {
					const button = docutil.make('button', {}, ['+ Add Team']);
					button.addEventListener('click', this.addTeam);
					treeData.push({label: button, selectable: false});
				}
			} else {
				this.teams.forEach((team) => team.entries.forEach((entry) => {
					team.entries.map((entry) => {
						treeData.push(buildEntryRow(team, entry));
					});
				}));
				if(this.allowTeamModification) {
					const button = docutil.make('button', {'data-team': ''}, ['+ Add Entry']);
					button.addEventListener('click', this.addEntry);
					treeData.push({label: button, selectable: false});
				}
			}
			this.tree.setData(treeData);
			this.setTeamStatuses(this.teamStatuses);
		}

		rerender() {
			this._update();
		}

		refresh() {
			if(this.codeEditor.refresh) {
				this.codeEditor.refresh();
			}
		}

		setTeams(teams) {
			this.teams = teams;
			this.rebuild();
		}

		addTeam() {
			const id = 'T' + this.teams.length;
			this.teams.push({id, entries: []});
			this.rebuild();
			return id;
		}

		addEntry(teamID) {
			if(teamID.target) {
				teamID = teamID.target.getAttribute('data-team');
			}
			let team = null;
			if(teamID) {
				team = this.teams.find((curTeam) => (curTeam.id === teamID));
			} else {
				teamID = 'T' + this.teams.length;
				team = {id: teamID, entries: []};
				this.teams.push(team);
			}
			if(!team) {
				return null;
			}
			const entry = {
				id: 'N' + Date.now(),
				answer_id: 'new',
				user_name: 'Me',
				user_id: 'me',
				link: '',
				title: 'New Entry',
				code: this.defaultCode,
			};
			team.entries.push(entry);
			this.rebuild();
			const item = this.tree.getItemWhere((item) => (item.datum.baseEntry === entry));
			if(item) {
				this.tree.select(item.datum);
				// Fix strange codemirror behaviour where gutter is not shown if
				// this makes it appear (should be identical to other selection types?)
				this.refresh();
			}
		}

		setTeamStatuses(teamStatuses) {
			this.teamStatuses = teamStatuses;
			if(!this.teamStatuses) {
				return;
			}
			this.teamStatuses.forEach((teamStatus) => teamStatus.entries.forEach((entryStatus) => {
				const item = this.tree.getItemByKey(teamStatus.id + '-' + entryStatus.id);
				if(!item) {
					return;
				}
				if(entryStatus.disqualified) {
					docutil.addClass(item.row, 'disqualified');
					docutil.removeClass(item.row, 'warning');
				} else if(entryStatus.error) {
					docutil.removeClass(item.row, 'disqualified');
					docutil.addClass(item.row, 'warning');
				} else {
					docutil.removeClass(item.row, 'disqualified');
					docutil.removeClass(item.row, 'warning');
				}
				item.datum.disqualified = entryStatus.disqualified;
				item.datum.error = entryStatus.error;
				item.datum.errorInput = entryStatus.errorInput;
				item.datum.errorOutput = entryStatus.errorOutput;
			}));
			this._updateInfoBox();
		}

		_update() {
			const selectedItem = this.tree.getSelectedItem();
			if(selectedItem && selectedItem.datum.baseEntry) {
				const entry = selectedItem.datum.baseEntry;
				docutil.updateStyle(this.emptyState, {'display': 'none'});
				docutil.updateStyle(this.entryHold.dom(), {'display': 'block'});
				docutil.updateStyle(this.entryOptions, {'display': 'inline'});
				this.setCode(entry.code);
				this.titleEditor.value = entry.title;
				this.pauseToggle.checked = entry.pauseOnError;
				this._updateInfoBox();
			} else {
				docutil.updateStyle(this.emptyState, {'display': 'block'});
				docutil.updateStyle(this.entryHold.dom(), {'display': 'none'});
				docutil.updateStyle(this.entryOptions, {'display': 'none'});
			}
		}

		_updateInfoBox() {
			const selectedItem = this.tree.getSelectedItem();
			if(!selectedItem) {
				docutil.updateText(this.infoBoxContent, '');
			} else {
				let content = '';
				if(selectedItem.datum.disqualified) {
					content += 'Disqualified: ';
				} else if(selectedItem.datum.error) {
					content += 'Warning: ';
				}
				if(selectedItem.datum.error) {
					content += selectedItem.datum.error;
				}
				docutil.updateText(this.infoBoxContent, content);
			}
		}

		setCode(code) {
			if(this.codeEditor.getDoc) {
				this.codeEditor.getDoc().setValue(code);
				let tabs = false;
				let indent = 4;
				if((code.match(/\n  [^ ]/g) || []).length) {
					indent = 2;
				} else if((code.match(/\n\t/g) || []).length > (code.match(/\n  /g) || []).length) {
					tabs = true;
				}

				this.codeEditor.setOption('indentUnit', indent);
				this.codeEditor.setOption('indentWithTabs', tabs);
				this.codeEditor.setOption('mode', {
					name: 'javascript',
					statementIndent: indent,
				});
			} else {
				this.codeEditor.value = code;
			}
		}

		optionsDOM() {
			return this.optionsBar;
		}

		emptyStateDOM() {
			return this.emptyState;
		}

		dom() {
			return this.manager.dom();
		}
	}
});
