const reApi = require('../reverse_engineering/api');
const { createLogger } = require('../reverse_engineering/helpers/loggerHelper');
const applyToInstanceHelper = require('./applyToInstanceHelper');

module.exports = {
    applyToInstance(connectionInfo, logger, callback, app) {
        logger.clear();
        logger.log('info', connectionInfo, 'connectionInfo', connectionInfo.hiddenKeys);

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
