const { clearEmptyPropertiesInObject, getColumnNameByPosition } = require('./common');

let _ = null;

const setDependencies = app => {
	_ = app.require('lodash');
};

const prepareStorageParameters = (reloptions, tableToastOptions) => {
	if (!reloptions && !tableToastOptions) {
		return null;
	}

	const options = prepareOptions(reloptions);
	const toastOptions = prepareOptions(tableToastOptions?.toast_options);

	const fillfactor = options.fillfactor;
	const parallel_workers = options.parallel_workers;
	const autovacuum_enabled = options.autovacuum_enabled;
	const autovacuum = clearEmptyPropertiesInObject({
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
	});
	const user_catalog_table = options.user_catalog_table;
	const toast_autovacuum_enabled = toastOptions.autovacuum_enabled;
	const toast = clearEmptyPropertiesInObject({
		toast_tuple_target: options.toast_tuple_target,
		toast_vacuum_index_cleanup: toastOptions.vacuum_index_cleanup,
		toast_vacuum_truncate: toastOptions.vacuum_truncate,
		toast_autovacuum_vacuum_threshold: toastOptions.autovacuum_vacuum_threshold,
		toast_autovacuum_vacuum_scale_factor: toastOptions.autovacuum_vacuum_scale_factor,
		toast_autovacuum_vacuum_insert_threshold: toastOptions.autovacuum_vacuum_insert_threshold,
		toast_autovacuum_vacuum_insert_scale_factor: toastOptions.autovacuum_vacuum_insert_scale_factor,
		toast_autovacuum_vacuum_cost_delay: toastOptions.autovacuum_vacuum_cost_delay,
		toast_autovacuum_vacuum_cost_limit: toastOptions.autovacuum_vacuum_cost_limit,
		toast_autovacuum_freeze_min_age: toastOptions.autovacuum_freeze_min_age,
		toast_autovacuum_freeze_max_age: toastOptions.autovacuum_freeze_max_age,
		toast_autovacuum_freeze_table_age: toastOptions.autovacuum_freeze_table_age,
		toast_autovacuum_multixact_freeze_min_age: toastOptions.autovacuum_multixact_freeze_min_age,
		toast_autovacuum_multixact_freeze_max_age: toastOptions.autovacuum_multixact_freeze_max_age,
		toast_autovacuum_multixact_freeze_table_age: toastOptions.autovacuum_multixact_freeze_table_age,
		toast_log_autovacuum_min_duration: toastOptions.log_autovacuum_min_duration,
	});

	const storage_parameter = {
		fillfactor,
		parallel_workers,
		autovacuum_enabled,
		autovacuum: _.isEmpty(autovacuum) ? null : autovacuum,
		toast_autovacuum_enabled,
		toast: _.isEmpty(toast) ? null : toast,
		user_catalog_table,
	};

	return clearEmptyPropertiesInObject(storage_parameter);
};

const prepareTablePartition = (partitionResult, tableColumns) => {
	if (!partitionResult) {
		return null;
	}

	const partitionMethod = getPartitionMethod(partitionResult);
	const isExpression = _.some(partitionResult.partition_attributes_positions, position => position === 0);
	const key = isExpression ? 'partitioning_expression' : 'compositePartitionKey';
	const value = isExpression
		? getPartitionExpression(partitionResult, tableColumns)
		: _.map(partitionResult.partition_attributes_positions, getColumnNameByPosition(tableColumns));

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

const getPartitionExpression = (partitionResult, tableColumns) => {
	let expressionIndex = 0;
	const expressions = _.split(partitionResult.expressions, ',');

	return _.chain(partitionResult.partition_attributes_positions)
		.map(attributePosition => {
			if (attributePosition === 0) {
				const expression = expressions[expressionIndex];
				expressionIndex++;

				return expression;
			}

			return getColumnNameByPosition(tableColumns)(attributePosition);
		})
		.join(',')
		.value();
};

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
	return Math.min(size, 100000);
};

const prepareTableConstraints = (constraintsResult, attributesWithPositions, tableIndexes) => {
	return _.reduce(
		constraintsResult,
		(entityConstraints, constraint) => {
			switch (constraint.constraint_type) {
				case 'c':
					return {
						...entityConstraints,
						chkConstr: [...entityConstraints.chkConstr, getCheckConstraint(constraint)],
					};
				case 'p':
					return {
						...entityConstraints,
						primaryKey: [
							...entityConstraints.primaryKey,
							getPrimaryKeyConstraint(constraint, attributesWithPositions),
						],
					};
				case 'u':
					return {
						...entityConstraints,
						uniqueKey: [
							...entityConstraints.uniqueKey,
							getUniqueKeyConstraint(constraint, attributesWithPositions, tableIndexes),
						],
					};
				default:
					return entityConstraints;
			}
		},
		{
			chkConstr: [],
			uniqueKey: [],
			primaryKey: [],
		},
	);
};

const getPrimaryKeyConstraint = (constraint, tableColumns) => {
	return {
		constraintName: constraint.constraint_name,
		compositePrimaryKey: _.map(constraint.constraint_keys, getColumnNameByPosition(tableColumns)),
		indexStorageParameters: _.join(constraint.storage_parameters, ','),
		indexTablespace: constraint.tablespace,
	};
};

