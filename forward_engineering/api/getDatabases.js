const reApi = require('../../reverse_engineering/api');

function getDatabases(connectionInfo, logger, callback, app) {
	logger.progress({ message: 'Find all databases' });

	reApi.getDatabases(connectionInfo, logger, callback, app);
}

module.exports = {
	getDatabases,
};
