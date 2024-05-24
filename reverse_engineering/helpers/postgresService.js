const { createClient } = require('./connectionHelper');
const db = require('./db');
const { getJsonSchema } = require('./getJsonSchema');
const {
	setDependencies: setDependenciesInColumnHelper,
	mapColumnData,
	setSubtypeFromSampledJsonValues,
} = require('./postgresHelpers/columnHelper');
const {
	setDependencies: setDependenciesInCommonHelper,
	clearEmptyPropertiesInObject,
} = require('./postgresHelpers/common');
const {
	setDependencies: setDependenciesInForeignKeysHelper,
	prepareForeignKeys,
} = require('./postgresHelpers/foreignKeysHelper');
const {
	setDependencies: setFunctionHelperDependencies,
	mapFunctionData,
	mapProcedureData,
} = require('./postgresHelpers/functionHelper');
const {
	setDependencies: setDependenciesInTableHelper,
	prepareTablePartition,
	checkHaveJsonTypes,
	prepareTableConstraints,
	getSampleDocSize,
	prepareTableLevelData,
	prepareTableIndexes,
	prepareTableInheritance,
} = require('./postgresHelpers/tableHelper');
const {
	setDependencies: setDependenciesInUserDefinedTypesHelper,
	getUserDefinedTypes,
	isTypeComposite,
} = require('./postgresHelpers/userDefinedTypesHelper');
const {
	setDependencies: setViewDependenciesInViewHelper,
	isViewByTableType,
	isViewByName,
	removeViewNameSuffix,
	generateCreateViewScript,
	setViewSuffix,
	prepareViewData,
} = require('./postgresHelpers/viewHelper');
const { setDependencies: setDependenciesInTriggerHelper, getTriggers } = require('./postgresHelpers/triggerHelper');
const queryConstants = require('./queryConstants');
const { reorganizeConstraints } = require('./postgresHelpers/reorganizeConstraints');
const { mapSequenceData } = require('./postgresHelpers/sequenceHelper');

let currentSshTunnel = null;
let _ = null;
let logger = null;
let version = 14;

