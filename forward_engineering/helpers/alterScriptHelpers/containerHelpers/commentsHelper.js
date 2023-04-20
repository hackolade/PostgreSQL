
const extractDescription = (container) => {
    return container?.role?.compMod?.description || {};
}

/**
 * @return (container: Object) => string
 * */
const getUpsertCommentsScript = (_, ddlProvider) => (container) => {
    const {wrapComment, wrapInQuotes} = require('../../general')({_});

    const description = extractDescription(container);
    if (description.new && description.new !== description.old) {
        const wrappedComment = wrapComment(description.new);
        const wrappedSchemaName = wrapInQuotes(container.role.name);
        return ddlProvider.updateSchemaComment(wrappedSchemaName, wrappedComment);
    }
    return '';
}

/**
 * @return (container: Object) => string
 * */
const getDropCommentsScript = (_, ddlProvider) => (container) => {
    const {wrapInQuotes} = require('../../general')({_});

    const description = extractDescription(container);
    if (description.old && !description.new) {
        const wrappedSchemaName = wrapInQuotes(container.role.name);
        return ddlProvider.dropSchemaComment(wrappedSchemaName);
    }
    return '';
}

/**
 * @return (container: Object) => Array<string>
 * */
const getModifySchemaCommentsScripts = (_, ddlProvider) => (container) => {
    const upsertCommentScript = getUpsertCommentsScript(_, ddlProvider)(container);
    const dropCommentScript = getDropCommentsScript(_, ddlProvider)(container);
    return [
        upsertCommentScript,
        dropCommentScript
    ].filter(Boolean);
}

module.exports = {
    getModifySchemaCommentsScripts
}
