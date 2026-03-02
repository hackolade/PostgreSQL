const { toPairs } = require('lodash');
const { AlterScriptDto, SCRIPT_TYPE } = require('../../types/AlterScriptDto');
const {
	getFullTableName,
	wrapInQuotes,
	isObjectInDeltaModelActivated,
	isParentContainerActivated,
	getId,
} = require('../../../utils/general');
const { decorateDefault } = require('../../../ddlProvider/ddlHelpers/columnDefinitionHelper');
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
const getUpdatedDefaultColumnValueScriptDtos = ({ collection }) => {
	const isContainerActivated = isParentContainerActivated(collection);
	const isCollectionActivated = isObjectInDeltaModelActivated(collection);

	return toPairs(collection.properties)
		.filter(([_name, jsonSchema]) => {
			const newDefault = jsonSchema.default;
			const oldName = jsonSchema.compMod.oldField.name;
			const oldDefault = collection.role.properties[oldName]?.default;
			return newDefault !== undefined && (!oldDefault || newDefault !== oldDefault);
		})
		.map(([columnName, jsonSchema]) => {
			const newDefaultValue = jsonSchema.default;
			const type = jsonSchema.mode || jsonSchema.childType || jsonSchema.type;
			const isArrayType = Array.isArray(jsonSchema.array_type) && jsonSchema.array_type.length > 0;
			const scriptGenerationConfig = {
				tableName: getFullTableName(collection),
				columnName: wrapInQuotes(columnName),
				defaultValue: decorateDefault(type, newDefaultValue, isArrayType),
			};
			const isActivated = isContainerActivated && isCollectionActivated && jsonSchema.isActivated;
			const script = updateColumnDefaultValue(scriptGenerationConfig);
			return AlterScriptDto.getInstance(script, isActivated, false, SCRIPT_TYPE.alterEntity, getId(collection));
		})
		.filter(Boolean);
};

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
const getDeletedDefaultColumnValueScriptDtos = ({ collection }) => {
	const isContainerActivated = isParentContainerActivated(collection);
	const isCollectionActivated = isObjectInDeltaModelActivated(collection);

	return toPairs(collection.properties)
		.filter(([_name, jsonSchema]) => {
			const newDefault = jsonSchema.default;
			const oldName = jsonSchema.compMod.oldField.name;
			const oldDefault = collection.role.properties[oldName]?.default;
			const hasPrevValue = oldDefault !== undefined;
			const hasNewValue = newDefault !== undefined;
			return hasPrevValue && !hasNewValue;
		})
		.map(([columnName, jsonSchema]) => {
			const scriptGenerationConfig = {
				tableName: getFullTableName(collection),
				columnName: wrapInQuotes(columnName),
			};
			const isActivated = isContainerActivated && isCollectionActivated && jsonSchema.isActivated;
			const script = dropColumnDefaultValue(scriptGenerationConfig);
			return AlterScriptDto.getInstance(script, isActivated, true, SCRIPT_TYPE.alterEntity, getId(collection));
		})
		.filter(Boolean);
};

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
