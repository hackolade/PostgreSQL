const { createConnectionPool } = require('./connectionHelper');
const db = require('./db');
const queryConstants = require('./queryConstants');

let currentSshTunnel = null;
let _ = null;

module.exports = {
    setDependencies(app) {
        _ = app.require('lodash');
    },

    async connect(connectionInfo, logger) {
        const { pool, sshTunnel } = await createConnectionPool(connectionInfo);

        db.initializePool(pool, logger);
        currentSshTunnel = sshTunnel;
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

        return result.rows
            .map(({ schema_name }) => schema_name)
            .filter(schemaName => !this._isSystemSchema(schemaName));
    },

    async getTablesNames(schemaName) {
        const result = await db.query(queryConstants.GET_TABLE_NAMES, [schemaName]);

        const tableTypesToExclude = ['FOREIGN TABLE'];

        return result.rows
            .filter(({ table_type }) => !_.includes(tableTypesToExclude, table_type))
            .map(({ table_name, table_type }) => {
                if (this._isView(table_type)) {
                    return `${table_name} (v)`;
                } else {
                    return table_name;
                }
            });
    },

    _isView(table_type) {
        return table_type === 'VIEW';
    },

    _isSystemSchema(schema_name) {
        if (_.startsWith(schema_name, 'pg_')) {
            return true;
        }

        if (_.includes(['information_schema'], schema_name)) {
            return true;
        }

        return false;
    },
};
