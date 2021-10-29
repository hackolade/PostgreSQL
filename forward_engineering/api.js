const reApi = require('../reverse_engineering/api');
const { createLogger, getSystemInfo } = require('../reverse_engineering/helpers/loggerHelper');
const applyToInstanceHelper = require('./applyToInstanceHelper');

module.exports = {
    getDatabases(connectionInfo, logger, callback, app) {
        logger.progress({ message: 'Find all databases' });

        reApi.getDatabases(connectionInfo, logger, callback, app);
    },
    applyToInstance(connectionInfo, logger, callback, app) {
        logger.clear();
        logger.log('info', getSystemInfo(connectionInfo.appVersion), 'Apply to instance');
        logger.log(
            'info',
            app.require('lodash').omit(connectionInfo, 'script', 'containerData'),
            'connectionInfo',
            connectionInfo.hiddenKeys
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
};
