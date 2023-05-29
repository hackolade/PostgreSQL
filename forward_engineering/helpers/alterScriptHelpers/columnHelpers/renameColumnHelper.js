const {getFullTableName} = require("../ddlHelper");
const {AlterScriptDto} = require("../types/AlterScriptDto");

/**
 * @return {(collection: Object) => AlterScriptDto[]}
 * */
const getRenameColumnScriptDtos = (_, ddlProvider) => (collection) => {
    const fullTableName = getFullTableName(_)(collection);
    const {wrapInQuotes} = require('../../general')({_});
    const {checkFieldPropertiesChanged} = require('../../../utils/general')(_);

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
