const { AlterScriptDto } = require('../../types/AlterScriptDto');
const { getFullViewName, wrapComment } = require('../../../utils/general');
const assignTemplates = require('../../../utils/assignTemplates');
const templates = require('../../../ddlProvider/templates');

const extractDescription = view => {
	return view?.role?.compMod?.description || {};
};

/**
 * @param {string} viewName
 * @param {string} comment
 * @return string
 * */
const updateViewComment = (viewName, comment) => {
	const templateConfig = {
		viewName,
		comment,
	};
	return assignTemplates(templates.updateCommentOnView, templateConfig);
};

/**
 * @param {string} viewName
 * @return string
 * */
const dropViewComment = viewName => {
	const templateConfig = {
		viewName,
		comment: 'NULL',
	};
	return assignTemplates(templates.updateCommentOnView, templateConfig);
};

/**
 * @param {Object} view
 * @return {AlterScriptDto | undefined}
 * */
const getUpsertCommentsScriptDto = view => {
	const description = extractDescription(view);
	if (description.new && description.new !== description.old) {
		const wrappedComment = wrapComment(description.new);
		const viewName = getFullViewName(view);
		const script = updateViewComment(viewName, wrappedComment);
		return AlterScriptDto.getInstance([script], true, false);
	}
	return undefined;
};

/**
 * @param {Object} view
 * @return {AlterScriptDto | undefined}
 * */
const getDropCommentsScriptDto = view => {
	const description = extractDescription(view);

	if (description.old && !description.new) {
		const viewName = getFullViewName(view);
		const script = dropViewComment(viewName);
		return AlterScriptDto.getInstance([script], true, true);
	}
	return undefined;
};

/**
 * @param {Object} view
 * @return {AlterScriptDto[]}
 * */
const getModifyViewCommentsScriptDtos = view => {
	const upsertCommentScript = getUpsertCommentsScriptDto(view);
	const dropCommentScript = getDropCommentsScriptDto(view);
	return [upsertCommentScript, dropCommentScript].filter(Boolean);
};

module.exports = {
	getModifyViewCommentsScriptDtos,
};
