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
    prepareTablePartition,
    checkHaveJsonTypes,
    prepareTableConstraints,
    getLimit,
    prepareTableLevelData,
    prepareTableIndexes,
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
                    return `${table_name}${VIEW_SUFFIX}`;
                } else {
                    return table_name;
                }
            });
    },

    async retrieveEntitiesData(schemaName, entitiesNames, recordSamplingSettings) {
        const schemaOidResult = await db.queryTolerant(queryConstants.GET_NAMESPACE_OID, [schemaName], true);
        const schemaOid = schemaOidResult.oid;

        const [viewsNames, tablesNames] = _.partition(entitiesNames, isViewByName);

        return Promise.all(
            _.map(
                tablesNames,
                _.bind(this._retrieveSingleTableData, this, recordSamplingSettings, schemaOid, schemaName)
            )
        );
    },

    async _retrieveSingleTableData(recordSamplingSettings, schemaOid, schemaName, tableName) {
        const tableLevelData = await db.queryTolerant(
            queryConstants.GET_TABLE_LEVEL_DATA,
            [tableName, schemaOid],
            true
        );
        const tableOid = tableLevelData?.oid;

        const partitionResult = await db.queryTolerant(queryConstants.GET_TABLE_PARTITION_DATA, [tableOid], true);
        const tableColumns = await this._getTableColumns(tableName, schemaName, tableOid);
        const descriptionResult = await db.queryTolerant(queryConstants.GET_DESCRIPTION_BY_OID, [tableOid], true);
        const inheritsResult = await db.queryTolerant(queryConstants.GET_INHERITS_PARENT_TABLE_NAME, [tableOid], true);
        const tableConstraintsResult = await db.queryTolerant(queryConstants.GET_TABLE_CONSTRAINTS, [tableOid]);
        const tableIndexesResult = await db.queryTolerant(queryConstants.GET_TABLE_INDEXES, [tableOid]);

        const partitioning = prepareTablePartition(partitionResult, tableColumns);
        const tableLevelProperties = prepareTableLevelData(tableLevelData);
        const description = getDescriptionFromResult(descriptionResult);
        const inherits = inheritsResult?.parent_table_name;
        const tableConstraint = prepareTableConstraints(tableConstraintsResult, tableColumns);
        const tableIndexes = prepareTableIndexes(tableIndexesResult);

        const tableData = {
            partitioning,
            description,
            inherits,
            Indxs: tableIndexes,
            ...tableLevelProperties,
            ...tableConstraint,
        };

        const entityLevel = clearEmptyPropertiesInObject(tableData);

        let targetAttributes = tableColumns.map(mapColumnData);

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

    async _getTableColumns(tableName, schemaName, tableOid) {
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
        const fullTableName = `${schemaName}.${tableName}`;
        const quantity = (await db.queryTolerant(queryConstants.GET_ROWS_COUNT(fullTableName), [], true))?.quantity || 0;
        const limit = getLimit(quantity, recordSamplingSettings);

        return await db.queryTolerant(queryConstants.GET_SAMPLED_DATA(fullTableName), [limit]);
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

const getDescriptionFromResult = result => result?.obj_description;