const getUniqueKeyConstraint = (constraint, tableColumns, tableIndexes) => {
	const indexWithConstraint = _.find(tableIndexes, index => index.indexname === constraint.constraint_name);
	const nullsDistinct = indexWithConstraint?.index_indnullsnotdistinct ? 'NULLS NOT DISTINCT' : '';

	return {
		constraintName: constraint.constraint_name,
		compositeUniqueKey: _.map(constraint.constraint_keys, getColumnNameByPosition(tableColumns)),
		indexStorageParameters: _.join(constraint.storage_parameters, ','),
		indexTablespace: constraint.tablespace,
		indexComment: constraint.description,
		...(nullsDistinct && { nullsDistinct })
	};
};

const getCheckConstraint = constraint => {
	return {
		chkConstrName: constraint.constraint_name,
		constrExpression: constraint.expression,
		noInherit: constraint.no_inherit,
		constrDescription: constraint.description,
	};
};

const prepareTableIndexes = tableIndexesResult => {
	return _.map(tableIndexesResult, indexData => {
		const allColumns = mapIndexColumns(indexData);
		const columns = _.slice(allColumns, 0, indexData.number_of_keys);
		const include = _.chain(allColumns)
			.slice(indexData.number_of_keys)
			.map(column => _.pick(column, 'name'))
			.value();

		const nullsDistinct = indexData.index_indnullsnotdistinct ? 'NULLS NOT DISTINCT' : '';

		const index = {
			indxName: indexData.indexname,
			index_method: indexData.index_method,
			unique: indexData.index_unique ?? false,
			index_tablespace_name: indexData.tablespace_name || '',
			index_storage_parameter: getIndexStorageParameters(indexData.storage_parameters),
			where: indexData.where_expression || '',
			include,
			columns:
				indexData.index_method === 'btree'
					? columns
					: _.map(columns, column => _.omit(column, 'sortOrder', 'nullsOrder')),
			...(nullsDistinct && { nullsDistinct }),
		};

		return clearEmptyPropertiesInObject(index);
	});
};

const mapIndexColumns = indexData => {
	return _.chain(indexData.columns)
		.map((columnName, itemIndex) => {
			if (!columnName) {
				return;
			}

			const sortOrder = _.get(indexData, `ascendings.${itemIndex}`, false) ? 'ASC' : 'DESC';
			const nullsOrder = getNullsOrder(_.get(indexData, `nulls_first.${itemIndex}`));
			const opclass = _.get(indexData, `opclasses.${itemIndex}`, '');
			const collation = _.get(indexData, `collations.${itemIndex}`, '');

			return {
				name: columnName,
				sortOrder,
				nullsOrder,
				opclass,
				collation,
			};
		})
		.compact()
		.value();
};

const getNullsOrder = nulls_first => {
	if (_.isNil(nulls_first)) {
		return '';
	}

	return nulls_first ? 'NULLS FIRST' : 'NULLS LAST';
};

const getIndexStorageParameters = storageParameters => {
	if (!storageParameters) {
		return null;
	}

	const params = _.fromPairs(_.map(storageParameters, param => splitByEqualitySymbol(param)));

	const data = {
		index_fillfactor: params.fillfactor,
		deduplicate_items: params.deduplicate_items,
		index_buffering: params.index_buffering,
		fastupdate: params.fastupdate,
		gin_pending_list_limit: params.gin_pending_list_limit,
		pages_per_range: params.pages_per_range,
		autosummarize: params.autosummarize,
	};

	return clearEmptyPropertiesInObject(data);
};

const prepareTableLevelData = (tableLevelData, tableToastOptions) => {
	const temporary = tableLevelData?.relpersistence === 't';
	const unlogged = tableLevelData?.relpersistence === 'u';
	const storage_parameter = prepareStorageParameters(tableLevelData?.reloptions, tableToastOptions);
	const table_tablespace_name = tableLevelData?.spcname;
	const partitionBounds = tableLevelData.partition_expr;

	return {
		temporary,
		unlogged,
		storage_parameter,
		table_tablespace_name,
		partitionBounds,
	};
};

const convertValueToType = value => {
	switch (getTypeOfValue(value)) {
		case 'number':
		case 'boolean':
			return JSON.parse(value);
		case 'string':
		default:
			return value;
	}
};

const getTypeOfValue = value => {
	try {
		const type = typeof JSON.parse(value);

		if (type === 'object') {
			return 'string';
		}

		return type;
	} catch (error) {
		return 'string';
	}
};

const prepareOptions = options => {
	return (
		_.chain(options)
			.map(splitByEqualitySymbol)
			.map(([key, value]) => [key, convertValueToType(value)])
			.fromPairs()
			.value() || {}
	);
};

const prepareTableInheritance = (schemaName, inheritanceResult) => {
	return _.map(inheritanceResult, ({ parent_table_name }) => ({ parentTable: [schemaName, parent_table_name] }));
};

module.exports = {
	prepareStorageParameters,
	prepareTablePartition,
	setDependencies,
	checkHaveJsonTypes,
	prepareTableConstraints,
	prepareTableLevelData,
	prepareTableIndexes,
	getLimit,
	prepareTableInheritance,
};
