const _ = require('lodash');
const { AlterScriptDto } = require('../../types/AlterScriptDto');
const { getFullColumnName, wrapComment } = require('../../../utils/general');
const assignTemplates = require('../../../utils/assignTemplates');
const templates = require('../../../ddlProvider/templates');

/**
 * @param columnName {string}
 * @param comment {string}
 * @return string
 * */
const updateColumnComment = (columnName, comment) => {
	const templateConfig = {
		columnName,
		comment,
	};
	return assignTemplates(templates.updateCommentOnColumn, templateConfig);
};

/**
 * @param {Object} collection
 * @return {AlterScriptDto[]}
 * */
const getUpdatedCommentOnColumnScriptDtos = collection => {
	return _.toPairs(collection.properties)
		.filter(([name, jsonSchema]) => {
			const newComment = jsonSchema.description;
			const oldName = jsonSchema.compMod.oldField.name;
			const oldComment = collection.role.properties[oldName]?.description;
			return newComment && (!oldComment || newComment !== oldComment);
		})
		.map(([name, jsonSchema]) => {
			const newComment = jsonSchema.description;
			const ddlComment = wrapComment(newComment);
			const columnName = getFullColumnName(collection, name);
			return updateColumnComment(columnName, ddlComment);
		})
		.map(script => AlterScriptDto.getInstance([script], true, false));
};

/**
 * @param columnName {string}
 * @return string
 * */
const dropColumnComment = columnName => {
	const templateConfig = {
		columnName,
		comment: 'NULL',
	};
	return assignTemplates(templates.updateCommentOnColumn, templateConfig);
};

/**
 * @param {Object} collection
 * @return {AlterScriptDto[]}
 * */
const getDeletedCommentOnColumnScriptDtos = collection => {
	return _.toPairs(collection.properties)
		.filter(([name, jsonSchema]) => {
			const newComment = jsonSchema.description;
			const oldName = jsonSchema.compMod.oldField.name;
			const oldComment = collection.role.properties[oldName]?.description;
			return oldComment && !newComment;
		})
		.map(([name, jsonSchema]) => {
			const columnName = getFullColumnName(collection, name);
			return dropColumnComment(columnName);
		})
		.map(script => AlterScriptDto.getInstance([script], true, true));
};

/**
 * @param {Object} collection
 * @return {AlterScriptDto[]}
 * */
const getModifiedCommentOnColumnScriptDtos = collection => {
	const updatedCommentScripts = getUpdatedCommentOnColumnScriptDtos(collection);
	const deletedCommentScripts = getDeletedCommentOnColumnScriptDtos(collection);
	return [...updatedCommentScripts, ...deletedCommentScripts];
};

module.exports = {
	getModifiedCommentOnColumnScriptDtos,
};
