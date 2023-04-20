const {getFullTableName} = require("../ddlHelper");

const getModifyNonNullColumnsScripts = (_, ddlProvider) => (collection) => {
    const fullTableName = getFullTableName(_)(collection);
    const {wrapInQuotes} = require('../../general')({_});

    const currentRequiredColumnNames = collection.required || [];
    const previousRequiredColumnNames = collection.role.required || [];

    const columnNamesToAddNotNullConstraint = _.difference(currentRequiredColumnNames, previousRequiredColumnNames);
    const columnNamesToRemoveNotNullConstraint = _.difference(previousRequiredColumnNames, currentRequiredColumnNames);

    const addNotNullConstraintsScript = _.toPairs(collection.properties)
        .filter(([name, jsonSchema]) => {
            const oldName = jsonSchema.compMod.oldField.name;
            const shouldRemoveForOldName = columnNamesToRemoveNotNullConstraint.includes(oldName);
            const shouldAddForNewName = columnNamesToAddNotNullConstraint.includes(name);
            return shouldAddForNewName && !shouldRemoveForOldName;
        })
        .map(([columnName]) => ddlProvider.setNotNullConstraint(fullTableName, wrapInQuotes(columnName)));
    const removeNotNullConstraint = _.toPairs(collection.properties)
        .filter(([name, jsonSchema]) => {
            const oldName = jsonSchema.compMod.oldField.name;
            const shouldRemoveForOldName = columnNamesToRemoveNotNullConstraint.includes(oldName);
            const shouldAddForNewName = columnNamesToAddNotNullConstraint.includes(name);
            return shouldRemoveForOldName && !shouldAddForNewName;
        })
        .map(([name]) => ddlProvider.dropNotNullConstraint(fullTableName, wrapInQuotes(name)));

    return [...addNotNullConstraintsScript, ...removeNotNullConstraint];
}

module.exports = {
    getModifyNonNullColumnsScripts
}
