const reApi = require('../../reverse_engineering/api');

function testConnection(connectionInfo, logger, callback, app) {
	reApi.testConnection(connectionInfo, logger, callback, app).then(callback, callback);
}

module.exports = {
	testConnection,
};
