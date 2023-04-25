const reApi = require('../reverse_engineering/api');
const { createLogger } = require('../reverse_engineering/helpers/loggerHelper');
const applyToInstanceHelper = require('./applyToInstanceHelper');
const { commentDropStatements } = require('./helpers/commentDropStatements');
const { DROP_STATEMENTS } = require('./helpers/constants');

module.exports = {
	generateScript(data, logger, callback, app) {
		try {
			const {
				getAlterContainersScripts,
				getAlterCollectionsScripts,
				getAlterViewScripts,
				getAlterModelDefinitionsScripts,
			} = require('./helpers/alterScriptFromDeltaHelper');

			const collection = JSON.parse(data.jsonSchema);
			if (!collection) {
				throw new Error(
					'"comparisonModelCollection" is not found. Alter script can be generated only from Delta model',
				);
			}

			const modelDefinitions = JSON.parse(data.modelDefinitions);
			const internalDefinitions = JSON.parse(data.internalDefinitions);
			const externalDefinitions = JSON.parse(data.externalDefinitions);
			const dbVersion = data.modelData[0]?.dbVersion;
			const containersScripts = getAlterContainersScripts({collection, app});
			const collectionsScripts = getAlterCollectionsScripts({
				collection,
				app,
				dbVersion,
				modelDefinitions,
				internalDefinitions,
				externalDefinitions,
			});
			const viewScripts = getAlterViewScripts(collection, app);
			const modelDefinitionsScripts = getAlterModelDefinitionsScripts({
				collection,
				app,
				dbVersion,
				modelDefinitions,
				internalDefinitions,
				externalDefinitions,
			});
			const script = [
				...containersScripts,
				...modelDefinitionsScripts,
				...collectionsScripts,
				...viewScripts,
			].join('\n\n');

			const applyDropStatements = data.options?.additionalOptions?.some(
				option => option.id === 'applyDropStatements' && option.value,
			);

			callback(null, applyDropStatements ? script : commentDropStatements(script));
		} catch (error) {
			logger.log('error', { message: error.message, stack: error.stack }, 'PostgreSQL Forward-Engineering Error');

			callback({ message: error.message, stack: error.stack });
		}
	},
	generateViewScript(data, logger, callback, app) {
		callback(new Error('Forward-Engineering of delta model on view level is not supported'));
	},
	generateContainerScript(data, logger, callback, app) {
		try {
			data.jsonSchema = data.collections[0];
			data.internalDefinitions = Object.values(data.internalDefinitions)[0];
			this.generateScript(data, logger, callback, app);
		} catch (error) {
			logger.log('error', { message: error.message, stack: error.stack }, 'PostgreSQL Forward-Engineering Error');

			callback({ message: error.message, stack: error.stack });
		}
	},
	getDatabases(connectionInfo, logger, callback, app) {
		logger.progress({ message: 'Find all databases' });

		reApi.getDatabases(connectionInfo, logger, callback, app);
	},
	applyToInstance(connectionInfo, logger, callback, app) {
		logger.clear();
		logger.log(
			'info',
			app.require('lodash').omit(connectionInfo, 'script', 'containerData'),
			'connectionInfo',
			connectionInfo.hiddenKeys,
		);

		const postgresLogger = createLogger({
			title: 'Apply to instance',
			hiddenKeys: connectionInfo.hiddenKeys,
			logger,
		});

		applyToInstanceHelper.applyToInstance(connectionInfo, postgresLogger, app).then(callback, callback);
	},
	testConnection(connectionInfo, logger, callback, app) {
		reApi.testConnection(connectionInfo, logger, callback, app).then(callback, callback);
	},
	isDropInStatements(data, logger, callback, app) {
		try {
			const cb = (error, script = '') =>
				callback(
					error,
					DROP_STATEMENTS.some(statement => script.includes(statement)),
				);

			if (data.level === 'container') {
				this.generateContainerScript(data, logger, cb, app);
			} else {
				this.generateScript(data, logger, cb, app);
			}
		} catch (e) {
			callback({ message: e.message, stack: e.stack });
		}
	},
};
