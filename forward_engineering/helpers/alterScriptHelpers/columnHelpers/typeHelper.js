const {getFullTableName} = require("../entityHelpers/ddlHelper");
const {checkFieldPropertiesChanged} = require("../common");
const extractNewPropertyByName = (collection, fieldName) => {
    return collection.role.compMod?.newProperties?.find(newProperty => newProperty.name === fieldName);
}

const hasLengthChanged = (collection, newFieldName, oldFieldName) => {
    const oldProperty = collection.role.properties[oldFieldName];
    const newProperty = extractNewPropertyByName(collection, newFieldName);

    const previousLength = oldProperty?.length;
    const newLength = newProperty?.length;
    return previousLength !== newLength;
}

const hasPrecisionOrScaleChanged = (collection, newFieldName, oldFieldName) => {
    const oldProperty = collection.role.properties[oldFieldName];
    const newProperty = extractNewPropertyByName(collection, newFieldName);

    const previousPrecision = oldProperty?.precision;
    const newPrecision = newProperty?.precision;
    const previousScale = oldProperty?.scale;
    const newScale = newProperty?.scale;

    return previousPrecision !== newPrecision || previousScale !== newScale;
}

const getUpdateTypesScripts = (_, ddlProvider) => (collection) => {
    const fullTableName = getFullTableName(_)(collection);
    const {wrapInQuotes} = require('../../general')({_});

    const changeTypeScripts = _.toPairs(collection.properties)
        .filter(([name, jsonSchema]) => {
            const hasTypeChanged = checkFieldPropertiesChanged(jsonSchema.compMod, ['type', 'mode']);
            if (!hasTypeChanged) {
                const oldName = jsonSchema.compMod.oldField.name;
                const isNewLength = hasLengthChanged(collection, name, oldName);
                const isNewPrecisionOrScale = hasPrecisionOrScaleChanged(collection, name, oldName);
                return isNewLength || isNewPrecisionOrScale;
            }
            return hasTypeChanged;
        })
        .map(
            ([name, jsonSchema]) => {
                const typeName = jsonSchema.compMod.newField.mode || jsonSchema.compMod.newField.type;
                const columnName = wrapInQuotes(name);
                const newProperty = extractNewPropertyByName(collection, name);
                const typeConfig = _.pick(newProperty, ['length', 'precision', 'scale']);
                return ddlProvider.alterColumnType(fullTableName, columnName, typeName, typeConfig);
            }
        );
    return [...changeTypeScripts];
}

module.exports = {
    getUpdateTypesScripts
}
