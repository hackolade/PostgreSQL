const _ = require('lodash');
const { getModifyViewCommentsScriptDtos } = require('./viewHelpers/commentsHelper');
const { AlterScriptDto } = require('../types/AlterScriptDto');
const { wrapInQuotes } = require('../../utils/general');

/**
 * @return {(view: Object) => AlterScriptDto | undefined}
 * */
const getAddViewScriptDto = app => view => {
	const ddlProvider = require('../../ddlProvider/ddlProvider')(null, null, app);

	const viewData = {
		name: view.code || view.name,
		keys: [],
		schemaData: { schemaName: '' },
	};
	const hydratedView = ddlProvider.hydrateView({ viewData, entityData: [view] });

	const script = ddlProvider.createView(hydratedView, {}, view.isActivated);
	return AlterScriptDto.getInstance([script], true, false);
};

/**
 * @return {(view: Object) => AlterScriptDto | undefined}
 * */
const getDeleteViewScriptDto = app => view => {
	const ddlProvider = require('../../ddlProvider/ddlProvider')(null, null, app);
	const viewName = wrapInQuotes(view.code || view.name);

	const script = ddlProvider.dropView(viewName);
	return AlterScriptDto.getInstance([script], true, true);
};

/**
 * @param {Object} view
 * @return {AlterScriptDto[]}
 * */
const getModifyViewScriptDtos = view => {
	const modifyCommentsScriptDtos = getModifyViewCommentsScriptDtos(view);

	return [...modifyCommentsScriptDtos].filter(Boolean);
};

module.exports = {
	getAddViewScriptDto,
	getDeleteViewScriptDto,
	getModifyViewScriptDtos,
};
