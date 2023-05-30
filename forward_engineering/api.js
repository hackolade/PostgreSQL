const reApi = require('../reverse_engineering/api');
const {createLogger} = require('../reverse_engineering/helpers/loggerHelper');
const applyToInstanceHelper = require('./applyToInstanceHelper');
const {
    buildEntityLevelAlterScript,
    buildContainerLevelAlterScript,
    doesContainerLevelAlterScriptContainDropStatements,
    doesEntityLevelAlterScriptContainDropStatements
} = require("./alterScript/alterScriptBuilder");

module.exports = {
    generateScript(data, logger, callback, app) {
        try {
            const script = buildEntityLevelAlterScript(data, app);
            callback(null, script);
        } catch (error) {
            logger.log('error', {message: error.message, stack: error.stack}, 'PostgreSQL Forward-Engineering Error');

            callback({message: error.message, stack: error.stack});
        }
    },

    generateViewScript(data, logger, callback, app) {
        callback(new Error('Forward-Engineering of delta model on view level is not supported'));
    },

    generateContainerScript(data, logger, callback, app) {
        try {
            const script = buildContainerLevelAlterScript(data, app);
            callback(null, script);
        } catch (error) {
            logger.log('error', {message: error.message, stack: error.stack}, 'PostgreSQL Forward-Engineering Error');

            callback({message: error.message, stack: error.stack});
        }
    },

    getDatabases(connectionInfo, logger, callback, app) {
        logger.progress({message: 'Find all databases'});

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
            if (data.level === 'container') {
                const containsDropStatements = doesContainerLevelAlterScriptContainDropStatements(data, app);
                callback(null, containsDropStatements);
            } else {
                const containsDropStatements = doesEntityLevelAlterScriptContainDropStatements(data, app);
                callback(null, containsDropStatements);
            }
        } catch (e) {
            callback({message: e.message, stack: e.stack});
        }
    },
};
