const getAddViewScript = app => view => {
	const _ = app.require('lodash');
	const ddlProvider = require('../../ddlProvider')(null, null, app);

	const viewData = {
		name: view.code || view.name,
		keys: [],
		schemaData: { schemaName: '' },
	};
	const hydratedView = ddlProvider.hydrateView({ viewData, entityData: [view] });

	return ddlProvider.createView(hydratedView, {}, view.isActivated);
};

const getDeleteViewScript = app => view => {
	const _ = app.require('lodash');
	const { wrapInQuotes } = require('../general')({ _ });
	const viewName = wrapInQuotes(view.code || view.name);

	return `DROP VIEW IF EXISTS ${viewName};`;
};

module.exports = {
	getAddViewScript,
	getDeleteViewScript,
};
