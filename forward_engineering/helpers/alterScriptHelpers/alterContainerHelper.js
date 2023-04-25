const {getModifySchemaCommentsScripts} = require("./containerHelpers/commentsHelper");
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

/**
 * @return (collection: Object) => Array<string>
 * */
const getModifyContainerScript = (app) => (container) => {
	const _ = app.require('lodash');
	const ddlProvider = require('../../ddlProvider')(null, null, app);

	const modifyCommentScripts = getModifySchemaCommentsScripts(_, ddlProvider)(container);

	return [
		...modifyCommentScripts
	];
}

module.exports = {
	getAddContainerScript,
	getDeleteContainerScript,
	getModifyContainerScript
};
