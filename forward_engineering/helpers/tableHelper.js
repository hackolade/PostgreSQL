module.exports = ({ _, getColumnsList, checkAllKeysDeactivated }) => {
    const getTableTemporaryValue = (temporary, unlogged) => {
        if (temporary) {
            return ' TEMPORARY';
        }

        if (unlogged) {
            return ' UNLOGGED';
        }

        return '';
    };

    const getTableOptions = tableData => {
        const wrap = value => (value ? `${value}\n` : '');

        const statements = [
            { key: 'inherits', getValue: getBasicValue('INHERITS') },
            { key: 'partitioning', getValue: getPartitioning },
            { key: 'usingMethod', getValue: getBasicValue('USING') },
            { key: 'on_commit', getValue: getOnCommit },
            { key: 'table_tablespace_name', getValue: getBasicValue('TABLESPACE') },
            { key: 'storage_parameter', getValue: getStorageParameters },
            { key: 'selectStatement', getValue: getBasicValue('AS') },
        ]
            .map(config => wrap(config.getValue(tableData[config.key], tableData)))
            .filter(Boolean)
            .join('');

        return _.trim(statements) ? ` ${_.trim(statements)}` : '';
    };

    const getPartitioning = (value, { isActivated }) => {
        if (value && value.partitionMethod) {
            const expression =
                value.partitionBy === 'keys'
                    ? getPartitionKeys(value, isActivated)
                    : ` (${value.partitioning_expression})`;

            return `PARTITION BY ${value.partitionMethod}${expression}`;
        }
    };

    const getPartitionKeys = (value, isParentActivated) => {
        const isAllColumnsDeactivated = checkAllKeysDeactivated(value.compositePartitionKey);

        return getColumnsList(value.compositePartitionKey, isAllColumnsDeactivated, isParentActivated);
    };

    const getOnCommit = (value, table) => {
        if (value && table.temporary) {
            return `ON COMMIT ${value}`;
        }
    };

    const getBasicValue = prefix => value => {
        if (value) {
            return `${prefix} ${value}`;
        }
    };

    const toastKeys = [
        'toast_autovacuum_enabled',
        'toast_tuple_target',
        'toast_vacuum_index_cleanup',
        'toast_vacuum_truncate',
        'toast_autovacuum_vacuum_threshold',
        'toast_autovacuum_vacuum_scale_factor',
        'toast_autovacuum_vacuum_insert_threshold',
        'toast_autovacuum_vacuum_insert_scale_factor',
        'toast_autovacuum_vacuum_cost_delay',
        'toast_autovacuum_vacuum_cost_limit',
        'toast_autovacuum_freeze_min_age',
        'toast_autovacuum_freeze_max_age',
        'toast_autovacuum_freeze_table_age',
        'toast_autovacuum_multixact_freeze_min_age',
        'toast_autovacuum_multixact_freeze_max_age',
        'toast_autovacuum_multixact_freeze_table_age',
        'toast_log_autovacuum_min_duration',
    ];

    const getStorageParameters = value => {
        if (_.isEmpty(value)) {
            return '';
        }

        const keysToSkip = ['autovacuum', 'toast', 'id'];

        return _.chain(value)
            .thru(value => (value.autovacuum_enabled ? value : _.omit(value, 'autovacuum')))
            .thru(value => (value.toast_autovacuum_enabled ? value : _.omit(value, 'toast')))
            .toPairs()
            .flatMap(([key, value]) => {
                if (key === 'autovacuum' || key === 'toast') {
                    return _.toPairs(value);
                }

                return [[key, value]];
            })
            .reject(([key]) => _.includes(keysToSkip, key))
            .map(([key, value]) => {
                if (!value && value !== 0) {
                    return;
                }

                if (_.includes(toastKeys, key)) {
                    return `toast.${key.slice('toast_'.length)}=${value}`;
                }

                return `${key}=${value}`;
            })
            .compact()
            .join(',\n\t')
            .trim()
            .thru(storageParameters => {
                if (storageParameters) {
                    return `WITH (\n\t${storageParameters}\n)`;
                }
            })
            .value();
    };

    return {
        getTableTemporaryValue,
        getTableOptions,
    };
};
