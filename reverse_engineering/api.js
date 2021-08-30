'use strict';

const connectionHelper = require('./helpers/connectionHelper');
const mariadbHelper = require('./helpers/mariadbHelper');

BigInt.prototype.toJSON = function () {
	return Number(this.valueOf());
}

const ACCESS_DENIED_ERROR = 1045;

module.exports = {
	async connect(connectionInfo) {
		const connection = await connectionHelper.connect(connectionInfo);

		return connection;
	},

	disconnect(connectionInfo, logger, callback, app) {
		connectionHelper.close();
		
		callback();
	},

	async testConnection(connectionInfo, logger, callback, app) {
		const log = createLogger({
			title: 'Test connection',
			hiddenKeys: connectionInfo.hiddenKeys,
			logger,
		});

		try {
			logger.clear();
			logger.log('info', connectionInfo, 'connectionInfo', connectionInfo.hiddenKeys);

			const connection = await this.connect(connectionInfo);
			await connection.ping();

			log.info('Connected successfully');

			callback(null);
		} catch(error) {
			log.error(error);
			if (error.errno === ACCESS_DENIED_ERROR) {
				callback({ message: `Access denied for user "${connectionInfo.userName}". Please, check whether the password is correct and the user has enough permissions to connect to the database server.`, stack: error.stack });
			} else {
				callback({ message: error.message, stack: error.stack });
			}
		}
	},

	async getDbCollectionsNames(connectionInfo, logger, callback, app) {
		const log = createLogger({
			title: 'Retrieving databases and tables information',
			hiddenKeys: connectionInfo.hiddenKeys,
			logger,
		});

		try {
			logger.clear();
			logger.log('info', connectionInfo, 'connectionInfo', connectionInfo.hiddenKeys);
			const systemDatabases = connectionInfo.includeSystemCollection ? [] : ['information_schema', 'mysql', 'performance_schema'];

			const connection = await this.connect(connectionInfo);
			const databases = connectionInfo.databaseName ? [connectionInfo.databaseName] : await connectionHelper.getDatabases(connection, systemDatabases);
			
			const collections = await databases.reduce(async (next, dbName) => {
				const result = await next;
				try {
					const entities = await connectionHelper.getTables(connection, dbName);
					const dbCollections = getDbCollectionNames(entities, dbName, connectionInfo.includeSystemCollection);

					return result.concat({
						dbName,
						dbCollections,
						isEmpty: dbCollections.length === 0,
					});
				} catch (error) {
					log.info(`Error reading database "${dbName}"`);
					log.error(error);

					return result.concat({
						dbName,
						dbCollections: [],
						isEmpty: true,
						status: true,
					});
				}
			}, Promise.resolve([]));

			log.info('Names retrieved successfully');

			callback(null, collections);
		} catch(error) {
			log.error(error);
			callback({ message: error.message, stack: error.stack });
		}
	},

	async getDbCollectionsData(data, logger, callback, app) {
		const _ = app.require('lodash');
		const async = app.require('async');
		const log = createLogger({
			title: 'Reverse-engineering process',
			hiddenKeys: data.hiddenKeys,
			logger,
		});

		try {
			logger.log('info', data, 'data', data.hiddenKeys);

			const collections = data.collectionData.collections;
			const dataBaseNames = data.collectionData.dataBaseNames;
			const connection = await this.connect(data);
			const instance = await connectionHelper.createInstance(connection, logger); 

			log.info('MariaDB version: ' + connection.serverVersion());
			log.progress('Start reverse engineering ...');			

			const result = await async.mapSeries(dataBaseNames, async (dbName) => {
				const tables = (collections[dbName] || []).filter(name => !isViewName(name));
				const views = (collections[dbName] || []).filter(isViewName).map(getViewName);
	
				log.info(`Parsing database "${dbName}"`);
				log.progress(`Parsing database "${dbName}"`, dbName);			

				const containerData = mariadbHelper.parseDatabaseStatement(
					await instance.describeDatabase(dbName)
				);

				log.info(`Parsing functions`);
				log.progress(`Parsing functions`, dbName);	

				const UDFs = mariadbHelper.parseFunctions(
					await instance.getFunctions(dbName)
				);

				log.info(`Parsing procedures`);
				log.progress(`Parsing procedures`, dbName);

				const Procedures = mariadbHelper.parseProcedures(
					await instance.getProcedures(dbName)
				);

				const result = await async.mapSeries(tables, async (tableName) => {
					log.info(`Get columns "${tableName}"`);
					log.progress(`Get columns`, dbName, tableName);

					const columns = await instance.getColumns(dbName, tableName);
					let records = [];
					
					if (containsJson(columns)) {
						log.info(`Sampling table "${tableName}"`);
						log.progress(`Sampling table`, dbName, tableName);
	
						const count = await instance.getCount(dbName, tableName);
						records = await instance.getRecords(dbName, tableName, getLimit(count, data.recordSamplingSettings));
					}
					
					log.info(`Get create table statement "${tableName}"`);
					log.progress(`Get create table statement`, dbName, tableName);

					const ddl = await instance.showCreateTable(dbName, tableName);

					log.info(`Get indexes "${tableName}"`);
					log.progress(`Get indexes`, dbName, tableName);

					const indexes = await instance.getIndexes(dbName, tableName);

					log.info(`Get constraints "${tableName}"`);
					log.progress(`Get constraints`, dbName, tableName);

					const constraints = await instance.getConstraints(dbName, tableName);
					const jsonSchema = mariadbHelper.getJsonSchema({ columns, constraints, records, indexes });
					const Indxs = mariadbHelper.parseIndexes(indexes);

					log.info(`Data retrieved successfully "${tableName}"`);
					log.progress(`Data retrieved successfully`, dbName, tableName);

					return {
						dbName: dbName,
						collectionName: tableName,
						entityLevel: {
							Indxs,
						},
						documents: records,
						views: [],
						standardDoc: records[0],
						ddl: {
							script: ddl,
							type: 'mariadb'
						},
						emptyBucket: false,
						validation: {
							jsonSchema
						},
						bucketInfo: {
							...containerData,
							UDFs,
							Procedures,
						},
					};
				});
				
				const viewData = await async.mapSeries(views, async (viewName) => {
					log.info(`Getting data from view "${viewName}"`);
					log.progress(`Getting data from view`, dbName, viewName);

					const ddl = await instance.showCreateView(dbName, viewName);

					return {
						name: viewName,
						ddl: {
							script: ddl,
							type: 'mariadb'
						}
					};
				});

				if (viewData.length) {
					return [...result, {
						dbName: dbName,
						views: viewData,
						emptyBucket: false,
					}];
				}
				
				return result;
			});


			callback(null, result.flat());
		} catch(error) {
			log.error(error);
			callback({ message: error.message, stack: error.stack });
		}
	},
};

