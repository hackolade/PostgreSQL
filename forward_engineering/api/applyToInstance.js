const _ = require('lodash');
const { createLogger } = require('../../reverse_engineering/helpers/loggerHelper');
const applyToInstanceHelper = require('../applyToInstanceHelper');

function applyToInstance(connectionInfo, logger, callback, app) {
	logger.clear();
	logger.log('info', _.omit(connectionInfo, 'script', 'containerData'), 'connectionInfo', connectionInfo.hiddenKeys);

	const postgresLogger = createLogger({
		title: 'Apply to instance',
		hiddenKeys: connectionInfo.hiddenKeys,
		logger,
	});

	applyToInstanceHelper.applyToInstance(connectionInfo, postgresLogger, app).then(callback, callback);
}

module.exports = {
	applyToInstance,
};
