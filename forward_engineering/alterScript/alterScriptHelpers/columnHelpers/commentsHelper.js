const _ = require('lodash');
const { AlterScriptDto, SCRIPT_TYPE } = require('../../types/AlterScriptDto');
const {
	getFullColumnName,
	wrapComment,
	isObjectInDeltaModelActivated,
	isParentContainerActivated,
	getId,
} = require('../../../utils/general');
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
	const isContainerActivated = isParentContainerActivated(collection);
	const isCollectionActivated = isObjectInDeltaModelActivated(collection);
	return _.toPairs(collection.properties)
		.filter(([name, jsonSchema]) => {
			const newComment = jsonSchema.description;
			const oldName = jsonSchema.compMod?.oldField?.name || name;
			const oldComment = collection.role.properties[oldName]?.description;
			return newComment && (!oldComment || newComment !== oldComment);
		})
		.map(([name, jsonSchema]) => {
			const newComment = jsonSchema.description;
			const ddlComment = wrapComment(newComment);
			const columnName = getFullColumnName(collection, name);
			const isActivated = isContainerActivated && isCollectionActivated && jsonSchema.isActivated;
			const script = updateColumnComment(columnName, ddlComment);
			return AlterScriptDto.getInstance(script, isActivated, false, SCRIPT_TYPE.alterEntity, getId(collection));
		});
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
	const isContainerActivated = isParentContainerActivated(collection);
	const isCollectionActivated = isObjectInDeltaModelActivated(collection);
	return _.toPairs(collection.properties)
		.filter(([name, jsonSchema]) => {
			const newComment = jsonSchema.description;
			const oldName = jsonSchema.compMod?.oldField?.name || name;
			const oldComment = collection.role.properties[oldName]?.description;
			return oldComment && !newComment;
		})
		.map(([name, jsonSchema]) => {
			const columnName = getFullColumnName(collection, name);
			const isActivated = isContainerActivated && isCollectionActivated && jsonSchema.isActivated;
			const script = dropColumnComment(columnName);
			return AlterScriptDto.getInstance(script, isActivated, true, SCRIPT_TYPE.alterEntity, getId(collection));
		});
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
