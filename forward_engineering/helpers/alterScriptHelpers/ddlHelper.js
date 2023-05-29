const getFullTableName = (_) => (collection) => {
    const {getEntityName} = require('../../utils/general')(_);
    const {getNamePrefixedWithSchemaName} = require('../general')({_});

    const collectionSchema = {...collection, ...(_.omit(collection?.role, 'properties') || {})};
    const tableName = getEntityName(collectionSchema);
    const schemaName = collectionSchema.compMod?.keyspaceName;
    return getNamePrefixedWithSchemaName(tableName, schemaName);
}

const getFullColumnName = (_) => (collection, columnName) => {
    const {wrapInQuotes} = require('../general')({_});

    const fullTableName = getFullTableName(_)(collection);
    return `${fullTableName}.${wrapInQuotes(columnName)}`;
}

const getFullViewName = (_) => (view) => {
    const {getViewName} = require('../../utils/general')(_);
    const {getNamePrefixedWithSchemaName} = require('../general')({_});

    const viewSchema = {...view, ...(_.omit(view?.role, 'properties') || {})};
    const viewName = getViewName(viewSchema);
    const schemaName = viewSchema.compMod?.keyspaceName;
    return getNamePrefixedWithSchemaName(viewName, schemaName);
}

/**
 * @param udt {Object}
 * @return {string}
 * */
const getUdtName = (udt) => {
    return udt.code || udt.name;
}

module.exports = {
    getFullTableName,
    getFullColumnName,
    getFullViewName,
    getUdtName,
}
