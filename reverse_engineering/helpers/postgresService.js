const { createClient, setConnectionHelperDependencies } = require('./connectionHelper');
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
    getLimit,
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
const queryConstants = require('./queryConstants');

let currentSshTunnel = null;
let _ = null;
let logger = null;

module.exports = {
    setDependencies(app) {
        _ = app.require('lodash');
        setConnectionHelperDependencies(app);
        setDependenciesInCommonHelper(app);
        setDependenciesInTableHelper(app);
        setDependenciesInColumnHelper(app);
        setDependenciesInForeignKeysHelper(app);
        setViewDependenciesInViewHelper(app);
        setFunctionHelperDependencies(app);
        setDependenciesInUserDefinedTypesHelper(app);
    },

    async connect(connectionInfo, specificLogger) {
        if (db.isClientInitialized()) {
            await this.disconnect();
        }

        const { client, sshTunnel } = await createClient(connectionInfo);

        db.initializeClient(client, specificLogger);
        currentSshTunnel = sshTunnel;
        logger = specificLogger;
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

    async retrieveEntitiesData(schemaName, entitiesNames, recordSamplingSettings) {
        const userDefinedTypes = await this._retrieveUserDefinedTypes(schemaName);
        const schemaOidResult = await db.queryTolerant(queryConstants.GET_NAMESPACE_OID, [schemaName], true);
        const schemaOid = schemaOidResult?.oid;

        const [viewsNames, tablesNames] = _.partition(entitiesNames, isViewByName);

        const tables = await mapPromises(
            tablesNames,
            _.bind(this._retrieveSingleTableData, this, recordSamplingSettings, schemaOid, schemaName, userDefinedTypes)
        );

        const views = await mapPromises(viewsNames, _.bind(this._retrieveSingleViewData, this, schemaOid, schemaName));

        return { views, tables, modelDefinitions: getJsonSchema(userDefinedTypes) };
    },

    async retrieveFunctionsWithProcedures(schemaName) {
        logger.progress('Get Functions and Procedures', schemaName);

        const schemaOid = (await db.queryTolerant(queryConstants.GET_NAMESPACE_OID, [schemaName], true))?.oid;

        const functionsWithProcedures = await db.queryTolerant(queryConstants.GET_FUNCTIONS_WITH_PROCEDURES, [
            schemaName,
        ]);
        const functionAdditionalData = await db.queryTolerant(queryConstants.GET_FUNCTIONS_WITH_PROCEDURES_ADDITIONAL, [
            schemaOid,
        ]);
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

        return { functions: userDefinedFunctions, procedures: userDefinedProcedures };
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

    async _retrieveSingleTableData(recordSamplingSettings, schemaOid, schemaName, userDefinedTypes, tableName) {
        logger.progress('Get table data', schemaName, tableName);

        const tableLevelData = await db.queryTolerant(
            queryConstants.GET_TABLE_LEVEL_DATA,
            [tableName, schemaOid],
            true
        );
        const tableOid = tableLevelData?.oid;

        const tableToastOptions = await db.queryTolerant(
            queryConstants.GET_TABLE_TOAST_OPTIONS,
            [tableName, schemaOid],
            true
        );
        const partitionResult = await db.queryTolerant(queryConstants.GET_TABLE_PARTITION_DATA, [tableOid], true);
        const tableColumns = await this._getTableColumns(tableName, schemaName, tableOid);
        const descriptionResult = await db.queryTolerant(queryConstants.GET_DESCRIPTION_BY_OID, [tableOid], true);
        const inheritsResult = await db.queryTolerant(queryConstants.GET_INHERITS_PARENT_TABLE_NAME, [tableOid]);
        const tableConstraintsResult = await db.queryTolerant(queryConstants.GET_TABLE_CONSTRAINTS, [tableOid]);
        const tableIndexesResult = await db.queryTolerant(queryConstants.GET_TABLE_INDEXES, [tableOid]);
        const tableForeignKeys = await db.queryTolerant(queryConstants.GET_TABLE_FOREIGN_KEYS, [tableOid]);

        const partitioning = prepareTablePartition(partitionResult, tableColumns);
        const tableLevelProperties = prepareTableLevelData(tableLevelData, tableToastOptions);
        const description = getDescriptionFromResult(descriptionResult);
        const inherits = prepareTableInheritance(schemaName, inheritsResult);
        const tableConstraint = prepareTableConstraints(tableConstraintsResult, tableColumns);
        const tableIndexes = prepareTableIndexes(tableIndexesResult);
        const relationships = prepareForeignKeys(tableForeignKeys, tableName, schemaName, tableColumns);

        const tableData = {
            partitioning,
            description,
            inherits,
            Indxs: tableIndexes,
            ...tableLevelProperties,
            ...tableConstraint,
        };

        const entityLevel = clearEmptyPropertiesInObject(tableData);

        let targetAttributes = tableColumns.map(mapColumnData(userDefinedTypes));

        const hasJsonTypes = checkHaveJsonTypes(targetAttributes);
        let documents = [];

        if (hasJsonTypes) {
            documents = await this._getDocuments(schemaName, tableName, recordSamplingSettings);
            targetAttributes = setSubtypeFromSampledJsonValues(targetAttributes, documents);
        }

        return {
            name: tableName,
            entityLevel,
            jsonSchema: getJsonSchema(targetAttributes),
            documents,
            relationships,
        };
    },

    async _getTableColumns(tableName, schemaName, tableOid) {
        logger.progress('Get columns', schemaName, tableName);

        const tableColumns = await db.query(queryConstants.GET_TABLE_COLUMNS, [tableName, schemaName]);
        const tableColumnsAdditionalData = await db.queryTolerant(queryConstants.GET_TABLE_COLUMNS_ADDITIONAL_DATA, [
            tableOid,
        ]);

        return _.map(tableColumns, (columnData, index) => {
            return {
                ...columnData,
                ...(_.find(tableColumnsAdditionalData, { name: columnData.column_name }) || {}),
            };
        });
    },

    async _getDocuments(schemaName, tableName, recordSamplingSettings) {
        logger.progress('Sampling table', schemaName, tableName);

        const fullTableName = `${schemaName}.${tableName}`;
        const quantity =
            (await db.queryTolerant(queryConstants.GET_ROWS_COUNT(fullTableName), [], true))?.quantity || 0;
        const limit = getLimit(quantity, recordSamplingSettings);

        return await db.queryTolerant(queryConstants.GET_SAMPLED_DATA(fullTableName), [limit]);
    },

    async _retrieveSingleViewData(schemaOid, schemaName, viewName) {
        logger.progress('Get view data', schemaName, viewName);

        viewName = removeViewNameSuffix(viewName);

        const viewData = await db.query(queryConstants.GET_VIEW_DATA, [viewName, schemaName], true);
        const viewOptions = await db.queryTolerant(queryConstants.GET_VIEW_OPTIONS, [viewName, schemaOid], true);

        const script = generateCreateViewScript(viewName, viewData);
        const data = prepareViewData(viewData, viewOptions);

        return {
            name: viewName,
            data,
            ddl: {
                script,
                type: 'postgres',
            },
        };
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

const getDescriptionFromResult = result => result?.obj_description;

const mapPromises = (items, asyncFunc) => Promise.all(_.map(items, asyncFunc));
