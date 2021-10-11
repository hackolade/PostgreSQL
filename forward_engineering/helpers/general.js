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

    const getColumnsList = (columns, isAllColumnsDeactivated, isParentActivated, mapColumn = columnMapToString) => {
        const dividedColumns = divideIntoActivatedAndDeactivated(columns, mapColumn);
        const deactivatedColumnsAsString = dividedColumns?.deactivatedItems?.length
            ? commentIfDeactivated(dividedColumns.deactivatedItems.join(', '), {
                  isActivated: false,
                  isPartOfLine: true,
              })
            : '';

        return !isAllColumnsDeactivated && isParentActivated
            ? ' (' + dividedColumns.activatedItems.join(', ') + deactivatedColumnsAsString + ')'
            : ' (' + columns.map(mapColumn).join(', ') + ')';
    };

    const getKeyWithAlias = key => {
        if (!key) {
            return '';
        }

        if (key.alias) {
            return `${wrapInQuotes(key.name)} as ${wrapInQuotes(key.alias)}`;
        } else {
            return wrapInQuotes(key.name);
        }
    };

    const getViewData = keys => {
        if (!Array.isArray(keys)) {
            return { tables: [], columns: [] };
        }

        return keys.reduce(
            (result, key) => {
                if (!key.tableName) {
                    result.columns.push(getKeyWithAlias(key));

                    return result;
                }

                let tableName = wrapInQuotes(key.tableName);

                if (!result.tables.includes(tableName)) {
                    result.tables.push(tableName);
                }

                result.columns.push({
                    statement: `${tableName}.${getKeyWithAlias(key)}`,
                    isActivated: key.isActivated,
                });

                return result;
            },
            {
                tables: [],
                columns: [],
            }
        );
    };

    return {
        getFunctionArguments,
        getNamePrefixedWithSchemaName,
        wrapInQuotes,
        getColumnsList,
        getViewData,
    };
};
