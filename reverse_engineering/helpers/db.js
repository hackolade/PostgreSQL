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

    async query(query, params) {
        logger.info('Execute query', { query, params });

        const start = Date.now();
        const result = await pool.query(query, params);
        const duration = Date.now() - start;

        logger.info('Query executed', { query, params, duration, rowsCount: result.rowCount });

        return result;
    },
};
