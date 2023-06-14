const {AlterScriptDto} = require("../../types/AlterScriptDto");

const extractDescription = (container) => {
    return container?.role?.compMod?.description || {};
}

/**
 * @return {(collection: Object) => AlterScriptDto | undefined}
 * */
const getUpsertCommentsScriptDto = (_, ddlProvider) => (container) => {
    const {wrapComment, wrapInQuotes} = require('../../../utils/general')(_);

    const description = extractDescription(container);
    if (description.new && description.new !== description.old) {
        const wrappedComment = wrapComment(description.new);
        const wrappedSchemaName = wrapInQuotes(container.role.name);
        const script = ddlProvider.updateSchemaComment(wrappedSchemaName, wrappedComment);
        return AlterScriptDto.getInstance([script], true, false);
    }
    return undefined;
}

/**
 * @return {(collection: Object) => AlterScriptDto | undefined}
 * */
const getDropCommentsScriptDto = (_, ddlProvider) => (container) => {
    const {wrapInQuotes} = require('../../../utils/general')(_);

    const description = extractDescription(container);
    if (description.old && !description.new) {
        const wrappedSchemaName = wrapInQuotes(container.role.name);
        const script = ddlProvider.dropSchemaComment(wrappedSchemaName);
        return AlterScriptDto.getInstance([script], true, true);
    }
    return undefined;
}

/**
 * @return {(collection: Object) => AlterScriptDto[]}
 * */
const getModifySchemaCommentsScriptDtos = (_, ddlProvider) => (container) => {
    const upsertCommentScript = getUpsertCommentsScriptDto(_, ddlProvider)(container);
    const dropCommentScript = getDropCommentsScriptDto(_, ddlProvider)(container);
    return [
        upsertCommentScript,
        dropCommentScript
    ].filter(Boolean);
}

module.exports = {
    getModifySchemaCommentsScriptDtos
}
