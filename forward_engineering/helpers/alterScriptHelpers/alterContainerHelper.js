const getAddContainerScript = (app) => (containerName) => {
	const _ = app.require('lodash');
	const ddlProvider = require('../../ddlProvider')(null, null, app);
	const {wrapInQuotes} = require('../general')({_});
	return ddlProvider.createSchemaOnly(wrapInQuotes(containerName));
};

const getDeleteContainerScript = (app) => (containerName) => {
	const _ = app.require('lodash');
	const ddlProvider = require('../../ddlProvider')(null, null, app);
	const {wrapInQuotes} = require('../general')({_});

	return ddlProvider.dropSchema(wrapInQuotes(containerName));
};

module.exports = {
	getAddContainerScript,
	getDeleteContainerScript,
};
