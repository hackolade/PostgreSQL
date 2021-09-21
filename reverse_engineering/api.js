'use strict';

const postgresService = require('./helpers/postgresService');

module.exports = {
    async disconnect(connectionInfo, logger, callback, app) {
        await postgresService.disconnect();

        callback();
    },

    async testConnection(connectionInfo, logger, callback, app) {
        try {
            logger.clear();
            logger.log('info', connectionInfo, 'connectionInfo', connectionInfo.hiddenKeys);

            const postgresLogger = createLogger({
                title: 'Test connection instance log',
                hiddenKeys: connectionInfo.hiddenKeys,
                logger,
            });

            await postgresService.connect(connectionInfo, postgresLogger);
            await postgresService.pingDb();
            callback();
        } catch (error) {
            callback(prepareError(error));
        } finally {
            await postgresService.disconnect();
        }
    },

    async getDbCollectionsNames(connectionInfo, logger, callback, app) {
        try {
            logger.clear();
            logger.log('info', connectionInfo, 'connectionInfo', connectionInfo.hiddenKeys);

            const postgresLogger = createLogger({
                title: 'Test connection log',
                hiddenKeys: connectionInfo.hiddenKeys,
                logger,
            });

            await postgresService.setDependencies(app);
            await postgresService.connect(connectionInfo, postgresLogger);
            const schemasNames = await postgresService.getAllSchemasNames();

            const collections = await schemasNames.reduce(async (next, dbName) => {
                const result = await next;
                try {
                    const dbCollections = await postgresService.getTablesNames(dbName);

                    return result.concat({
                        dbName,
                        dbCollections,
                        isEmpty: dbCollections.length === 0,
                    });
                } catch (error) {
                    postgresLogger.info(`Error reading database "${dbName}"`);
                    postgresLogger.error(error);

                    return result.concat({
                        dbName,
                        dbCollections: [],
                        isEmpty: true,
                        status: true,
                    });
                }
            }, Promise.resolve([]));

            callback(null, collections);
        } catch (error) {
            callback(prepareError(error));
        } finally {
            await postgresService.disconnect();
        }
    },

    async getDbCollectionsData(data, logger, callback, app) {},
};

const createLogger = ({ title, logger, hiddenKeys }) => {
    return {
        info(message, additionalData = {}) {
            logger.log('info', { message, ...additionalData }, title, hiddenKeys);
        },

        progress(message, dbName = '', tableName = '') {
            logger.progress({ message, containerName: dbName, entityName: tableName });
        },

        error(error) {
            logger.log('error', prepareError(error), title);
        },
    };
};

const prepareError = error => ({
    message: error.message,
    stack: error.stack,
});
