const {getFullTableName} = require("./ddlHelper");

/**
 * @return (collection: Object) => string
 */
const getUpdatedCommentOnCollectionScript = (_, ddlProvider) => (collection) => {
    const {wrapComment} = require('../../general')({_});

    const descriptionInfo = collection?.role.compMod?.description;
    if (!descriptionInfo) {
        return '';
    }

    const {old: oldComment, new: newComment} = descriptionInfo;
    if (!newComment || newComment === oldComment) {
        return '';
    }

    const tableName = getFullTableName(_)(collection);
    const comment = wrapComment(newComment);

    return ddlProvider.updateTableComment(tableName, comment);
}

/**
 * @return (collection: Object) => string
 */
const getDeletedCommentOnCollectionScript = (_, ddlProvider) => (collection) => {
    const descriptionInfo = collection?.role.compMod?.description;
    if (!descriptionInfo) {
        return '';
    }

    const {old: oldComment, new: newComment} = descriptionInfo;
    if (!oldComment || newComment) {
        return '';
    }

    const tableName = getFullTableName(_)(collection);

    return ddlProvider.dropTableComment(tableName);
}

/**
 * @return {(collection: Object) => Array<string>}
 * */
const getModifyEntityCommentsScripts = (_, ddlProvider) => collection => {
    const updatedCommentScript = getUpdatedCommentOnCollectionScript(_, ddlProvider)(collection);
    const deletedCommentScript = getDeletedCommentOnCollectionScript(_, ddlProvider)(collection);

    return [
        updatedCommentScript,
        deletedCommentScript
    ].filter(Boolean);
};

module.exports = {
    getModifyEntityCommentsScripts
}
