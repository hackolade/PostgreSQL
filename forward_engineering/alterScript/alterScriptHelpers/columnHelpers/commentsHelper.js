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

/**
 * Studio clears jsonSchema.description on newly added columns so comments cannot be inlined.
 * The original text is kept on collection.role.properties[name].
 *
 * @param {{ jsonSchema: Object, roleProperty: Object }} dto
 * @return {string | undefined}
 */
const getAddedColumnComment = ({ jsonSchema, roleProperty } = {}) => {
	return (
		jsonSchema?.description ||
		jsonSchema?.refDescription ||
		roleProperty?.description ||
		roleProperty?.refDescription
	);
};

/**
 * @param {{ collection: Object, name: string, jsonSchema: Object, shouldIgnoreColumnComments?: boolean }} dto
 * @return {AlterScriptDto | undefined}
 */
const getAddedCommentOnColumnScriptDto = ({
	collection,
	name,
	jsonSchema,
	shouldIgnoreColumnComments = false,
} = {}) => {
	if (shouldIgnoreColumnComments) {
		return undefined;
	}

	const roleProperty = collection?.role?.properties?.[name];
	const comment = getAddedColumnComment({ jsonSchema, roleProperty });
	if (!comment) {
		return undefined;
	}

	const isContainerActivated = isParentContainerActivated(collection) !== false;
	const isCollectionActivated = isObjectInDeltaModelActivated(collection) !== false;
	const isColumnActivated = jsonSchema.isActivated !== false;
	const isActivated = isContainerActivated && isCollectionActivated && isColumnActivated;

	const columnName = getFullColumnName(collection, name);
	const script = updateColumnComment(columnName, wrapComment(comment));
	return AlterScriptDto.getInstance(script, isActivated, false, SCRIPT_TYPE.alterEntity, getId(collection));
};

module.exports = {
	getModifiedCommentOnColumnScriptDtos,
	getAddedCommentOnColumnScriptDto,
};
