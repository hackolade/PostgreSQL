const {getModifySchemaCommentsScriptDtos} = require("./containerHelpers/commentsHelper");
const {AlterScriptDto} = require("../types/AlterScriptDto");

/**
 * @return {(containerName: string) => AlterScriptDto | undefined}
 * */
const getAddContainerScriptDto = (app) => (containerName) => {
	const _ = app.require('lodash');
	const ddlProvider = require('../../ddlProvider/ddlProvider')(null, null, app);
	const {wrapInQuotes} = require('../../utils/general')(_);
	const script = ddlProvider.createSchemaOnly(wrapInQuotes(containerName));
	return AlterScriptDto.getInstance([script], true, false);
};

/**
 * @return {(containerName: string) => AlterScriptDto | undefined}
 * */
const getDeleteContainerScriptDto = (app) => (containerName) => {
	const _ = app.require('lodash');
	const ddlProvider = require('../../ddlProvider/ddlProvider')(null, null, app);
	const {wrapInQuotes} = require('../../utils/general')(_);

	const script = ddlProvider.dropSchema(wrapInQuotes(containerName));
	return AlterScriptDto.getInstance([script], true, true);
};

/**
 * @return {(container: Object) => Array<AlterScriptDto>}
 * */
const getModifyContainerScriptDtos = (app) => (container) => {
	const _ = app.require('lodash');
	const ddlProvider = require('../../ddlProvider/ddlProvider')(null, null, app);

	const modifyCommentScriptDtos = getModifySchemaCommentsScriptDtos(_, ddlProvider)(container);

	return [
		...modifyCommentScriptDtos
	];
}

module.exports = {
	getAddContainerScriptDto,
	getDeleteContainerScriptDto,
	getModifyContainerScriptDtos
};
