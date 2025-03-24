const _ = require('lodash');
const { AlterScriptDto } = require('../../types/AlterScriptDto');
const { checkFieldPropertiesChanged, getFullTableName, wrapInQuotes } = require('../../../utils/general');
const assignTemplates = require('../../../utils/assignTemplates');
const templates = require('../../../ddlProvider/templates');

/**
 * @param {string} tableName
 * @param {string} columnName
 * @param {string} dataType
 * @param {{
 *     length?: number,
 *     scale?: number,
 *     precision?: number
 * }} dataTypeProperties
 * @return string
 * */
const alterColumnType = (tableName, columnName, dataType, dataTypeProperties) => {
	let dataTypeString = dataType;
	if (dataTypeProperties.length) {
		dataTypeString += `(${dataTypeProperties.length})`;
	} else if (dataTypeProperties.precision && dataTypeProperties.scale) {
		dataTypeString += `(${dataTypeProperties.precision},${dataTypeProperties.scale})`;
	} else if (dataTypeProperties.precision) {
		dataTypeString += `(${dataTypeProperties.precision})`;
	}

	return assignTemplates(templates.alterColumnType, {
		tableName,
		columnName,
		dataType: dataTypeString,
	});
};

/**
 * @return {boolean}
 * */
const hasLengthChanged = (collection, oldFieldName, currentJsonSchema) => {
	const oldProperty = collection.role.properties[oldFieldName];

	const previousLength = oldProperty?.length;
	const newLength = currentJsonSchema?.length;
	return previousLength !== newLength;
};

/**
 * @return {boolean}
 * */
const hasPrecisionOrScaleChanged = (collection, oldFieldName, currentJsonSchema) => {
	const oldProperty = collection.role.properties[oldFieldName];

	const previousPrecision = oldProperty?.precision;
	const newPrecision = currentJsonSchema?.precision;
	const previousScale = oldProperty?.scale;
	const newScale = currentJsonSchema?.scale;

	return previousPrecision !== newPrecision || previousScale !== newScale;
};

/**
 * @param {Object} collection
 * @return {AlterScriptDto[]}
 * */
const getUpdateTypesScriptDtos = collection => {
	const fullTableName = getFullTableName(collection);

	return _.toPairs(collection.properties)
		.filter(([name, jsonSchema]) => {
			const hasTypeChanged = checkFieldPropertiesChanged(jsonSchema.compMod, ['type', 'mode']);
			if (!hasTypeChanged) {
				const oldName = jsonSchema.compMod.oldField.name;
				const isNewLength = hasLengthChanged(collection, oldName, jsonSchema);
				const isNewPrecisionOrScale = hasPrecisionOrScaleChanged(collection, oldName, jsonSchema);
				return isNewLength || isNewPrecisionOrScale;
			}
			return hasTypeChanged;
		})
		.map(([name, jsonSchema]) => {
			const typeName = jsonSchema.compMod.newField.mode || jsonSchema.compMod.newField.type;
			const columnName = wrapInQuotes(name);
			const typeConfig = _.pick(jsonSchema, ['length', 'precision', 'scale']);
			return alterColumnType(fullTableName, columnName, typeName, typeConfig);
		})
		.map(script => AlterScriptDto.getInstance([script], true, false));
};

module.exports = {
	getUpdateTypesScriptDtos,
};
