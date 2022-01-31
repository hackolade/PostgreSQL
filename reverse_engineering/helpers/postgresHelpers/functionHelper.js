let _ = null;

const setDependencies = app => {
	_ = app.require('lodash');
};

const mapFunctionArgs = args => {
	return _.map(args, arg => ({
		argumentMode: arg.parameter_mode,
		argumentName: arg.parameter_name,
		argumentType: getArgType(arg.data_type, arg.udt_name),
		defaultExpression: arg.parameter_default,
	}));
};

const getArgType = (argType, argUdt) => {
	if (argType === 'USER-DEFINED') {
		return argUdt;
	}

	if (argType === 'ARRAY') {
		return argUdt.slice(1) + '[]';
	}

	return argType;
};

const getVolatility = volatility => {
	switch (volatility) {
		case 'i':
			return 'IMMUTABLE';
		case 's':
			return 'STABLE';
		case 'v':
		default:
			return 'VOLATILE';
	}
};

const getParallel = parallel => {
	switch (parallel) {
		case 's':
			return 'SAFE';
		case 'r':
			return 'RESTICTED';
		case 'u':
			return 'UNSAFE';
		default:
			return '';
	}
};

const getNullArgs = strict => {
	if (strict) {
		return 'STRICT';
	}

	return 'CALLED ON NULL INPUT';
};

const mapFunctionData = (functionData, functionArgs, additionalData) => {
	return {
		name: functionData.name,
		functionDescription: additionalData?.description,
		functionArguments: mapFunctionArgs(functionArgs),
		functionReturnsSetOf: additionalData?.returns_set,
		functionReturnType: functionData.return_data_type,
		functionLanguage: _.toLower(functionData.external_language),
		functionBody: functionData.routine_definition ?? additionalData?.body,
		functionWindow: additionalData?.kind === 'w',
		functionVolatility: getVolatility(additionalData?.volatility),
		functionLeakProof: additionalData?.leak_proof,
		functionNullArgs: getNullArgs(additionalData?.strict),
		functionSqlSecurity: functionData.security_type,
		functionParallel: getParallel(functionData.parallel),
		functionExecutionCost: functionData.estimated_cost,
		functionExecutionRows: functionData.estimated_rows,
	};
};

const mapProcedureData = (functionData, functionArgs, additionalData) => {
	return {
		name: functionData.name,
		description: additionalData?.description,
		language: _.toLower(functionData.external_language),
		inputArgs: mapFunctionArgs(functionArgs),
		body: functionData.routine_definition,
	};
};

module.exports = {
	setDependencies,
	mapFunctionData,
	mapProcedureData,
};
