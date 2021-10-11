module.exports = ({ _, divideIntoActivatedAndDeactivated, commentIfDeactivated }) => {
    const getFunctionArguments = functionArguments => {
        return _.map(functionArguments, arg => {
            const defaultExpression = arg.defaultExpression ? `DEFAULT ${arg.defaultExpression}` : '';

            return _.trim(`${arg.argumentMode} ${arg.argumentName || ''} ${arg.argumentType} ${defaultExpression}`);
        }).join(', ');
    };

    const getNamePrefixedWithSchemaName = (name, schemaName) => {
        if (schemaName) {
            return `${wrapInQuotes(schemaName)}.${wrapInQuotes(name)}`;
        }

        return wrapInQuotes(name);
    };

    const wrapInQuotes = name => (/\s/.test(name) ? `"${name}"` : name);

    const columnMapToString = ({ name }) => wrapInQuotes(name);

    const getColumnsList = (columns, isAllColumnsDeactivated, isParentActivated) => {
        const dividedColumns = divideIntoActivatedAndDeactivated(columns, columnMapToString);
        const deactivatedColumnsAsString = dividedColumns?.deactivatedItems?.length
            ? commentIfDeactivated(dividedColumns.deactivatedItems.join(', '), {
                  isActivated: false,
                  isPartOfLine: true,
              })
            : '';

        return !isAllColumnsDeactivated && isParentActivated
            ? ' (' + dividedColumns.activatedItems.join(', ') + deactivatedColumnsAsString + ')'
            : ' (' + columns.map(columnMapToString).join(', ') + ')';
    };

    return {
        getFunctionArguments,
        getNamePrefixedWithSchemaName,
        wrapInQuotes,
        getColumnsList,
    };
};
