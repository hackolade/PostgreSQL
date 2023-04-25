const {getFullTableName} = require("../ddlHelper");
const {checkFieldPropertiesChanged} = require("../common");

const getRenameColumnScripts = (_, ddlProvider) => (collection) => {
    const fullTableName = getFullTableName(_)(collection);
    const {wrapInQuotes} = require('../../general')({_});

    return _.values(collection.properties)
        .filter(jsonSchema => checkFieldPropertiesChanged(jsonSchema.compMod, ['name']))
        .map(
            jsonSchema => {
                const oldColumnName = wrapInQuotes(jsonSchema.compMod.oldField.name);
                const newColumnName = wrapInQuotes(jsonSchema.compMod.newField.name);
                return ddlProvider.renameColumn(fullTableName, oldColumnName, newColumnName);
            }
        );
}

module.exports = {
    getRenameColumnScripts
}
