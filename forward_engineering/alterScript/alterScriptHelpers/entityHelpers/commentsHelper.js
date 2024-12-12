const _ = require('lodash');
const { AlterScriptDto } = require('../../types/AlterScriptDto');
const { AlterCollectionDto } = require('../../types/AlterCollectionDto');
const { getFullTableName, wrapComment } = require('../../../utils/general');
const assignTemplates = require('../../../utils/assignTemplates');
const templates = require('../../../ddlProvider/templates');

/**
 * @param {string} tableName
 * @param {string} comment
 * @return string
 * */
const updateTableComment = (tableName, comment) => {
	const templateConfig = {
		tableName,
		comment,
	};
	return assignTemplates(templates.updateCommentOnTable, templateConfig);
};

/**
 * @param {AlterCollectionDto} collection
 * @return {AlterScriptDto}
 */
const getUpdatedCommentOnCollectionScriptDto = collection => {
	const descriptionInfo = collection?.role.compMod?.description;
	if (!descriptionInfo) {
		return undefined;
	}

	const { old: oldComment, new: newComment } = descriptionInfo;
	if (!newComment || newComment === oldComment) {
		return undefined;
	}

	const tableName = getFullTableName(collection);
	const comment = wrapComment(newComment);

	const script = updateTableComment(tableName, comment);
	return AlterScriptDto.getInstance([script], true, false);
};

/**
 * @param {string} tableName
 * @return string
 * */
const dropTableComment = tableName => {
	const templateConfig = {
		tableName,
		comment: 'NULL',
	};
	return assignTemplates(templates.updateCommentOnTable, templateConfig);
};

/**
 * @param {AlterCollectionDto} collection
 * @return {AlterScriptDto}
 */
const getDeletedCommentOnCollectionScriptDto = collection => {
	const descriptionInfo = collection?.role.compMod?.description;
	if (!descriptionInfo) {
		return undefined;
	}

	const { old: oldComment, new: newComment } = descriptionInfo;
	if (!oldComment || newComment) {
		return undefined;
	}

	const tableName = getFullTableName(collection);

	const script = dropTableComment(tableName);
	return AlterScriptDto.getInstance([script], true, true);
};

/**
 * @param {AlterCollectionDto} collection
 * @return {Array<AlterScriptDto>}
 * */
const getModifyEntityCommentsScriptDtos = collection => {
	const updatedCommentScript = getUpdatedCommentOnCollectionScriptDto(collection);
	const deletedCommentScript = getDeletedCommentOnCollectionScriptDto(collection);

	return [updatedCommentScript, deletedCommentScript].filter(Boolean);
};

module.exports = {
	getModifyEntityCommentsScriptDtos,
};
