const _ = require('lodash');
const { getModifySchemaCommentsScriptDtos } = require('./containerHelpers/commentsHelper');
const { AlterScriptDto } = require('../types/AlterScriptDto');
const assignTemplates = require('../../utils/assignTemplates');
const templates = require('../../ddlProvider/templates');
const { wrapInQuotes } = require('../../utils/general');

/**
 * @param {string} schemaName
 * @return {AlterScriptDto | undefined}
 * */
const createSchemaOnly = schemaName => {
	const templateConfig = {
		schemaName,
	};
	return assignTemplates(templates.createSchemaOnly, templateConfig);
};

/**
 * @param {string} schemaName
 * @return string
 * */
const dropSchema = schemaName => {
	const templateConfig = {
		schemaName,
	};
	return assignTemplates(templates.dropSchema, templateConfig);
};

/**
 * @param {string} containerName
 * @return {AlterScriptDto | undefined}
 * */
const getAddContainerScriptDto = containerName => {
	const script = createSchemaOnly(wrapInQuotes(containerName));
	return AlterScriptDto.getInstance([script], true, false);
};

/**
 * @param {string} containerName
 * @return {AlterScriptDto | undefined}
 * */
const getDeleteContainerScriptDto = containerName => {
	const script = dropSchema(wrapInQuotes(containerName));
	return AlterScriptDto.getInstance([script], true, true);
};

/**
 * @param {Object} container
 * @return {Array<AlterScriptDto>}
 * */
const getModifyContainerScriptDtos = container => {
	const modifyCommentScriptDtos = getModifySchemaCommentsScriptDtos(container);

	return [...modifyCommentScriptDtos];
};

module.exports = {
	getAddContainerScriptDto,
	getDeleteContainerScriptDto,
	getModifyContainerScriptDtos,
};
