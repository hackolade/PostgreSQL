const {getModifyViewCommentsScriptDtos} = require("./viewHelpers/commentsHelper");
const {AlterScriptDto} = require("../types/AlterScriptDto");

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
	const _ = app.require('lodash');
	const ddlProvider = require('../../ddlProvider/ddlProvider')(null, null, app);
	const { wrapInQuotes } = require('../../utils/general')(_);
	const viewName = wrapInQuotes(view.code || view.name);

	const script = ddlProvider.dropView(viewName);
	return AlterScriptDto.getInstance([script], true, true);
};

/**
 * @return {(view: Object) => AlterScriptDto[]}
 * */
const getModifyViewScriptDtos = (app) => (view) => {
	const _ = app.require('lodash');
	const ddlProvider = require('../../ddlProvider/ddlProvider')(null, null, app);

	const modifyCommentsScriptDtos = getModifyViewCommentsScriptDtos(_, ddlProvider)(view);

	return [
		...modifyCommentsScriptDtos,
	].filter(Boolean);
}

module.exports = {
	getAddViewScriptDto,
	getDeleteViewScriptDto,
	getModifyViewScriptDtos,
};
