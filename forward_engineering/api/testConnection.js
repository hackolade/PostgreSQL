const reApi = require('../../reverse_engineering/api');

async function testConnection(connectionInfo, logger, callback, app) {
	await reApi.testConnection(connectionInfo, logger, callback, app);
}

module.exports = {
	testConnection,
};
