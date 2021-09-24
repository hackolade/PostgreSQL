const { createConnectionPool } = require('./connectionHelper');
const db = require('./db');
const queryConstants = require('./queryConstants');

let currentSshTunnel = null;
let _ = null;
let logger = null;

const VIEW_SUFFIX = ' (v)';

module.exports = {
    setDependencies(app) {
        _ = app.require('lodash');
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
            .filter(({ table_type }) => !_.includes(tableTypesToExclude, table_type))
            .map(({ table_name, table_type }) => {
                if (isViewByTableType(table_type)) {
                    return `${table_name}${VIEW_SUFFIX}`;
                } else {
                    return table_name;
                }
            });
    },

    async retrieveEntitiesData(schemaName, entitiesNames) {
        const schemaOidResult = await db.query(queryConstants.GET_NAMESPACE_OID, [schemaName]);
        const schemaOid = _.first(schemaOidResult.rows).oid;

        const [viewsNames, tablesNames] = _.partition(entitiesNames, isViewByName);

        debugger;
        return Promise.all(_.map(tablesNames, _.partial(this._retrieveSingleTableData, schemaOid)));
    },

    async _retrieveSingleTableData(schemaOid, tableName) {
        const result = await db.query(queryConstants.GET_TABLE_LEVEL_DATA, [tableName, schemaOid]);

        const rawTableData = _.first(result.rows);

        const temporary = rawTableData.relpersistence === 't';
        const unlogged = rawTableData.relpersistence === 'u';
        const storage_parameter = prepareStorageParameters(rawTableData.reloptions);
        const table_tablespace_name = result.spcname;

        const tableDate = {
            temporary,
            unlogged,
            storage_parameter,
            table_tablespace_name,
        };

        return clearEmptyPropertiesInObject(tableDate);
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

const splitByEqualitySymbol = item => _.split(item, '=');

const clearEmptyPropertiesInObject = obj =>
    _.chain(obj)
        .toPairs()
        .filter(([key, value]) => Boolean(value))
        .fromPairs()
        .value();
