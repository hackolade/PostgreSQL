module.exports = ({ _, templates, assignTemplates, getFunctionArguments, getNamePrefixedWithSchemaName }) => {
	const getFunctionsScript = (schemaName, udfs) => {
		return _.map(udfs, udf => {
			const orReplace = udf.functionOrReplace ? ' OR REPLACE' : '';

			return assignTemplates(templates.createFunction, {
				name: getNamePrefixedWithSchemaName(udf.name, schemaName),
				orReplace: orReplace,
				parameters: getFunctionArguments(udf.functionArguments),
				returnType: udf.functionReturnsSetOf ? `SETOF ${udf.functionReturnType}` : udf.functionReturnType,
				language: udf.functionLanguage,
				properties: getProperties(udf),
				definition: udf.functionBody,
			});
		}).join('\n');
	};

	const getProperties = udf => {
		const wrap = value => (value ? `\t${value}\n` : '');

		return [
			{ key: 'functionWindow', getValue: getWindow },
			{ key: 'functionVolatility', getValue: getVolatility },
			{ key: 'functionLeakProof', getValue: getLeakProof },
			{ key: 'functionNullArgs', getValue: getNullArgs },
			{ key: 'functionSqlSecurity', getValue: getSqlSecurity },
			{ key: 'functionParallel', getValue: getParallel },
			{ key: 'functionExecutionCost', getValue: getExecutionCost },
			{ key: 'functionExecutionRows', getValue: getExecutionRows },
			{ key: 'functionSupportFunction', getValue: getSupportFunction },
			{ key: 'functionConfigurationParameters', getValue: getConfigurationParameters },
		]
			.map(config => wrap(config.getValue(udf[config.key], udf)))
			.filter(Boolean)
			.join('');
	};

	const getWindow = (value, udf) => {
		if (udf.language !== 'c' || !value) {
			return '';
		}

		return 'WINDOW';
	};
	const getVolatility = value => value;
	const getLeakProof = value => {
		if (value) {
			return 'LEAKPROOF';
		}

		return 'NOT LEAKPROOF';
	};
	const getNullArgs = value => value;
	const getSqlSecurity = value => {
		if (value) {
			return `SECURITY ${value}`;
		}
	};
	const getParallel = value => {
		if (value) {
			return `PARALLEL ${value}`;
		}
	};
	const getExecutionCost = value => {
		if (value) {
			return `COST ${value}`;
		}
	};
	const getExecutionRows = (value, udf) => {
		if (!value || !udf.functionReturnsSetOf) {
			return '';
		}

		return `ROWS ${value}`;
	};
	const getSupportFunction = value => {
		if (value) {
			return `SUPPORT ${value}`;
		}
	};
	const getConfigurationParameters = value => {
		if (value) {
			return `SET ${value}`;
		}
	};

	return {
		getFunctionsScript,
	};
};
