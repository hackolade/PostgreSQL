module.exports = ({ _, templates, assignTemplates, getFunctionArguments, getNamePrefixedWithSchemaName }) => {
    const getProceduresScript = (schemaName, procedures) => {
        return _.map(procedures, procedure => {
            const orReplace = procedure.orReplace ? ' OR REPLACE' : '';

            return assignTemplates(templates.createProcedure, {
                name: getNamePrefixedWithSchemaName(procedure.name, schemaName),
                orReplace: orReplace,
                parameters: getFunctionArguments(procedure.inputArgs),
                language: procedure.language,
                body: procedure.body,
            });
        }).join('\n');
    };
    return {
        getProceduresScript,
    };
};
