const createLogger = ({ title, logger, hiddenKeys }) => {
	return {
		info(message, additionalData = {}) {
			logger.log('info', { message, ...additionalData }, title, hiddenKeys);
		},

		progress(message, dbName = '', tableName = '') {
			logger.progress({ message, containerName: dbName, entityName: tableName });
		},

		error(error) {
			logger.log('error', prepareError(error), title);
		},
	};
};

const prepareError = error => {
	error = JSON.stringify(error, Object.getOwnPropertyNames(error));
	error = JSON.parse(error);
	return error;
};

module.exports = {
	createLogger,
};
