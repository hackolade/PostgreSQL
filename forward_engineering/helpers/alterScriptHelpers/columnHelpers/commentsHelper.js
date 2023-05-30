const {AlterScriptDto} = require("../types/AlterScriptDto");

/**
 * @return {(collection: Object) => AlterScriptDto[]}
 * */
const getUpdatedCommentOnColumnScriptDtos = (_, ddlProvider) => (collection) => {
    const {getFullColumnName, wrapComment} = require('../../../utils/general')(_);
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
            return ddlProvider.updateColumnComment(columnName, ddlComment);
        })
        .map(script => AlterScriptDto.getInstance([script], true, false));
}

/**
 * @return {(collection: Object) => AlterScriptDto[]}
 * */
const getDeletedCommentOnColumnScriptDtos = (_, ddlProvider) => (collection) => {
    const {getFullColumnName} = require('../../../utils/general')(_);

    return _.toPairs(collection.properties)
        .filter(([name, jsonSchema]) => {
            const newComment = jsonSchema.description;
            const oldName = jsonSchema.compMod.oldField.name;
            const oldComment = collection.role.properties[oldName]?.description;
            return oldComment && !newComment;
        })
        .map(([name, jsonSchema]) => {
            const columnName = getFullColumnName(collection, name);
            return ddlProvider.dropColumnComment(columnName);
        })
        .map(script => AlterScriptDto.getInstance([script], true, true));
}

/**
 * @return {(collection: Object) => AlterScriptDto[]}
 * */
const getModifiedCommentOnColumnScriptDtos = (_, ddlProvider) => (collection) => {
    const updatedCommentScripts = getUpdatedCommentOnColumnScriptDtos(_, ddlProvider)(collection);
    const deletedCommentScripts = getDeletedCommentOnColumnScriptDtos(_, ddlProvider)(collection);
    return [...updatedCommentScripts, ...deletedCommentScripts];
}

module.exports = {
    getModifiedCommentOnColumnScriptDtos
}
