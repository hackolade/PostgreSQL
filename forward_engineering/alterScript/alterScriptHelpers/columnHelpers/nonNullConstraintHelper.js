const { AlterScriptDto } = require('../../types/AlterScriptDto');

/**
 * @return {(collection: Object) => AlterScriptDto[]}
 * */
const getModifyNonNullColumnsScriptDtos = (_, ddlProvider) => collection => {
	const { getFullTableName, wrapInQuotes } = require('../../../utils/general');
	const fullTableName = getFullTableName(collection);

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
		.map(([columnName]) => ddlProvider.setNotNullConstraint(fullTableName, wrapInQuotes(columnName)))
		.map(script => AlterScriptDto.getInstance([script], true, false));

	const removeNotNullConstraint = _.toPairs(collection.properties)
		.filter(([name, jsonSchema]) => {
			const oldName = jsonSchema.compMod.oldField.name;
			const shouldRemoveForOldName = columnNamesToRemoveNotNullConstraint.includes(oldName);
			const shouldAddForNewName = columnNamesToAddNotNullConstraint.includes(name);
			return shouldRemoveForOldName && !shouldAddForNewName;
		})
		.map(([name]) => ddlProvider.dropNotNullConstraint(fullTableName, wrapInQuotes(name)))
		.map(script => AlterScriptDto.getInstance([script], true, true));

	return [...addNotNullConstraintsScript, ...removeNotNullConstraint];
};

module.exports = {
	getModifyNonNullColumnsScriptDtos,
};
