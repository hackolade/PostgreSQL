const { toPairs } = require('lodash');
const { AlterScriptDto } = require('../../types/AlterScriptDto');
const { getFullTableName, wrapInQuotes, wrapInSingleQuotes } = require('../../../utils/general');
const assignTemplates = require('../../../utils/assignTemplates');
const templates = require('../../../ddlProvider/templates');

/**
 * @param {Object} props
 * @param {string} props.tableName
 * @param {string} props.columnName
 * @param {string} props.defaultValue
 * @return string
 * */
const updateColumnDefaultValue = ({ tableName, columnName, defaultValue }) => {
	const templateConfig = {
		tableName,
		columnName,
		defaultValue,
	};
	return assignTemplates(templates.updateColumnDefaultValue, templateConfig);
};

/**
 * @param {Object} props
 * @param {Object} props.collection
 * @returns { Array<AlterScriptDto> }
 * */
const getUpdatedDefaultColumnValueScriptDtos = ({ collection }) =>
	toPairs(collection.properties)
		.filter(([_name, jsonSchema]) => {
			const newDefault = jsonSchema.default;
			const oldName = jsonSchema.compMod.oldField.name;
			const oldDefault = collection.role.properties[oldName]?.default;
			return newDefault !== undefined && (!oldDefault || newDefault !== oldDefault);
		})
		.map(([columnName, jsonSchema]) => {
			const newDefaultValue = jsonSchema.default;
			const scriptGenerationConfig = {
				tableName: getFullTableName(collection),
				columnName: wrapInQuotes(columnName),
				defaultValue: wrapInSingleQuotes({ name: newDefaultValue }),
			};
			return updateColumnDefaultValue(scriptGenerationConfig);
		})
		.map(script => AlterScriptDto.getInstance([script], true, false))
		.filter(Boolean);

/**
 * @param {Object} props
 * @param {string} props.tableName
 * @param {string} props.columnName
 * @return string
 * */
const dropColumnDefaultValue = ({ tableName, columnName }) => {
	const templateConfig = {
		tableName,
		columnName,
	};
	return assignTemplates(templates.dropColumnDefaultValue, templateConfig);
};

/**
 * @param {Object} props
 * @param {Object} props.collection
 * @returns { Array<AlterScriptDto> }
 * */
const getDeletedDefaultColumnValueScriptDtos = ({ collection }) =>
	toPairs(collection.properties)
		.filter(([_name, jsonSchema]) => {
			const newDefault = jsonSchema.default;
			const oldName = jsonSchema.compMod.oldField.name;
			const oldDefault = collection.role.properties[oldName]?.default;
			const hasPrevValue = oldDefault !== undefined;
			const hasNewValue = newDefault !== undefined;
			return hasPrevValue && !hasNewValue;
		})
		.map(([columnName]) => {
			const scriptGenerationConfig = {
				tableName: getFullTableName(collection),
				columnName: wrapInQuotes(columnName),
			};
			return dropColumnDefaultValue(scriptGenerationConfig);
		})
		.map(script => AlterScriptDto.getInstance([script], true, true))
		.filter(Boolean);

/**
 * @param {Object} props
 * @param {Object} props.collection
 * @returns { Array<AlterScriptDto> }
 * */
const getModifiedDefaultColumnValueScriptDtos = ({ collection }) => {
	const updatedDefaultValuesScriptDtos = getUpdatedDefaultColumnValueScriptDtos({ collection });
	const dropDefaultValuesScriptDtos = getDeletedDefaultColumnValueScriptDtos({ collection });
	return [...updatedDefaultValuesScriptDtos, ...dropDefaultValuesScriptDtos];
};

module.exports = {
	getModifiedDefaultColumnValueScriptDtos,
};
