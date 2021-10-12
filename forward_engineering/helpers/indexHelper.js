module.exports = ({ _, wrapInQuotes, checkAllKeysDeactivated, getColumnsList }) => {
    const mapIndexKey = ({ name, sortOrder, nullsOrder, collation, opclass }) => {
        const nullsOrderStr = nullsOrder ? ` ${nullsOrder}` : '';
        const collationStr = collation ? ` COLLATE "${collation}"` : '';
        const opclassStr = opclass ? ` ${opclass}` : '';

        return `${wrapInQuotes(name)}${collationStr}${opclassStr} ${sortOrder}${nullsOrderStr}`;
    };

    const getIndexKeys = (columns = [], isParentActivated) => {
        const isAllColumnsDeactivated = checkAllKeysDeactivated(columns);

        return getColumnsList(columns, isAllColumnsDeactivated, isParentActivated, mapIndexKey);
    };

    const getIndexOptions = (index, isParentActivated) => {
        const includeKeys = getColumnsList(
            index.include || [],
            checkAllKeysDeactivated(index.include || []),
            isParentActivated
        );
        const include = index.include?.length ? ` INCLUDE ${_.trim(includeKeys)}` : '';
        const withOptionsString = getWithOptions(index);
        const withOptions = withOptionsString ? ` WITH (\n\t${withOptionsString})` : '';
        const tableSpace = index.index_tablespace_name ? ` TABLESPACE ${index.index_tablespace_name}` : '';
        const whereExpression = index.where ? ` WHERE ${index.where}` : '';

        return _.compact([' ', include, withOptions, tableSpace, whereExpression]).join('\n');
    };

    const INDEX_STORAGE_OPTIONS_BY_METHOD = {
        btree: {
            index_fillfactor: 'fillfactor',
            deduplicate_items: 'deduplicate_items',
        },
        hash: {
            index_fillfactor: 'fillfactor',
        },
        spgist: {
            index_fillfactor: 'fillfactor',
        },
        gist: {
            index_fillfactor: 'fillfactor',
            index_buffering: 'buffering',
        },
        gin: {
            fastupdate: 'fastupdate',
            gin_pending_list_limit: 'gin_pending_list_limit',
        },
        brin: {
            pages_per_range: 'pages_per_range',
            autosummarize: 'autosummarize',
        },
    };

    const getWithOptions = index => {
        const config = INDEX_STORAGE_OPTIONS_BY_METHOD[index.index_method];

        return _.chain(config)
            .toPairs()
            .map(([keyInModel, postgresKey]) => {
                const value = index.index_storage_parameter[keyInModel];

                if (_.isNil(value) || value === '') {
                    return;
                }

                return `${postgresKey}=${getValue(value)}`;
            })
            .compact()
            .join(',\n\t')
            .value();
    };

    const getValue = value => {
        if (_.isBoolean(value)) {
            return value ? 'ON' : 'OFF';
        }

        return value;
    };

    return {
        getIndexKeys,
        getIndexOptions,
    };
};
