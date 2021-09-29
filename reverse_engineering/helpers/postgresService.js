const { createConnectionPool } = require('./connectionHelper');
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
    setDependencies: setDependenciesInTableHelper,
    prepareStorageParameters,
    prepareTablePartition,
    checkHaveJsonTypes,
    prepareTableConstraints,
    getLimit,
} = require('./postgresHelpers/tableHelper');
const queryConstants = require('./queryConstants');

let currentSshTunnel = null;
let _ = null;
let logger = null;

const VIEW_SUFFIX = ' (v)';

module.exports = {
    setDependencies(app) {
        _ = app.require('lodash');
        setDependenciesInCommonHelper(app);
        setDependenciesInTableHelper(app);
        setDependenciesInColumnHelper(app);
    },

    async connect(connectionInfo, logger) {
        const { pool, sshTunnel } = await createConnectionPool(connectionInfo);

        db.initializePool(pool, logger);
        currentSshTunnel = sshTunnel;
        logger = logger;
    },

    async disconnect() {
        if (currentSshTunnel) {
            currentSshTunnel.close();
            currentSshTunnel = null;
        }

        await db.releasePool();
    },

    pingDb() {
        return db.query(queryConstants.PING);
    },

    async getAllSchemasNames() {
        const result = await db.query(queryConstants.GET_SCHEMA_NAMES);

        return result.rows.map(({ schema_name }) => schema_name).filter(schemaName => !isSystemSchema(schemaName));
    },

    async getTablesNames(schemaName) {
        const result = await db.query(queryConstants.GET_TABLE_NAMES, [schemaName]);

        const tableTypesToExclude = ['FOREIGN TABLE'];

        return result.rows
            .filter(
                ({ table_type, is_table_partitioned }) =>
                    !_.includes(tableTypesToExclude, table_type) && !is_table_partitioned
            )
            .map(({ table_name, table_type }) => {
                if (isViewByTableType(table_type)) {
                    return `${table_name}${VIEW_SUFFIX}`;
                } else {
                    return table_name;
                }
            });
    },

    async retrieveEntitiesData(schemaName, entitiesNames, recordSamplingSettings) {
        const schemaOidResult = await db.query(queryConstants.GET_NAMESPACE_OID, [schemaName]);
        const schemaOid = getFirstRow(schemaOidResult).oid;

        const [viewsNames, tablesNames] = _.partition(entitiesNames, isViewByName);

        return Promise.all(
            _.map(
                tablesNames,
                _.bind(this._retrieveSingleTableData, this, recordSamplingSettings, schemaOid, schemaName)
            )
        );
    },

    async _retrieveSingleTableData(recordSamplingSettings, schemaOid, schemaName, tableName) {
        const result = await db.query(queryConstants.GET_TABLE_LEVEL_DATA, [tableName, schemaOid]);
        const rawTableData = getFirstRow(result);
        const tableOid = rawTableData.oid;
        const partitionResult = getFirstRow(await db.query(queryConstants.GET_TABLE_PARTITION_DATA, [tableOid]));
        const tableAttributes = (await db.query(queryConstants.GET_TABLE_ATTRIBUTES_WITH_POSITIONS, [tableOid])).rows;
        const descriptionResult = await db.query(queryConstants.GET_DESCRIPTION_BY_OID, [tableOid]);
        const inheritsResult = getFirstRow(await db.query(queryConstants.GET_INHERITS_PARENT_TABLE_NAME, [tableOid]));
        const tableConstraintsResult = (await db.query(queryConstants.GET_TABLE_CONSTRAINTS, [tableOid])).rows;

        const partitioning = prepareTablePartition(partitionResult, tableAttributes);

        const temporary = rawTableData.relpersistence === 't';
        const unlogged = rawTableData.relpersistence === 'u';
        const storage_parameter = prepareStorageParameters(rawTableData.reloptions);
        const table_tablespace_name = result.spcname;
        const description = getDescriptionFromResult(descriptionResult);
        const inherits = inheritsResult?.parent_table_name;
        const tableConstraint = prepareTableConstraints(tableConstraintsResult, tableAttributes);

        const tableData = {
            temporary,
            unlogged,
            storage_parameter,
            table_tablespace_name,
            partitioning,
            description,
            inherits,
            ...tableConstraint,
        };

        const entityLevel = clearEmptyPropertiesInObject(tableData);

        const columns = await db.query(queryConstants.GET_TABLE_COLUMNS, [tableName, schemaName, tableOid]);
        let targetAttributes = columns.rows.map(mapColumnData);

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
        };
    },

    async _getDocuments(schemaName, tableName, recordSamplingSettings) {
        const fullTableName = `${schemaName}.${tableName}`;
        const quantity = await db.query(queryConstants.GET_ROWS_COUNT(fullTableName));
        const limit = getLimit(quantity, recordSamplingSettings);
        const sampledDocs = await db.query(queryConstants.GET_SAMPLED_DATA(fullTableName), [limit]);

        return sampledDocs.rows;
    },
};

const isViewByTableType = table_type => table_type === 'VIEW';
const isViewByName = name => _.endsWith(name, VIEW_SUFFIX);

const isSystemSchema = schema_name => {
    if (_.startsWith(schema_name, 'pg_')) {
        return true;
    }

    if (_.includes(['information_schema'], schema_name)) {
        return true;
    }

    return false;
};

const getFirstRow = result => _.first(result.rows);

const getDescriptionFromResult = result => getFirstRow(result)?.obj_description;
