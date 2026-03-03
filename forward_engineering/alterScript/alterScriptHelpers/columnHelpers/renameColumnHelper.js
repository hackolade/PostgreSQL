const _ = require('lodash');
const { AlterScriptDto, SCRIPT_TYPE } = require('../../types/AlterScriptDto');
const {
	checkFieldPropertiesChanged,
	getFullTableName,
	wrapInQuotes,
	isParentContainerActivated,
	isObjectInDeltaModelActivated,
	getId,
} = require('../../../utils/general');
const assignTemplates = require('../../../utils/assignTemplates');
const templates = require('../../../ddlProvider/templates');

/**
 * @param {string} tableName
 * @param {string} oldColumnName
 * @param {string} newColumnName
 * @return string
 * */
const renameColumn = (tableName, oldColumnName, newColumnName) => {
	return assignTemplates(templates.renameColumn, {
		tableName,
		oldColumnName,
		newColumnName,
	});
};

/**
 * @param {Object} collection
 * @return {AlterScriptDto[]}
 * */
const getRenameColumnScriptDtos = collection => {
	const fullTableName = getFullTableName(collection);

	const isContainerActivated = isParentContainerActivated(collection);
	const isCollectionActivated = isObjectInDeltaModelActivated(collection);

	return _.values(collection.properties)
		.filter(jsonSchema => checkFieldPropertiesChanged(jsonSchema.compMod, ['name']))
		.map(jsonSchema => {
			const oldColumnName = wrapInQuotes(jsonSchema.compMod.oldField.name);
			const newColumnName = wrapInQuotes(jsonSchema.compMod.newField.name);
			const isActivated = isContainerActivated && isCollectionActivated && jsonSchema.isActivated;
			const script = renameColumn(fullTableName, oldColumnName, newColumnName);
			return AlterScriptDto.getInstance(script, isActivated, false, SCRIPT_TYPE.alterEntity, getId(collection));
		});
};

module.exports = {
	getRenameColumnScriptDtos,
};
