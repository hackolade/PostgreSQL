const {getModifyViewCommentsScripts} = require("./viewHelpers/commentsHelper");
/**
 * @return (view: Object) => string
 * */
const getAddViewScript = app => view => {
	const ddlProvider = require('../../ddlProvider')(null, null, app);

	const viewData = {
		name: view.code || view.name,
		keys: [],
		schemaData: { schemaName: '' },
	};
	const hydratedView = ddlProvider.hydrateView({ viewData, entityData: [view] });

	return ddlProvider.createView(hydratedView, {}, view.isActivated);
};

/**
 * @return (view: Object) => string
 * */
const getDeleteViewScript = app => view => {
	const _ = app.require('lodash');
	const ddlProvider = require('../../ddlProvider')(null, null, app);
	const { wrapInQuotes } = require('../general')({ _ });
	const viewName = wrapInQuotes(view.code || view.name);

	return ddlProvider.dropView(viewName);
};

/**
 * @return (view: Object) => Array<string>
 * */
const getModifyViewScript = (app) => (view) => {
	const _ = app.require('lodash');
	const ddlProvider = require('../../ddlProvider')(null, null, app);

	const modifyCommentsScripts = getModifyViewCommentsScripts(_, ddlProvider)(view);

	return [
		...modifyCommentsScripts,
	];
}

module.exports = {
	getAddViewScript,
	getDeleteViewScript,
	getModifyViewScript,
};
