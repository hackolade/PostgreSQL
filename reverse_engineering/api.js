'use strict';

const { createLogger } = require('./helpers/loggerHelper');
const postgresService = require('./helpers/postgresService');

module.exports = {
	async disconnect(connectionInfo, logger, callback, app) {
		await postgresService.disconnect();

		callback();
	},

	async testConnection(connectionInfo, logger, callback, app) {
		try {
			logInfo('Test connection', connectionInfo, logger);

			const postgresLogger = createLogger({
				title: 'Test connection instance log',
				hiddenKeys: connectionInfo.hiddenKeys,
				logger,
			});

			postgresService.setDependencies(app);
			await postgresService.connect(connectionInfo, postgresLogger);
			await postgresService.pingDb();
			await postgresService.logVersion();
			callback();
		} catch (error) {
			logger.log('error', prepareError(error), 'Test connection instance log');
			callback(prepareError(error));
		} finally {
			await postgresService.disconnect();
		}
	},

	async getDatabases(connectionInfo, logger, cb, app) {
		try {
			logInfo('Get databases', connectionInfo, logger);

			const postgresLogger = createLogger({
				title: 'Get DB names',
				hiddenKeys: connectionInfo.hiddenKeys,
				logger,
			});

			postgresService.setDependencies(app);
			await postgresService.connect(connectionInfo, postgresLogger);
			await postgresService.logVersion();

			const dbs = await postgresService.getDatabaseNames();
			logger.log('info', dbs, 'All databases list', connectionInfo.hiddenKeys);
			return cb(null, dbs);
		} catch (err) {
			logger.log('error', err);
			return cb(prepareError(err));
		}
	},

	getDocumentKinds: function (connectionInfo, logger, cb) {
		cb(null, []);
	},

	async getDbCollectionsNames(connectionInfo, logger, callback, app) {
		try {
			logInfo('Get DB table names', connectionInfo, logger);

			const postgresLogger = createLogger({
				title: 'Get DB collections names',
				hiddenKeys: connectionInfo.hiddenKeys,
				logger,
			});

			postgresService.setDependencies(app);
			await postgresService.connect(connectionInfo, postgresLogger);
			await postgresService.logVersion();
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

			const modelData = await postgresService.getDbLevelData();

			const { packages, relationships } = await Promise.all(
				schemasNames.map(async schemaName => {
					const { tables, views, modelDefinitions } = await postgresService.retrieveEntitiesData(
						schemaName,
						collections[schemaName],
						data.recordSamplingSettings,
						data.includePartitions,
						data.ignoreUdfUdpTriggers,
					);
					const { functions, procedures, triggers, sequences } =
						await postgresService.retrieveSchemaLevelData(schemaName, data.ignoreUdfUdpTriggers);

					postgresLogger.progress('Schema data fetched successfully', schemaName);

					return {
						schemaName,
						tables,
						views,
						functions,
						procedures,
						modelDefinitions,
						triggers,
						sequences,
					};
				}),
			)
				.then(schemaData => {
					const relationships = schemaData
						.flatMap(({ tables }) => tables.map(entityData => entityData.relationships))
						.flat();

					const packages = schemaData.flatMap(
						({
							schemaName,
							tables,
							views,
							functions,
							procedures,
							triggers,
							modelDefinitions,
							sequences,
						}) => {
							const bucketInfo = {
								UDFs: functions,
								Procedures: procedures,
								triggers,
								sequences,
							};

							const tablePackages = tables
								.map(entityData => ({
									dbName: schemaName,
									collectionName: entityData.name,
									documents: entityData.documents,
									views: [],
									emptyBucket: false,
									entityLevel: entityData.entityLevel,
									validation: {
										jsonSchema: entityData.jsonSchema,
									},
									bucketInfo,
									modelDefinitions,
								}))
								.sort(data => (app.require('lodash').isEmpty(data.entityLevel.inherits) ? -1 : 1));

							if (views?.length) {
								const viewPackage = {
									dbName: schemaName,
									views: views,
									emptyBucket: false,
								};

								return [...tablePackages, viewPackage];
							}

							return tablePackages;
						},
					);
					return { packages, relationships };
				})
				.then(({ packages, relationships }) => ({ packages: orderPackages(packages), relationships }));

			postgresLogger.info('The data is processed and sent to the application', {
				packagesLength: packages?.length,
				relationshipsLength: relationships?.length,
			});
			callback(null, packages, modelData, relationships);
		} catch (error) {
			logger.log('error', prepareError(error), 'Retrieve tables data');
			callback(prepareError(error));
		} finally {
			await postgresService.disconnect();
		}
	},
};

const prepareError = error => {
	error = JSON.stringify(error, Object.getOwnPropertyNames(error));
	error = JSON.parse(error);
	return error;
};

const logInfo = (step, connectionInfo, logger) => {
	logger.clear();
	logger.log('info', connectionInfo, 'connectionInfo', connectionInfo.hiddenKeys);
};

const orderPackages = packages => {
	return packages.sort((packA, packB) => {
		if (!packA.collectionName && !packB.collectionName) {
			return 0;
		} else if (!packA.collectionName) {
			return 1;
		} else if (!packB.collectionName) {
			return -1;
		} else {
			return packA.collectionName.localeCompare(packB.collectionName);
		}
	});
};
