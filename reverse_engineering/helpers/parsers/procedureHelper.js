
const isCreateOrReplace = (query) => {
	return /^create\s+or\s+replace/i.test((String(query || '')).trim());
};

const getBodyAndParameters = (query) => {
	const regExp = /procedure\s+\`[\s\S]+?\`\s*\((?<parameters>[\S\s]*)\)\s+(?<body>begin[\S\s]+)/i;

	if (!regExp.test(query)) {
		return {
			body: '',
			parameters: '',
		};
	}

	const result = query.match(regExp);
	
	return {
		parameters: (result.groups['parameters'] || '').trim(),
		body: (result.groups['body'] || '').trim(),
	};
};

const findAndReplaceCharacteristics = (query) => {
	const characteristics = {
		language: /language\s+sql/i,
		deterministic: /(not\s+)?deterministic/i,
		contains: /contains\s+(sql|no\s+sql|reads\s+sql\s+data|modifies\s+sql\s+data)/i,
		security: /sql\s+security\s+(definer|invoker)/i,
		comment: /comment\s+\'[\s\S]+?\'/i
	};

	return Object.keys(characteristics).reduce(([query, result], characteristic) => {
		const regExp = characteristics[characteristic];

		if (!regExp.test(query)) {
			return [query, result];
		}

		return [
			query.replace(regExp, ''),
			{
				...result,
				[characteristic]: query.match(regExp).shift(),
			},
		];
	}, [
		query,
		{}
	]);
};

const getDeterministic = (characteristic) => {
	if (!characteristic) {
		return '';
	}

	if ( /not\s+deterministic/i.test(characteristic)) {
		return 'NOT DETERMINISTIC';
	} else {
		return 'DETERMINISTIC';
	}
};

const getContains = (characteristic) => {
	if (!characteristic) {
		return '';
	}

	const data = characteristic.replace(/\s+/g, ' ').replace(/contains\s+/, '');
	
	return data.toUpperCase();
};

const parseProcedure = (query) => {
	const [noCharacteristicsQuery, characteristics] = findAndReplaceCharacteristics(String(query));
	const { body, parameters } = getBodyAndParameters(String(noCharacteristicsQuery));

	return {
		body,
		parameters,
		contains: getContains(characteristics.contains),
		deterministic: getDeterministic(characteristics.deterministic),
		orReplace: isCreateOrReplace(query),
	};
};

module.exports = {
	parseProcedure,
};
