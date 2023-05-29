const {AlterScriptDto} = require("../types/AlterScriptDto");

/**
 * @return {(collection: Object) => AlterScriptDto[]}
 * */
const getRenameColumnScriptDtos = (_, ddlProvider) => (collection) => {
    const {checkFieldPropertiesChanged, getFullTableName} = require('../../../utils/general')(_);
    const fullTableName = getFullTableName(collection);
    const {wrapInQuotes} = require('../../general')({_});

    return _.values(collection.properties)
        .filter(jsonSchema => checkFieldPropertiesChanged(jsonSchema.compMod, ['name']))
        .map(
            jsonSchema => {
                const oldColumnName = wrapInQuotes(jsonSchema.compMod.oldField.name);
                const newColumnName = wrapInQuotes(jsonSchema.compMod.newField.name);
                return ddlProvider.renameColumn(fullTableName, oldColumnName, newColumnName);
            }
        )
        .map(script => AlterScriptDto.getInstance([script], true, false));
}

module.exports = {
    getRenameColumnScriptDtos
}
