let _ = null;

const setDependencies = app => {
    _ = app.require('lodash');
};

const mapFunctionArgs = args => {
    return _.map(args, arg => ({
        argumentMode: arg.parameter_mode,
        argumentName: arg.parameter_name,
        argumentType: arg.data_type,
        defaultExpression: arg.parameter_default,
    }));
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
        functionReturnsSetOf: additionalData?.returnsSet,
        functionReturnType: functionData.return_data_type,
        functionLanguage: _.toLower(functionData.external_language),
        functionDefinition: functionData.routine_definition,
        functionWindow: additionalData.kind === 'w',
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
