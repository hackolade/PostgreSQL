const _ = require('lodash');
const { AlterScriptDto, SCRIPT_TYPE } = require('../../types/AlterScriptDto');
const { AlterCollectionDto } = require('../../types/AlterCollectionDto');
const {
	getFullTableName,
	wrapComment,
	isObjectInDeltaModelActivated,
	isParentContainerActivated,
	getId,
} = require('../../../utils/general');
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
 * @param {{ collection: AlterCollectionDto, shouldIgnoreTableComments?: boolean }} dto
 * @return {AlterScriptDto}
 */
const getUpdatedCommentOnCollectionScriptDto = ({ collection, shouldIgnoreTableComments = false } = {}) => {
	if (shouldIgnoreTableComments) {
		return undefined;
	}

	const outerDescription = collection?.role.compMod?.description;
	if (!outerDescription) {
		return undefined;
	}

	const firstCompareDescription = collection?.role.role?.compMod?.description;
	if (collection?.role.role && firstCompareDescription == null) {
		return undefined;
	}

	const oldComment = firstCompareDescription?.old ?? outerDescription.old;
	const newComment = outerDescription.new ?? firstCompareDescription?.new;
	if (!newComment || newComment === oldComment) {
		return undefined;
	}

	const tableName = getFullTableName(collection);
	const comment = wrapComment(newComment);

	const isContainerActivated = isParentContainerActivated(collection);
	const isCollectionActivated = isContainerActivated && isObjectInDeltaModelActivated(collection);

	const script = updateTableComment(tableName, comment);
	return AlterScriptDto.getInstance(script, isCollectionActivated, false, SCRIPT_TYPE.alterEntity, getId(collection));
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
 * @param {{ collection: AlterCollectionDto, shouldIgnoreTableComments?: boolean }} dto
 * @return {AlterScriptDto}
 */
const getDeletedCommentOnCollectionScriptDto = ({ collection, shouldIgnoreTableComments = false } = {}) => {
	if (shouldIgnoreTableComments) {
		return undefined;
	}

	const descriptionInfo = collection?.role.compMod?.description;
	if (!descriptionInfo) {
		return undefined;
	}

	const { old: oldComment, new: newComment } = descriptionInfo;
	if (!oldComment || newComment) {
		return undefined;
	}

	const tableName = getFullTableName(collection);

	const isContainerActivated = isParentContainerActivated(collection);
	const isCollectionActivated = isContainerActivated && isObjectInDeltaModelActivated(collection);

	const script = dropTableComment(tableName);
	return AlterScriptDto.getInstance(script, isCollectionActivated, true, SCRIPT_TYPE.alterEntity, getId(collection));
};

/**
 * @param {{ collection: AlterCollectionDto, shouldIgnoreTableComments?: boolean }} dto
 * @return {Array<AlterScriptDto>}
 */
const getModifyEntityCommentsScriptDtos = ({ collection, shouldIgnoreTableComments = false } = {}) => {
	const updatedCommentScript = getUpdatedCommentOnCollectionScriptDto({
		collection,
		shouldIgnoreTableComments,
	});
	const deletedCommentScript = getDeletedCommentOnCollectionScriptDto({
		collection,
		shouldIgnoreTableComments,
	});

	return [updatedCommentScript, deletedCommentScript].filter(Boolean);
};

module.exports = {
	getModifyEntityCommentsScriptDtos,
};
