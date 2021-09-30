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
            logger.log('error', prepareError(error), 'Test connection instance log');
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
                title: 'Get DB collections names',
                hiddenKeys: connectionInfo.hiddenKeys,
                logger,
            });

            postgresService.setDependencies(app);
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
            logger.log('error', prepareError(error), 'Get DB collections names');
            callback(prepareError(error));
            await postgresService.disconnect();
        }
    },

    async getDbCollectionsData(data, logger, callback, app) {
        try {
            logger.log('info', data, 'Retrieve tables data:', data.hiddenKeys);

            const postgresLogger = createLogger({
                title: 'Get DB collections data log',
                hiddenKeys: data.hiddenKeys,
                logger,
            });

            postgresLogger.progress('Start reverse engineering...');

            const collections = data.collectionData.collections;
            const schemasNames = data.collectionData.dataBaseNames;

            const packages = await Promise.all(
                schemasNames.map(async schemaName => ({
                    schemaName,
                    entities: await postgresService.retrieveEntitiesData(
                        schemaName,
                        collections[schemaName],
                        data.recordSamplingSettings
                    ),
                }))
            ).then(tablesDataPerSchema => {
                return tablesDataPerSchema.flatMap(({ schemaName, entities }) =>
                    entities.map(entityData => ({
                        dbName: schemaName,
                        collectionName: entityData.name,
                        documents: entityData.documents,
                        views: [],
                        emptyBucket: false,
                        entityLevel: entityData.entityLevel,
                        validation: {
                            jsonSchema: entityData.jsonSchema,
                        },
                    }))
                );
            });

            callback(null, packages);
        } catch (error) {
            logger.log('error', prepareError(error), 'Retrieve tables data');
            callback(prepareError(error));
        } finally {
            await postgresService.disconnect();
        }
    },
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

const prepareError = error => {
    error = JSON.stringify(error, Object.getOwnPropertyNames(error));
    error = JSON.parse(error);
    return error;
};