const createLogger = ({ title, logger, hiddenKeys }) => {
	return {
		info(message) {
			logger.log('info', { message }, title, hiddenKeys);
		},

		progress(message, dbName = '', tableName = '') {
			logger.progress({ message, containerName: dbName, entityName: tableName });
		},

		error(error) {
			logger.log('error', {
				message: error.message,
				stack: error.stack,
			}, title);
		}
	};
};

const getDbCollectionNames = (entities, dbName, includeSystemCollection) => {
	const isView = (type) => {
		return ['VIEW'].includes(type);
	};

	return entities.filter(table => {
		if (table['Table_type'] === 'SYSTEM VIEW') {
			return false;
		}

		if (includeSystemCollection) {
			return true;
		}

		const isSystem = !['BASE TABLE', 'VIEW', 'SEQUENCE'].includes(table['Table_type']);

		return !isSystem;
	}).map(table => {
		const name = table[`Tables_in_${dbName}`];

		if (isView(table['Table_type'])) {
			return `${name} (v)`;
		} else {
			return name;
		}
	});
};

const getLimit = (count, recordSamplingSettings) => {
	const per = recordSamplingSettings.relative.value;
	const size = (recordSamplingSettings.active === 'absolute')
		? recordSamplingSettings.absolute.value
		: Math.round(count / 100 * per);
	return size;
};

const isViewName = (name) => {
	return /\ \(v\)$/i.test(name);
};

const getViewName = (name) => name.replace(/\ \(v\)$/i, '');

const containsJson = (columns) => {
	return columns.some(column => column['Type'] === 'longtext' || column['Type'] === 'json');
};
