define([
	'require',
	'core/EventObject',
	'core/rateUtils',
	'display/documentUtils',
	'display/SplitView',
	'display/TreeTable',
], (
	require,
	EventObject,
	rateUtils,
	docutil,
	SplitView,
	TreeTable
) => {
	'use strict';

	function buildEntryRow(team, entry, enabledFn) {
		const changed = entry.code !== entry.originalCode;
		const enabledToggle = docutil.make('input', {
			type: 'checkbox',
			title: 'Enable / Disable entry',
		});
		if(entry.enabled) {
			enabledToggle.setAttribute('checked', 'checked');
		}
		enabledToggle.addEventListener('click', (event) => {
			event.stopPropagation();
		});
		enabledToggle.addEventListener('change', (event) => {
			enabledFn(event.target.checked);
		});
		return {
			key: team.id + '-' + entry.id,
			className: changed ? 'changed' : '',
			label: {
				value: entry.title,
				title: entry.title + (changed ? ' (changed)' : ''),
			},
			userID: entry.userID,
			answerID: entry.answerID,
			enabled: enabledToggle,
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
			this.entryHistories = new Map();

			this._triggerChange = this._triggerChange.bind(this);
			this._triggerChangeDebounced = rateUtils.debounce(this._triggerChange, 500);
			this.addTeam = this.addTeam.bind(this);
			this.addEntry = this.addEntry.bind(this);

			const columns = [
				{title: 'Entry', attribute: 'label'},
				...extraColumns,
			];
			if(this.allowTeamModification) {
				this.enableAll = docutil.make('input', {
					type: 'checkbox',
					title: 'Enable / Disable All',
				});
				this.enableAll.addEventListener('change', (event) => {
					this._changeEnableAll(event.target.checked);
				});
				this.enableAll.checked = false;
				this.enableAll.indeterminate = true;
				columns.push({
					title: this.enableAll,
					attribute: 'enabled',
					className: 'enabled-opt',
				});
			}

			this._buildEditor({className, columns});
		}

		_buildEditor({className, columns}) {
			this.titleEditor = docutil.make('input', {'type': 'text'});
			this.pauseToggle = docutil.make('input', {'type': 'checkbox'});
			this.codeEditor = docutil.make('textarea');
			this.tree = new TreeTable({className: 'team-table', columns});

			this.titleEditor.addEventListener('change', this._triggerChange);
			this.titleEditor.addEventListener('input', this._triggerChangeDebounced);
			this.pauseToggle.addEventListener('change', this._triggerChange);
			this.codeEditor.addEventListener('change', this._triggerChange);
			this.codeEditor.addEventListener('input', this._triggerChangeDebounced);

			this.entryOptions = docutil.make('span', {}, [
				docutil.make('label', {}, ['Title ', this.titleEditor]),
				docutil.make('label', {}, [this.pauseToggle, ' pause on error']),
			]);

			this.optionsBar = docutil.make('div', {'class': 'options-bar'}, [this.entryOptions]);
			this.infoContent = docutil.text();
			this.consoleContent = docutil.text();
			this.infoBox = docutil.make('div', {'class': 'info-box'}, [this.infoContent]);
			this.consoleBox = docutil.make('div', {'class': 'console-box'}, [this.consoleContent]);

			this.entryHold = new SplitView([
				new SplitView([
					docutil.make('div', {}, [this.codeEditor]),
					{element: this.consoleBox, fraction: 0.2},
				], {direction: SplitView.VERTICAL}).dom(),
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
			], {direction: SplitView.HORIZONTAL, className});

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
				const oldEditor = this.codeEditor;
				const code = oldEditor.value;
				this.codeEditor = new CodeMirror((newEditor) => {
					oldEditor.parentNode.replaceChild(newEditor, oldEditor);
				}, {
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
				this.setCode(code, null);
				this.codeEditor.on('blur', this._triggerChange);
				this.codeEditor.on('change', this._triggerChangeDebounced);
			});
		}

		getSelectedEntry() {
			const selectedItem = this.tree.getSelectedItem();
			return (selectedItem ? selectedItem.datum.baseEntry : null);
		}

		_updateEnableAll() {
			if(!this.enableAll) {
				return;
			}
			let anyEnabled = false;
			let anyDisabled = false;
			this.teams.forEach((team) => team.entries.forEach((entry) => {
				if(entry.enabled) {
					anyEnabled = true;
				} else {
					anyDisabled = true;
				}
			}));
			if(anyEnabled) {
				this.enableAll.checked = true;
				this.enableAll.indeterminate = anyDisabled;
			} else {
				this.enableAll.checked = false;
				this.enableAll.indeterminate = false;
			}
		}

		_changeEnableAll(enabled) {
			if(!this.teams) {
				return;
			}
			this.teams.forEach((team) => team.entries.forEach((entry) => {
				if(entry.enabled !== enabled) {
					this.trigger('change', [{
						entry,
						enabled,
					}]);
				}
			}));
			this._updateEnableAll();
		}

		_triggerEnabledChange(entry, enabled) {
			if(entry.enabled !== enabled) {
				this.trigger('change', [{
					entry,
					enabled,
				}]);
			}
		}

		_triggerChange() {
			this._triggerChangeDebounced.abort();
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
			const entry = selectedItem.datum.baseEntry;
			if(this.codeEditor.getDoc && entry && entry.id) {
				this.entryHistories.set(entry.id, {
					code,
					history: this.codeEditor.getDoc().getHistory(),
				});
			}
			if(
				entry.title !== title ||
				entry.code !== code ||
				entry.pauseOnError !== this.pauseToggle.checked
			) {
				this.trigger('change', [{
					entry,
					title,
					code,
					pauseOnError: this.pauseToggle.checked,
				}]);
			}
		}

		rebuild() {
			let treeData = [];
			if(this.showTeams) {
				treeData = this.teams.map((team) => {
					const nested = team.entries.map((entry) =>
						buildEntryRow(team, entry, this._triggerEnabledChange.bind(this, entry)));
					if(this.allowTeamModification) {
						const button = docutil.make(
							'button',
							{'data-team': team.id},
							['+ Add Entry']
						);
						button.addEventListener('click', this.addEntry);
						nested.push({label: button, selectable: false});
					}
					return {
						key: team.id,
						className: 'team',
						label: 'Team ' + team.id,
						enabled: null,
						nested,
						baseTeam: team,
					};
				});
				if(this.allowTeamModification) {
					const button = docutil.make(
						'button',
						{},
						['+ Add Team']
					);
					button.addEventListener('click', this.addTeam);
					treeData.push({label: button, selectable: false});
				}
			} else {
				this.teams.forEach((team) => team.entries.forEach((entry) => treeData.push(
					buildEntryRow(team, entry, this._triggerEnabledChange.bind(this, entry))
				)));
				if(this.allowTeamModification) {
					const button = docutil.make(
						'button',
						{'data-team': ''},
						['+ Add Entry']
					);
					button.addEventListener('click', this.addEntry);
					treeData.push({label: button, selectable: false});
				}
			}
			this._updateEnableAll();
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
				answerID: 'new',
				userName: 'Me',
				userID: 'me',
				link: '',
				title: 'New Entry',
				code: this.defaultCode,
				enabled: true,
				pauseOnError: false,
			};
			team.entries.push(entry);
			this.rebuild();
			const currentItem = this.tree.getItemWhere((item) => (item.datum.baseEntry === entry));
			if(currentItem) {
				this.tree.select(currentItem.datum);
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
				item.datum.console = entryStatus.console;
			}));
			this._updateInfo();
		}

		_update() {
			const selectedItem = this.tree.getSelectedItem();
			if(selectedItem && selectedItem.datum.baseEntry) {
				const entry = selectedItem.datum.baseEntry;
				docutil.updateStyle(this.emptyState, {'display': 'none'});
				docutil.updateStyle(this.entryHold.dom(), {'display': 'block'});
				docutil.updateStyle(this.entryOptions, {'display': 'inline'});
				this.setCode(entry.code, entry.id);
				this.titleEditor.value = entry.title;
				this.pauseToggle.checked = entry.pauseOnError;
				this._updateInfo();
			} else {
				docutil.updateStyle(this.emptyState, {'display': 'block'});
				docutil.updateStyle(this.entryHold.dom(), {'display': 'none'});
				docutil.updateStyle(this.entryOptions, {'display': 'none'});
			}
		}

		_updateInfo() {
			const selectedItem = this.tree.getSelectedItem();
			if(!selectedItem) {
				docutil.updateText(this.infoContent, '');
				docutil.updateText(this.consoleContent, '');
			} else {
				const datum = selectedItem.datum;
				let info = '';
				if(datum.disqualified) {
					info += 'Disqualified: ';
				} else if(datum.error) {
					info += 'Warning: ';
				}
				if(datum.error) {
					info += datum.error;
				}
				let logs = '';
				if(datum.console) {
					logs = (datum.console
						.map((ln) => (ln.type + ': ' + ln.value))
						.join('\n')
					);
				}
				docutil.updateText(this.infoContent, info);
				docutil.updateText(this.consoleContent, logs);
			}
		}

		setCode(code, entryID) {
			if(this.codeEditor.getDoc) {
				const doc = this.codeEditor.getDoc();
				doc.setValue(code);
				const lastKnown = this.entryHistories.get(entryID);
				if(lastKnown && lastKnown.code === code) {
					doc.setHistory(lastKnown.history);
				} else {
					doc.clearHistory();
				}
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

				// Should not be required, but CodeMirror seems to have a bug
				// if the editor was not already visible and there are less than
				// 10 lines of code, the gutter has a width of 0. This works
				// around that.
				this.codeEditor.refresh();
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
	};
});
