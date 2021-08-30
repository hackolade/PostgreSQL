
const parseFunctionQuery = (query) => {
	const parseRegexp = /create(?<orReplace>\s+or\s+replace)?(?<definer>\s+definer\s*=[\s\S]+?)?(?<aggregate>\s+aggregate)?\s+function(?<ifNotExists>\s+if not exists)?\s+\`(?<funcName>[\s\S]+?)\`\s*\((?<funcParameters>[\s\S]*?)\)\s+returns\s+(?<returnType>[a-z0-9\(\)]+)(?<characteristics>(\s*language\s+sql)?(\s*(not)?\s+deterministic)?(\s*contains\s+(sql|no\s+sql|reads\s+sql\s+data|modifies\s+sql\s+data))?(\s*sql\s+security\s+(definer|invoker))?(\s*comment\s+\'[\s\S]+?\')?(\s*charset\s+[\S\s]+?)?(\s*COLLATE\s+[\S\s]+?)?)?\s+(?<funcBody>(begin|return)([\s\S]+))/i;

	if (!parseRegexp.test(query)) {
		return {};
	}

	const result = String(query).match(parseRegexp);
	const {
		orReplace,
		definer,
		aggregate,
		ifNotExists,
		funcName,
		funcParameters,
		returnType,
		characteristics,
		funcBody,
	} = result.groups;

	return {
		orReplace: Boolean(orReplace),
		definer: definer,
		isAggregate: Boolean(aggregate),
		ifNotExists: Boolean(ifNotExists),
		name: funcName,
		parameters: funcParameters,
		returnType: returnType,
		characteristics: characteristics || '',
		body: funcBody || '',
	};
};

const getLanguage = (characteristics) => {
	return /language sql/i.test(characteristics) ? 'SQL' : '';
}

const getDeterministic = (characteristics) => {
	if (/not deterministic/i.test(characteristics)) {
		return 'NOT DETERMINISTIC';
	} else if (/deterministic/i.test(characteristics)) {
		return 'DETERMINISTIC';
	} else {
		return '';
	}
};

const getContains = (characteristics) => {
	if (/contains\s+sql/i.test(characteristics)) {
		return 'SQL';
	} else if (/contains\s+no\s+sql/i.test(characteristics)) {
		return 'NO SQL';
	} else if (/contains\s+reads\s+sql\s+data/i.test(characteristics)) {
		return 'READS SQL DATA';
	} else if (/contains\s+modifies\s+sql\s+data/i.test(characteristics)) {
		return 'MODIFIES SQL DATA';
	} else {
		return '';
	}
};

const getDefiner = (characteristics) => {
	if (/SQL\s+SECURITY\s+DEFINER/i.test(characteristics)) {
		return 'DEFINER';
	} else if (/SQL\s+SECURITY\s+INVOKER/i.test(characteristics)) {
		return 'INVOKER';
	} else {
		return '';
	}
};

const getComment = (characteristics) => {
	const commentRegexp = /comment\s\'([\s\S]+?)\'/i;

	if (!commentRegexp.test(characteristics)) {
		return '';
	}

	const result = characteristics.match(commentRegexp);

	return result[1] || '';
}

module.exports = {
	parseFunctionQuery,
	getLanguage,
	getDeterministic,
	getContains,
	getDefiner,
	getComment,
};
