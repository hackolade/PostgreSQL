const postgresService = require('../reverse_engineering/helpers/postgresService');

const applyToInstance = async (connectionInfo, logger, app) => {
	try {
		postgresService.setDependencies(app);
		await postgresService.connect(connectionInfo, logger);
		await postgresService.logVersion();
		await postgresService.applyScript(removeCreateDbScript(connectionInfo.script));
	} catch (error) {
		logger.error(error);
		throw prepareError(error);
	}
};

const removeCreateDbScript = script => {
	const createDbScriptRegexp = /CREATE DATABASE[^;]*;/gi;

	return script.replace(createDbScriptRegexp, '');
};

const prepareError = error => {
	error = JSON.stringify(error, Object.getOwnPropertyNames(error));
	error = JSON.parse(error);
	return error;
};

module.exports = { applyToInstance };
