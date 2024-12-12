const { AlterScriptDto } = require('../../types/AlterScriptDto');
const { wrapComment, wrapInQuotes } = require('../../../utils/general');
const assignTemplates = require('../../../utils/assignTemplates');
const templates = require('../../../ddlProvider/templates');

const extractDescription = container => {
	return container?.role?.compMod?.description || {};
};

/**
 * @param {string} schemaName
 * @param {string} comment
 * @return string
 * */
const updateSchemaComment = (schemaName, comment) => {
	const templateConfig = {
		schemaName,
		comment,
	};
	return assignTemplates(templates.updateCommentOnSchema, templateConfig);
};

/**
 * @param {Object} container
 * @return {AlterScriptDto | undefined}
 * */
const getUpsertCommentsScriptDto = container => {
	const description = extractDescription(container);
	if (description.new && description.new !== description.old) {
		const wrappedComment = wrapComment(description.new);
		const wrappedSchemaName = wrapInQuotes(container.role.name);
		const script = updateSchemaComment(wrappedSchemaName, wrappedComment);
		return AlterScriptDto.getInstance([script], true, false);
	}
	return undefined;
};

/**
 * @param schemaName {string}
 * @return string
 * */
const dropSchemaComment = schemaName => {
	const templateConfig = {
		schemaName,
		comment: 'NULL',
	};
	return assignTemplates(templates.updateCommentOnSchema, templateConfig);
};

/**
 * @param {Object} container
 * @return {AlterScriptDto | undefined}
 * */
const getDropCommentsScriptDto = container => {
	const description = extractDescription(container);
	if (description.old && !description.new) {
		const wrappedSchemaName = wrapInQuotes(container.role.name);
		const script = dropSchemaComment(wrappedSchemaName);
		return AlterScriptDto.getInstance([script], true, true);
	}
	return undefined;
};

/**
 * @param {Object} container
 * @return {AlterScriptDto[]}
 * */
const getModifySchemaCommentsScriptDtos = container => {
	const upsertCommentScript = getUpsertCommentsScriptDto(container);
	const dropCommentScript = getDropCommentsScriptDto(container);
	return [upsertCommentScript, dropCommentScript].filter(Boolean);
};

module.exports = {
	getModifySchemaCommentsScriptDtos,
};
