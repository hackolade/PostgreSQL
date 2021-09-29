const { clearEmptyPropertiesInObject } = require('./common');

let _ = null;

const setDependencies = app => {
    _ = app.require('lodash');
};

const prepareStorageParameters = reloptions => {
    if (!reloptions) {
        return null;
    }

    const options = _.fromPairs(_.map(reloptions, splitByEqualitySymbol));

    const fillfactor = options.fillfactor;
    const parallel_workers = options.parallel_workers;
    const autovacuum_enabled = options.autovacuum_enabled;
    const autovacuum = {
        vacuum_index_cleanup: options.vacuum_index_cleanup,
        vacuum_truncate: options.vacuum_truncate,
        autovacuum_vacuum_threshold: options.autovacuum_vacuum_threshold,
        autovacuum_vacuum_scale_factor: options.autovacuum_vacuum_scale_factor,
        autovacuum_vacuum_insert_threshold: options.autovacuum_vacuum_insert_threshold,
        autovacuum_vacuum_insert_scale_factor: options.autovacuum_vacuum_insert_scale_factor,
        autovacuum_analyze_threshold: options.autovacuum_analyze_threshold,
        autovacuum_analyze_scale_factor: options.autovacuum_analyze_scale_factor,
        autovacuum_vacuum_cost_delay: options.autovacuum_vacuum_cost_delay,
        autovacuum_vacuum_cost_limit: options.autovacuum_vacuum_cost_limit,
        autovacuum_freeze_min_age: options.autovacuum_freeze_min_age,
        autovacuum_freeze_max_age: options.autovacuum_freeze_max_age,
        autovacuum_freeze_table_age: options.autovacuum_freeze_table_age,
        autovacuum_multixact_freeze_min_age: options.autovacuum_multixact_freeze_min_age,
        autovacuum_multixact_freeze_max_age: options.autovacuum_multixact_freeze_max_age,
        autovacuum_multixact_freeze_table_age: options.autovacuum_multixact_freeze_table_age,
        log_autovacuum_min_duration: options.log_autovacuum_min_duration,
    };
    const user_catalog_table = options.user_catalog_table;
    const toast_autovacuum_enabled = options['toast.autovacuum_enabled'];
    const toast = {
        toast_tuple_target: options.toast_tuple_target,
        toast_vacuum_index_cleanup: options['toast.vacuum_index_cleanup'],
        toast_vacuum_truncate: options['toast.vacuum_truncate'],
        toast_autovacuum_vacuum_threshold: options['toast.autovacuum_vacuum_threshold'],
        toast_autovacuum_vacuum_scale_factor: options['toast.autovacuum_vacuum_scale_factor'],
        toast_autovacuum_vacuum_insert_threshold: options['toast.autovacuum_vacuum_insert_threshold'],
        toast_autovacuum_vacuum_insert_scale_factor: options['toast.autovacuum_vacuum_insert_scale_factor'],
        toast_autovacuum_vacuum_cost_delay: options['toast.autovacuum_vacuum_cost_delay'],
        toast_autovacuum_vacuum_cost_limit: options['toast.autovacuum_vacuum_cost_limit'],
        toast_autovacuum_freeze_min_age: options['toast.autovacuum_freeze_min_age'],
        toast_autovacuum_freeze_max_age: options['toast.autovacuum_freeze_max_age'],
        toast_autovacuum_freeze_table_age: options['toast.autovacuum_freeze_table_age'],
        toast_autovacuum_multixact_freeze_min_age: options['toast.autovacuum_multixact_freeze_min_age'],
        toast_autovacuum_multixact_freeze_max_age: options['toast.autovacuum_multixact_freeze_max_age'],
        toast_autovacuum_multixact_freeze_table_age: options['toast.autovacuum_multixact_freeze_table_age'],
        toast_log_autovacuum_min_duration: options['toast.log_autovacuum_min_duration'],
    };

    const storage_parameter = {
        fillfactor,
        parallel_workers,
        autovacuum_enabled,
        autovacuum: clearEmptyPropertiesInObject(autovacuum),
        toast_autovacuum_enabled,
        toast: clearEmptyPropertiesInObject(toast),
        user_catalog_table,
    };

    return clearEmptyPropertiesInObject(storage_parameter);
};

const prepareTablePartition = (partitionResult, tableAttributesWithPositions) => {
    if (!partitionResult) {
        return null;
    }

    const partitionMethod = getPartitionMethod(partitionResult);
    const isExpression = _.some(partitionResult.partition_attributes_positions, position => position === 0);
    const key = isExpression ? 'partitioning_expression' : 'compositePartitionKey';
    const value = isExpression
        ? getPartitionExpression(partitionResult, tableAttributesWithPositions)
        : _.map(
              partitionResult.partition_attributes_positions,
              getAttributeNameByPosition(tableAttributesWithPositions)
          );

    return [
        {
            partitionMethod,
            partitionBy: isExpression ? 'expression' : 'keys',
            [key]: value,
        },
    ];
};

const getPartitionMethod = partitionResult => {
    const type = partitionResult.partition_method;

    switch (type) {
        case 'h':
            return 'HASH';
        case 'l':
            return 'LIST';
        case 'r':
            return 'RANGE';
        default:
            return '';
    }
};

const getPartitionExpression = (partitionResult, tableAttributesWithPositions) => {
    let expressionIndex = 0;
    const expressions = _.split(partitionResult.expressions, ',');

    return _.chain(partitionResult.partition_attributes_positions)
        .map(attributePosition => {
            if (attributePosition === 0) {
                const expression = expressions[expressionIndex];
                expressionIndex++;

                return expression;
            }

            return getAttributeNameByPosition(tableAttributesWithPositions)(attributePosition);
        })
        .join(',')
        .value();
};

const getAttributeNameByPosition = attributes => position => _.find(attributes, { position })?.name;

const splitByEqualitySymbol = item => _.split(item, '=');

const checkHaveJsonTypes = columns => {
    return _.find(columns, { type: 'json' });
};

const getLimit = (count, recordSamplingSettings) => {
    const per = recordSamplingSettings.relative.value;
    const size =
        recordSamplingSettings.active === 'absolute'
            ? recordSamplingSettings.absolute.value
            : Math.round((count / 100) * per);
    return size;
};

module.exports = {
    prepareStorageParameters,
    prepareTablePartition,
    setDependencies,
    checkHaveJsonTypes,
    getLimit,
};
