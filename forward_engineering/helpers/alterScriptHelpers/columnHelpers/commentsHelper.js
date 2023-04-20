const {getFullColumnName} = require("../entityHelpers/ddlHelper");

const getUpdatedCommentOnColumnScripts = (_, ddlProvider) => (collection) => {
    const {wrapComment} = require('../../general')({_});
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
            const columnName = getFullColumnName(_)(collection, name);
            return ddlProvider.updateColumnComment(columnName, ddlComment);
        });
}

const getDeletedCommentOnColumnScripts = (_, ddlProvider) => (collection) => {
    return _.toPairs(collection.properties)
        .filter(([name, jsonSchema]) => {
            const newComment = jsonSchema.description;
            const oldName = jsonSchema.compMod.oldField.name;
            const oldComment = collection.role.properties[oldName]?.description;
            return oldComment && !newComment;
        })
        .map(([name, jsonSchema]) => {
            const columnName = getFullColumnName(_)(collection, name);
            return ddlProvider.dropColumnComment(columnName);
        });
}

const getModifiedCommentOnColumnScripts = (_, ddlProvider) => (collection) => {
    const updatedCommentScripts = getUpdatedCommentOnColumnScripts(_, ddlProvider)(collection);
    const deletedCommentScripts = getDeletedCommentOnColumnScripts(_, ddlProvider)(collection);
    return [...updatedCommentScripts, ...deletedCommentScripts];
}

module.exports = {
    getModifiedCommentOnColumnScripts
}