module.exports = {
	setDependencies(app) {
		_ = app.require('lodash');
		setDependenciesInCommonHelper(app);
		setDependenciesInTableHelper(app);
		setDependenciesInColumnHelper(app);
		setDependenciesInForeignKeysHelper(app);
		setViewDependenciesInViewHelper(app);
		setFunctionHelperDependencies(app);
		setDependenciesInUserDefinedTypesHelper(app);
		setDependenciesInTriggerHelper(app);
	},

	async connect(connectionInfo, specificLogger) {
		if (db.isClientInitialized()) {
			await this.disconnect();
		}

		const { client, sshTunnel } = await createClient(connectionInfo, specificLogger);

		db.initializeClient(client, specificLogger);
		currentSshTunnel = sshTunnel;
		logger = specificLogger;
		version = await this._getServerVersion();
	},

	async disconnect() {
		if (currentSshTunnel) {
			currentSshTunnel.close();
			currentSshTunnel = null;
		}

		await db.releaseClient();
	},

	pingDb() {
		return db.query(queryConstants.PING);
	},

	applyScript(script) {
		return db.query(script);
	},

	async getDatabaseNames() {
		return _.map(await db.query(queryConstants.GET_DATABASES), 'database_name');
	},

	async logVersion() {
		const versionRow = await db.queryTolerant(queryConstants.GET_VERSION, [], true);
		const version = versionRow?.version || 'Version not retrieved';

		logger.info(`PostgreSQL version: ${version}`);
	},

	async getAllSchemasNames() {
		const schemaNames = await db.query(queryConstants.GET_SCHEMA_NAMES);

		return schemaNames.map(({ schema_name }) => schema_name).filter(schemaName => !isSystemSchema(schemaName));
	},

	async getTablesNames(schemaName) {
		const tables = await db.query(queryConstants.GET_TABLE_NAMES, [schemaName]);

		const tableTypesToExclude = ['FOREIGN TABLE'];

		return tables
			.filter(({ table_type }) => !_.includes(tableTypesToExclude, table_type))
			.map(({ table_name, table_type }) => {
				if (isViewByTableType(table_type)) {
					return setViewSuffix(table_name);
				} else {
					return table_name;
				}
			});
	},

	async getDbLevelData() {
		logger.progress('Get database data');

		const database_name = (await db.queryTolerant(queryConstants.GET_DB_NAME, [], true))?.current_database;
		const encoding = (await db.queryTolerant(queryConstants.GET_DB_ENCODING, [], true))?.server_encoding;
		const LC_COLLATE = (await db.queryTolerant(queryConstants.GET_DB_COLLATE_NAME, [], true))?.default_collate_name;

		return clearEmptyPropertiesInObject({
			database_name,
			encoding,
			LC_COLLATE,
			LC_CTYPE: LC_COLLATE,
		});
	},

	async retrieveEntitiesData(
		schemaName,
		entitiesNames,
		recordSamplingSettings,
		includePartitions = false,
		ignoreUdfUdpTriggers = false,
	) {
		const userDefinedTypes = await this._retrieveUserDefinedTypes(schemaName);
		const schemaOidResult = await db.queryTolerant(queryConstants.GET_NAMESPACE_OID, [schemaName], true);
		const schemaOid = schemaOidResult?.oid;
		const partitions = includePartitions ? await db.queryTolerant(queryConstants.GET_PARTITIONS, [schemaOid]) : [];

		const [viewsNames, tablesNames] = _.partition(entitiesNames, isViewByName);

		const allTablesList = tablesNames.flatMap(tableName => [
			{ tableName },
			..._.filter(partitions, { parent_name: tableName }).map(({ child_name, is_parent_partitioned }) => ({
				isParentPartitioned: is_parent_partitioned,
				tableName: child_name,
			})),
		]);

		const tables = await mapPromises(
			_.uniq(allTablesList),
			_.bind(
				this._retrieveSingleTableData,
				this,
				recordSamplingSettings,
				schemaOid,
				schemaName,
				userDefinedTypes,
				ignoreUdfUdpTriggers,
			),
		);

		const views = await mapPromises(
			viewsNames,
			_.bind(this._retrieveSingleViewData, this, schemaOid, schemaName, ignoreUdfUdpTriggers),
		);

		return { views, tables, modelDefinitions: getJsonSchema(userDefinedTypes) };
	},

	async retrieveSchemaLevelData(schemaName, ignoreUdfUdpTriggers) {
		if (ignoreUdfUdpTriggers) {
			logger.info('Functions and procedures ignored');

			return { functions: [], procedures: [] };
		}

		logger.progress('Get Functions and Procedures', schemaName);

		const schemaOid = (await db.queryTolerant(queryConstants.GET_NAMESPACE_OID, [schemaName], true))?.oid;

		const functionsWithProcedures = await db.queryTolerant(queryConstants.GET_FUNCTIONS_WITH_PROCEDURES, [
			schemaName,
		]);
		const functionAdditionalData = await db.queryTolerant(getGetFunctionsAdditionalDataQuery(version), [schemaOid]);
		const [functions, procedures] = _.partition(_.filter(functionsWithProcedures, 'routine_type'), {
			routine_type: 'FUNCTION',
		});

		const userDefinedFunctions = await mapPromises(functions, async functionData => {
			const functionArgs = await db.queryTolerant(queryConstants.GET_FUNCTIONS_WITH_PROCEDURES_ARGS, [
				functionData.specific_name,
			]);
			const additionalData = _.find(functionAdditionalData, { function_name: functionData.name });

			return mapFunctionData(functionData, functionArgs, additionalData);
		});

		const userDefinedProcedures = await mapPromises(procedures, async functionData => {
			const functionArgs = await db.queryTolerant(queryConstants.GET_FUNCTIONS_WITH_PROCEDURES_ARGS, [
				functionData.specific_name,
			]);
			const additionalData = _.find(functionAdditionalData, { function_name: functionData.name });

			return mapProcedureData(functionData, functionArgs, additionalData);
		});

		const sequencesData = await db.queryTolerant(queryConstants.GET_SEQUENCES, [schemaName]);
		const sequences = sequencesData.map(sequence => mapSequenceData({ sequence }));

		return { functions: userDefinedFunctions, procedures: userDefinedProcedures, sequences };
	},

	async _retrieveUserDefinedTypes(schemaName) {
		logger.progress('Get User-Defined Types', schemaName);

		const userDefinedTypes = await db.queryTolerant(queryConstants.GET_USER_DEFINED_TYPES, [schemaName]);
		const domainTypes = await db.queryTolerant(queryConstants.GET_DOMAIN_TYPES, [schemaName]);

		const udtsWithColumns = await mapPromises(userDefinedTypes, async typeData => {
			if (isTypeComposite(typeData)) {
				return {
					...typeData,
					columns: await db.queryTolerant(queryConstants.GET_COMPOSITE_TYPE_COLUMNS, [typeData.pg_class_oid]),
				};
			}

			return typeData;
		});

		const domainTypesWithConstraints = await mapPromises(domainTypes, async typeData => {
			return {
				...typeData,
				constraints: await db.queryTolerant(queryConstants.GET_DOMAIN_TYPES_CONSTRAINTS, [
					typeData.domain_name,
					schemaName,
				]),
			};
		});

		return getUserDefinedTypes(udtsWithColumns, domainTypesWithConstraints);
	},

	async _retrieveSingleTableData(
		recordSamplingSettings,
		schemaOid,
		schemaName,
		userDefinedTypes,
		ignoreUdfUdpTriggers,
		{ tableName, isParentPartitioned },
	) {
		logger.progress('Get table data', schemaName, tableName);

		const tableLevelData = await db.queryTolerant(
			queryConstants.GET_TABLE_LEVEL_DATA,
			[tableName, schemaOid],
			true,
		);
		const tableOid = tableLevelData?.oid;

		const tableToastOptions = await db.queryTolerant(
			queryConstants.GET_TABLE_TOAST_OPTIONS,
			[tableName, schemaOid],
			true,
		);
		const partitionResult = await db.queryTolerant(queryConstants.GET_TABLE_PARTITION_DATA, [tableOid], true);
		const tableColumns = await this._getTableColumns(tableName, schemaName, tableOid);
		const descriptionResult = await db.queryTolerant(queryConstants.GET_DESCRIPTION_BY_OID, [tableOid], true);
		const inheritsResult = await db.queryTolerant(queryConstants.GET_INHERITS_PARENT_TABLE_NAME, [tableOid]);
		const tableConstraintsResult = await db.queryTolerant(queryConstants.GET_TABLE_CONSTRAINTS, [tableOid]);
		const tableIndexesResult = await db.queryTolerant(getGetIndexesQuery(version), [tableOid]);
		const tableForeignKeys = await db.queryTolerant(queryConstants.GET_TABLE_FOREIGN_KEYS, [tableOid]);
		const triggers = await this._getTriggers(schemaName, tableName, schemaOid, tableOid, ignoreUdfUdpTriggers);

		logger.info('Table data retrieved', {
			schemaName,
			tableName,
			columnTypes: tableColumns.map(column => column.data_type),
		});

		const partitioning = prepareTablePartition(partitionResult, tableColumns);
		const tableLevelProperties = prepareTableLevelData(tableLevelData, tableToastOptions);
		const description = getDescriptionFromResult(descriptionResult);
		const inherits = prepareTableInheritance(schemaName, inheritsResult);
		const tableConstraint = prepareTableConstraints(tableConstraintsResult, tableColumns, tableIndexesResult);
		const tableIndexes = prepareTableIndexes(tableIndexesResult);
		const relationships = prepareForeignKeys(tableForeignKeys, tableName, schemaName, tableColumns);

		const tableData = {
			partitioning,
			description,
			triggers,
			Indxs: tableIndexes,
			...tableLevelProperties,
			...tableConstraint,
			...(isParentPartitioned ? { partitionOf: _.first(inherits)?.parentTable } : { inherits }),
		};

		const entityLevel = clearEmptyPropertiesInObject(tableData);

		let targetAttributes = tableColumns.map(mapColumnData(userDefinedTypes));

		const hasJsonTypes = checkHaveJsonTypes(targetAttributes);
		let documents = [];

		if (hasJsonTypes) {
			documents = await this._getDocuments(schemaName, tableName, targetAttributes, recordSamplingSettings);
			targetAttributes = setSubtypeFromSampledJsonValues(targetAttributes, documents);
		}

		const { attributes, entityLevel: updatedEntityLevel } = reorganizeConstraints(targetAttributes, entityLevel);

		return {
			name: tableName,
			entityLevel: updatedEntityLevel,
			jsonSchema: getJsonSchema(attributes),
			documents,
			relationships,
		};
	},

	async _getTriggers(schemaName, objectName, schemaOid, objectOid, ignoreUdfUdpTriggers) {
		if (ignoreUdfUdpTriggers) {
			logger.info('Triggers ignored');

			return [];
		}

		const triggersData = await db.queryTolerant(queryConstants.GET_TRIGGERS, [schemaName, objectName]);
		const triggersAdditionalData = await db.queryTolerant(queryConstants.GET_TRIGGERS_ADDITIONAL_DATA, [
			schemaOid,
			objectOid,
		]);

		return getTriggers(triggersData, triggersAdditionalData);
	},

	async _getTableColumns(tableName, schemaName, tableOid) {
		logger.progress('Get columns', schemaName, tableName);

		const tableColumns = await db.query(queryConstants.GET_TABLE_COLUMNS, [tableName, schemaName]);
		const tableColumnsAdditionalData = await db.queryTolerant(queryConstants.GET_TABLE_COLUMNS_ADDITIONAL_DATA, [
			tableOid,
		]);

		return _.map(tableColumns, columnData => {
			return {
				...columnData,
				...(_.find(tableColumnsAdditionalData, { name: columnData.column_name }) || {}),
			};
		});
	},

	async _getDocuments(schemaName, tableName, attributes, recordSamplingSettings) {
		logger.progress('Sampling table', schemaName, tableName);

		const fullTableName = `${schemaName}.${tableName}`;
		const quantity =
			(await db.queryTolerant(queryConstants.GET_ROWS_COUNT(fullTableName), [], true))?.quantity || 0;
		const limit = getSampleDocSize(quantity, recordSamplingSettings);

		const jsonColumns = attributes.filter(({ type }) => _.includes(['json', 'jsonb'], type));

		const jsonColumnsString = _.map(jsonColumns, 'name').join(', ');

		const samplingDataSize = await db.queryTolerant(
			queryConstants.GET_SAMPLED_DATA_SIZE(fullTableName, jsonColumnsString),
			[limit],
			true,
		);

		logger.info('Sampling table', {
			tableName,
			jsonColumnsNumber: jsonColumns.length,
			samplingDataSize: samplingDataSize?._hackolade_tmp_sampling_tbl_size,
		});

		return await db.queryTolerant(queryConstants.GET_SAMPLED_DATA(fullTableName, jsonColumnsString), [limit]);
	},

	async _retrieveSingleViewData(schemaOid, schemaName, ignoreUdfUdpTriggers, viewName) {
		logger.progress('Get view data', schemaName, viewName);

		viewName = removeViewNameSuffix(viewName);

		const viewData = await db.query(queryConstants.GET_VIEW_DATA, [viewName, schemaName], true);
		const viewDefinitionFallback =
			!viewData.view_definition &&
			(await db.queryTolerant(queryConstants.GET_VIEW_SELECT_STMT_FALLBACK, [viewName, schemaName], true));
		const viewOptions = await db.queryTolerant(queryConstants.GET_VIEW_OPTIONS, [viewName, schemaOid], true);
		const triggers = await this._getTriggers(
			schemaName,
			viewName,
			schemaOid,
			viewOptions?.oid,
			ignoreUdfUdpTriggers,
		);

		const script = generateCreateViewScript(viewName, viewData, viewDefinitionFallback);
		const data = prepareViewData(viewData, viewOptions, triggers);

		if (!script) {
			logger.info('View select statement was not retrieved', { schemaName, viewName });

			return {
				name: viewName,
				data,
				jsonSchema: { properties: [] },
			};
		}

		return {
			name: viewName,
			data,
			ddl: {
				script,
				type: 'postgres',
			},
		};
	},

	async _getServerVersion() {
		const result = await db.queryTolerant(queryConstants.GET_VERSION_AS_NUM, [], true);
		const serverVersionNum = _.toNumber(result?.server_version_num);

		if (serverVersionNum >= 100000 && serverVersionNum < 110000) {
			return 10;
		} else if (serverVersionNum >= 110000 && serverVersionNum < 120000) {
			return 11;
		} else if (serverVersionNum >= 120000 && serverVersionNum < 130000) {
			return 12;
		} else if (serverVersionNum >= 130000 && serverVersionNum < 140000) {
			return 13;
		} else if (serverVersionNum >= 140000 && serverVersionNum < 150000) {
			return 14;
		}

		return 14;
	},
};

const isSystemSchema = schema_name => {
	if (_.startsWith(schema_name, 'pg_')) {
		return true;
	}

	if (_.includes(['information_schema'], schema_name)) {
		return true;
	}

	return false;
};

const getGetIndexesQuery = postgresVersion => {
	if (postgresVersion === 10) {
		return queryConstants.GET_TABLE_INDEXES_V_10;
	} else if (postgresVersion > 15) {
		return queryConstants.GET_TABLE_INDEXES_V_15;
	} else {
		return queryConstants.GET_TABLE_INDEXES;
	}
};

const getGetFunctionsAdditionalDataQuery = postgreVersion => {
	return postgreVersion === 10
		? queryConstants.GET_FUNCTIONS_WITH_PROCEDURES_ADDITIONAL_V_10
		: queryConstants.GET_FUNCTIONS_WITH_PROCEDURES_ADDITIONAL;
};

const getDescriptionFromResult = result => result?.obj_description;

const mapPromises = (items, asyncFunc) => Promise.all(_.map(items, asyncFunc));
