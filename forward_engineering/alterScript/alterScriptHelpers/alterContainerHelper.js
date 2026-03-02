const _ = require('lodash');
const { getModifySchemaCommentsScriptDtos } = require('./containerHelpers/commentsHelper');
const { AlterScriptDto, SCRIPT_TYPE } = require('../types/AlterScriptDto');
const assignTemplates = require('../../utils/assignTemplates');
const templates = require('../../ddlProvider/templates');
const { wrapInQuotes, getId } = require('../../utils/general');
const { isObjectInDeltaModelActivated } = require('../../utils/general');

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
 * @return {AlterScriptDto | undefined}
 * */
const dropSchema = schemaName => {
	const templateConfig = {
		schemaName,
	};
	return assignTemplates(templates.dropSchema, templateConfig);
};

/**
 * @param {string} containerName
 * @param {boolean} isActivated
 * @return {AlterScriptDto | undefined}
 * */
const getAddContainerScriptDto = (containerName, jsonSchema) => {
	const isActivated = isObjectInDeltaModelActivated(jsonSchema) ?? true;
	const script = createSchemaOnly(wrapInQuotes(containerName));
	return AlterScriptDto.getInstance(script, isActivated, false, SCRIPT_TYPE.createContainer, getId(jsonSchema));
};

/**
 * @param {string} containerName
 * @param {boolean} isActivated
 * @return {AlterScriptDto | undefined}
 * */
const getDeleteContainerScriptDto = (containerName, jsonSchema) => {
	const isActivated = isObjectInDeltaModelActivated(jsonSchema) ?? true;
	const script = dropSchema(wrapInQuotes(containerName));
	return AlterScriptDto.getInstance(script, isActivated, true, SCRIPT_TYPE.dropContainer, getId(jsonSchema));
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
