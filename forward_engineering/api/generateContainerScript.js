const { buildContainerLevelAlterScript } = require('../alterScript/alterScriptBuilder');

function generateContainerScript(data, logger, callback, app) {
	try {
		const script = buildContainerLevelAlterScript(data, app);
		callback(null, script);
	} catch (error) {
		logger.log('error', { message: error.message, stack: error.stack }, 'PostgreSQL Forward-Engineering Error');

		callback({ message: error.message, stack: error.stack });
	}
}

module.exports = {
	generateContainerScript,
};
