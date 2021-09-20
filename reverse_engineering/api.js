'use strict';

module.exports = {
	disconnect(connectionInfo, logger, callback, app) {

	},

	async testConnection(connectionInfo, logger, callback, app) {

	},

	async getDbCollectionsNames(connectionInfo, logger, callback, app) {

	},

	async getDbCollectionsData(data, logger, callback, app) {
		
	},
};

const createLogger = ({ title, logger, hiddenKeys }) => {
	return {
		info(message) {
			logger.log('info', { message }, title, hiddenKeys);
		},

		progress(message, dbName = '', tableName = '') {
			logger.progress({ message, containerName: dbName, entityName: tableName });
		},

		error(error) {
			logger.log('error', {
				message: error.message,
				stack: error.stack,
			}, title);
		}
	};
};
