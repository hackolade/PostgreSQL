const {
	doesContainerLevelAlterScriptContainDropStatements,
	doesEntityLevelAlterScriptContainDropStatements,
} = require('../alterScript/alterScriptBuilder');

function isDropInStatements(data, logger, callback, app) {
	try {
		if (data.level === 'container') {
			const containsDropStatements = doesContainerLevelAlterScriptContainDropStatements(data, app);
			callback(null, containsDropStatements);
		} else {
			const containsDropStatements = doesEntityLevelAlterScriptContainDropStatements(data, app);
			callback(null, containsDropStatements);
		}
	} catch (e) {
		callback({ message: e.message, stack: e.stack });
	}
}

module.exports = {
	isDropInStatements,
};
