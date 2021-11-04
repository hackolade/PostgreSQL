const queryConstants = require('./queryConstants');

let client = null;
let logger = null;
let queue = [];

module.exports = {
    initializeClient(newClient, newLogger) {
        client = newClient;
        logger = newLogger;

        client.on('error', error => newLogger.error(error));
    },

    isClientInitialized() {
        return Boolean(client);
    },

    releaseClient() {
        if (client) {
            return new Promise(resolve => {
                client.end(() => {
                    client = null;
                    resolve();
                });
            });
        }

        return Promise.resolve();
    },

    async query(query, params, firstRow = false) {
        const queryName = queryConstants.getQueryName(query);

        logger.info('Execute query', { queryName, params });

        const start = Date.now();
        const result = await this._executeQuery(query, params);
        const duration = Date.now() - start;

        logger.info('Query executed', { queryName, params, duration, rowsCount: result.rowCount });

        const rows = result.rows || [];

        return firstRow ? rows[0] : rows;
    },

    async queryTolerant(query, params, firstRow = false) {
        try {
            return await this.query(query, params, firstRow);
        } catch (error) {
            error.query = query;
            error.params = params;

            logger.error(error);

            return null;
        }
    },

    _executeQuery(query, params = []) {
        return new Promise((resolve, reject) => {
            try {
                const rows = client.querySync(query, params);

                resolve({ rows });
            } catch (err) {
                return reject(err);
            }
        });
    },
};
