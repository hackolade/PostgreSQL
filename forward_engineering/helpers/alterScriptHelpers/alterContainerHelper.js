const {getModifySchemaCommentsScriptDtos} = require("./containerHelpers/commentsHelper");
const {AlterScriptDto} = require("./types/AlterScriptDto");

/**
 * @return {(containerName: string) => AlterScriptDto}
 * */
const getAddContainerScriptDto = (app) => (containerName) => {
	const _ = app.require('lodash');
	const ddlProvider = require('../../ddlProvider')(null, null, app);
	const {wrapInQuotes} = require('../../utils/general')(_);
	const script = ddlProvider.createSchemaOnly(wrapInQuotes(containerName));
	return AlterScriptDto.getInstance([script], true, false);
};

/**
 * @return {(containerName: string) => AlterScriptDto}
 * */
const getDeleteContainerScriptDto = (app) => (containerName) => {
	const _ = app.require('lodash');
	const ddlProvider = require('../../ddlProvider')(null, null, app);
	const {wrapInQuotes} = require('../../utils/general')(_);

	const script = ddlProvider.dropSchema(wrapInQuotes(containerName));
	return AlterScriptDto.getInstance([script], true, true);
};

/**
 * @return {(container: Object) => Array<AlterScriptDto>}
 * */
const getModifyContainerScriptDtos = (app) => (container) => {
	const _ = app.require('lodash');
	const ddlProvider = require('../../ddlProvider')(null, null, app);

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
