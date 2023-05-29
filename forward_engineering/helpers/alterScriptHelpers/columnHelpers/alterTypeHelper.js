const {getFullTableName} = require("../ddlHelper");
const {AlterScriptDto} = require("../types/AlterScriptDto");

/**
 * @return {boolean}
 * */
const hasLengthChanged = (collection, oldFieldName, currentJsonSchema) => {
    const oldProperty = collection.role.properties[oldFieldName];

    const previousLength = oldProperty?.length;
    const newLength = currentJsonSchema?.length;
    return previousLength !== newLength;
}

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
}

/**
 * @return {(collection: Object) => AlterScriptDto[]}
 * */
const getUpdateTypesScriptDtos = (_, ddlProvider) => (collection) => {
    const fullTableName = getFullTableName(_)(collection);
    const {wrapInQuotes} = require('../../general')({_});
    const {checkFieldPropertiesChanged} = require('../../../utils/general')(_);

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
        .map(
            ([name, jsonSchema]) => {
                const typeName = jsonSchema.compMod.newField.mode || jsonSchema.compMod.newField.type;
                const columnName = wrapInQuotes(name);
                const typeConfig = _.pick(jsonSchema, ['length', 'precision', 'scale']);
                return ddlProvider.alterColumnType(fullTableName, columnName, typeName, typeConfig);
            }
        )
        .map(script => AlterScriptDto.getInstance([script], true, false));
}

module.exports = {
    getUpdateTypesScriptDtos
}
