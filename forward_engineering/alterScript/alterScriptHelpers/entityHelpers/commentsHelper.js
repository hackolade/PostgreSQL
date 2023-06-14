const {AlterScriptDto} = require("../../types/AlterScriptDto");
const {AlterCollectionDto} = require('../../types/AlterCollectionDto');

/**
 * @return {(collection: AlterCollectionDto) => AlterScriptDto}
 */
const getUpdatedCommentOnCollectionScriptDto = (_, ddlProvider) => (collection) => {
    const {getFullTableName, wrapComment} = require('../../../utils/general')(_);

    const descriptionInfo = collection?.role.compMod?.description;
    if (!descriptionInfo) {
        return undefined;
    }

    const {old: oldComment, new: newComment} = descriptionInfo;
    if (!newComment || newComment === oldComment) {
        return undefined;
    }

    const tableName = getFullTableName(collection);
    const comment = wrapComment(newComment);

    const script = ddlProvider.updateTableComment(tableName, comment);
    return AlterScriptDto.getInstance([script], true, false);
}

/**
 * @return {(collection: AlterCollectionDto) => AlterScriptDto}
 */
const getDeletedCommentOnCollectionScriptDto = (_, ddlProvider) => (collection) => {
    const {getFullTableName} = require('../../../utils/general')(_);

    const descriptionInfo = collection?.role.compMod?.description;
    if (!descriptionInfo) {
        return undefined;
    }

    const {old: oldComment, new: newComment} = descriptionInfo;
    if (!oldComment || newComment) {
        return undefined;
    }

    const tableName = getFullTableName(collection);

    const script = ddlProvider.dropTableComment(tableName);
    return AlterScriptDto.getInstance([script], true, true);
}

/**
 * @return {(collection: AlterCollectionDto) => Array<AlterScriptDto>}
 * */
const getModifyEntityCommentsScriptDtos = (_, ddlProvider) => collection => {
    const updatedCommentScript = getUpdatedCommentOnCollectionScriptDto(_, ddlProvider)(collection);
    const deletedCommentScript = getDeletedCommentOnCollectionScriptDto(_, ddlProvider)(collection);

    return [
        updatedCommentScript,
        deletedCommentScript
    ].filter(Boolean);
};

module.exports = {
    getModifyEntityCommentsScriptDtos
}
