const _ = require('lodash');
const { AlterScriptDto } = require('../../types/AlterScriptDto');
const {
	getFullTableName,
	wrapInQuotes,
	isObjectInDeltaModelActivated,
	isParentContainerActivated,
} = require('../../../utils/general');
const assignTemplates = require('../../../utils/assignTemplates');
const templates = require('../../../ddlProvider/templates');

/**
 * @param tableName {string}
 * @param columnName {string}
 * @return string
 * */
const setNotNullConstraint = (tableName, columnName) => {
	return assignTemplates(templates.addNotNullConstraint, {
		tableName,
		columnName,
	});
};

/**
 * @param tableName {string}
 * @param columnName {string}
 * @return string
 * */
const dropNotNullConstraint = (tableName, columnName) => {
	return assignTemplates(templates.dropNotNullConstraint, {
		tableName,
		columnName,
	});
};

/**
 * @param {Object} collection
 * @return {AlterScriptDto[]}
 * */
const getModifyNonNullColumnsScriptDtos = collection => {
	const fullTableName = getFullTableName(collection);

	const isContainerActivated = isParentContainerActivated(collection);
	const isCollectionActivated = isObjectInDeltaModelActivated(collection);

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
		.map(([columnName, jsonSchema]) => {
			const isActivated = isContainerActivated && isCollectionActivated && jsonSchema.isActivated;
			return { script: setNotNullConstraint(fullTableName, wrapInQuotes(columnName)), isActivated };
		})
		.map(({ script, isActivated }) => AlterScriptDto.getInstance([script], isActivated, false));

	const removeNotNullConstraint = _.toPairs(collection.properties)
		.filter(([name, jsonSchema]) => {
			const oldName = jsonSchema.compMod.oldField.name;
			const shouldRemoveForOldName = columnNamesToRemoveNotNullConstraint.includes(oldName);
			const shouldAddForNewName = columnNamesToAddNotNullConstraint.includes(name);
			return shouldRemoveForOldName && !shouldAddForNewName;
		})
		.map(([name, jsonSchema]) => {
			const isActivated = isContainerActivated && isCollectionActivated && jsonSchema.isActivated;
			return { script: dropNotNullConstraint(fullTableName, wrapInQuotes(name)), isActivated };
		})
		.map(({ script, isActivated }) => AlterScriptDto.getInstance([script], isActivated, true));

	return [...addNotNullConstraintsScript, ...removeNotNullConstraint];
};

module.exports = {
	getModifyNonNullColumnsScriptDtos,
};
