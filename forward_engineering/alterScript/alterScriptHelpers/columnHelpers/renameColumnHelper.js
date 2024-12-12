const _ = require('lodash');
const { AlterScriptDto } = require('../../types/AlterScriptDto');
const { checkFieldPropertiesChanged, getFullTableName, wrapInQuotes } = require('../../../utils/general');
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

	return _.values(collection.properties)
		.filter(jsonSchema => checkFieldPropertiesChanged(jsonSchema.compMod, ['name']))
		.map(jsonSchema => {
			const oldColumnName = wrapInQuotes(jsonSchema.compMod.oldField.name);
			const newColumnName = wrapInQuotes(jsonSchema.compMod.newField.name);
			return renameColumn(fullTableName, oldColumnName, newColumnName);
		})
		.map(script => AlterScriptDto.getInstance([script], true, false));
};

module.exports = {
	getRenameColumnScriptDtos,
};
