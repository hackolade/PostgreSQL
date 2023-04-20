const getFullTableName = (_) => (collection) => {
    const {getEntityName} = require('../../../utils/general')(_);
    const {getNamePrefixedWithSchemaName} = require('../../general')({_});

    const collectionSchema = {...collection, ...(_.omit(collection?.role, 'properties') || {})};
    const tableName = getEntityName(collectionSchema);
    const schemaName = collectionSchema.compMod?.keyspaceName;
    return getNamePrefixedWithSchemaName(tableName, schemaName);
}

const getFullColumnName = (_) => (collection, columnName) => {
    const {wrapInQuotes} = require('../../general')({_});

    const fullTableName = getFullTableName(_)(collection);
    return `${fullTableName}.${wrapInQuotes(columnName)}`;
}

module.exports = {
    getFullTableName,
    getFullColumnName,
}
