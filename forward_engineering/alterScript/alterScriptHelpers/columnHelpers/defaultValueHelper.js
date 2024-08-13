const { toPairs } = require('lodash');
const { AlterScriptDto } = require('../../types/AlterScriptDto');
const { getFullTableName, wrapInQuotes, wrapInSingleQuotes } = require('../../../utils/general');

/**
 * @param { ({ ddlProvider: Object, collection: Object }) }
 * @returns { Array<AlterScriptDto> }
 * */
const getUpdatedDefaultColumnValueScriptDtos = ({ ddlProvider, collection }) =>
	toPairs(collection.properties)
		.filter(([_name, jsonSchema]) => {
			const newDefault = jsonSchema.default;
			const oldName = jsonSchema.compMod.oldField.name;
			const oldDefault = collection.role.properties[oldName]?.default;
			return newDefault && (!oldDefault || newDefault !== oldDefault);
		})
		.map(([columnName, jsonSchema]) => {
			const newDefaultValue = jsonSchema.default;
			const scriptGenerationConfig = {
				tableName: getFullTableName(collection),
				columnName: wrapInQuotes(columnName),
				defaultValue: wrapInSingleQuotes({ name: newDefaultValue }),
			};
			return ddlProvider.updateColumnDefaultValue(scriptGenerationConfig);
		})
		.map(script => AlterScriptDto.getInstance([script], true, false))
		.filter(Boolean);

/**
 * @param { ({ ddlProvider: Object, collection: Object }) }
 * @returns { Array<AlterScriptDto> }
 * */
const getDeletedDefaultColumnValueScriptDtos = ({ ddlProvider, collection }) =>
	toPairs(collection.properties)
		.filter(([_name, jsonSchema]) => {
			const newDefault = jsonSchema.default;
			const oldName = jsonSchema.compMod.oldField.name;
			const oldDefault = collection.role.properties[oldName]?.default;
			return oldDefault && !newDefault;
		})
		.map(([columnName]) => {
			const scriptGenerationConfig = {
				tableName: getFullTableName(collection),
				columnName,
			};
			return ddlProvider.dropColumnDefaultValue(scriptGenerationConfig);
		})
		.map(script => AlterScriptDto.getInstance([script], true, true))
		.filter(Boolean);

/**
 * @param { ({ ddlProvider: Object, collection: Object }) }
 * @returns { Array<AlterScriptDto> }
 * */
const getModifiedDefaultColumnValueScriptDtos = ({ ddlProvider, collection }) => {
	const updatedDefaultValuesScriptDtos = getUpdatedDefaultColumnValueScriptDtos({ ddlProvider, collection });
	const dropDefaultValuesScriptDtos = getDeletedDefaultColumnValueScriptDtos({ ddlProvider, collection });
	return [...updatedDefaultValuesScriptDtos, ...dropDefaultValuesScriptDtos];
};

module.exports = {
	getModifiedDefaultColumnValueScriptDtos,
};
