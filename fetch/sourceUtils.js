define(() => {
	'use strict';

	function findCandidates(code, varExpr) {
		if(varExpr.indexOf('*') === -1) {
			return new Set([varExpr]);
		}
		const regex = new RegExp(varExpr.replace(/\*/g, '[a-zA-Z0-9_]*'), 'g');
		const found = new Set();
		while(true) {
			const p = regex.exec(code);
			if(!p) {
				break;
			}
			found.add(p[0]);
		}
		return found;
	}

	function buildFunctionFinder(code, pattern) {
		const vars = findCandidates(code, pattern);
		if(vars.size === 0) {
			return 'null';
		}
		if(vars.size === 1) {
			return vars.values().next().value;
		}
		return (
			'((() => {' +
			vars.map((v) => 'try {return ' + v + ';} catch(e) {}').join('') +
			'return null;' +
			'})())'
		);
	}

	function buildMultiFunctionFinder(code, returning) {
		let parts = '';
		for(let k of Object.keys(returning)) {
			parts += JSON.stringify(k) + ':';
			parts += buildFunctionFinder(code, returning[k]);
			parts += ',';
		}
		return 'return {' + parts + '};';
	}

	return {
		buildFunctionFinder,
		buildMultiFunctionFinder,
	};
});
