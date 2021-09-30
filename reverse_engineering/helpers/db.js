const queryConstants = require('./queryConstants');

let pool = null;
let logger = null;

module.exports = {
    initializePool(newPool, newLogger) {
        pool = newPool;
        logger = newLogger;

        pool.on('error', error => newLogger.error(error));
    },

    async releasePool() {
        if (pool) {
            await pool.end();
            pool = null;
        }
    },

    async query(query, params, firstRow = false) {
        const queryName = queryConstants.getQueryName(query);

        logger.info('Execute query', { queryName, params });

        const start = Date.now();
        const result = await pool.query(query, params);
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
};
