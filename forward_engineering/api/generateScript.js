const { buildEntityLevelAlterScript } = require('../alterScript/alterScriptBuilder');

function generateScript(data, logger, callback, app) {
	try {
		const script = buildEntityLevelAlterScript(data, app);
		callback(null, script);
	} catch (error) {
		logger.log('error', { message: error.message, stack: error.stack }, 'PostgreSQL Forward-Engineering Error');

		callback({ message: error.message, stack: error.stack });
	}
}

module.exports = {
	generateScript,
};
