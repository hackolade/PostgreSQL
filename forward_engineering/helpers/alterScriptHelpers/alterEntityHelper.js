const {checkFieldPropertiesChanged} = require('./common');

const getAddCollectionScript =
    ({app, dbVersion, modelDefinitions, internalDefinitions, externalDefinitions}) =>
        collection => {
            const _ = app.require('lodash');
            const {getEntityName} = require('../../utils/general')(_);
            const {createColumnDefinitionBySchema} = require('./createColumnDefinition')(app);
            const ddlProvider = require('../../ddlProvider')(null, null, app);
            const {getDefinitionByReference} = app.require('@hackolade/ddl-fe-utils');

            const schemaName = collection.compMod.keyspaceName;
            const schemaData = {schemaName, dbVersion};
            const jsonSchema = {...collection, ...(_.omit(collection?.role, 'properties') || {})};
            const columnDefinitions = _.toPairs(jsonSchema.properties).map(([name, column]) => {
                const definitionJsonSchema = getDefinitionByReference({
                    propertySchema: column,
                    modelDefinitions,
                    internalDefinitions,
                    externalDefinitions,
                });

                return createColumnDefinitionBySchema({
                    name,
                    jsonSchema: column,
                    parentJsonSchema: jsonSchema,
                    ddlProvider,
                    schemaData,
                    definitionJsonSchema,
                });
            });
            const checkConstraints = (jsonSchema.chkConstr || []).map(check =>
                ddlProvider.createCheckConstraint(ddlProvider.hydrateCheckConstraint(check)),
            );
            const tableData = {
                name: getEntityName(jsonSchema),
                columns: columnDefinitions.map(ddlProvider.convertColumnDefinition),
                checkConstraints: checkConstraints,
                foreignKeyConstraints: [],
                schemaData,
                columnDefinitions,
                dbData: {dbVersion},
            };
            const hydratedTable = ddlProvider.hydrateTable({tableData, entityData: [jsonSchema], jsonSchema});

            return ddlProvider.createTable(hydratedTable, jsonSchema.isActivated);
        };

const getDeleteCollectionScript = app => collection => {
    const _ = app.require('lodash');
    const {getEntityName} = require('../../utils/general')(_);
    const {getNamePrefixedWithSchemaName} = require('../general')({_});

    const jsonData = {...collection, ...(_.omit(collection?.role, 'properties') || {})};
    const tableName = getEntityName(jsonData);
    const schemaName = collection.compMod.keyspaceName;
    const fullName = getNamePrefixedWithSchemaName(tableName, schemaName);

    return `DROP TABLE IF EXISTS ${fullName};`;
};

const getAddColumnScript =
    ({app, dbVersion, modelDefinitions, internalDefinitions, externalDefinitions}) =>
        collection => {
            const _ = app.require('lodash');
            const {getEntityName} = require('../../utils/general')(_);
            const {getNamePrefixedWithSchemaName} = require('../general')({_});
            const {createColumnDefinitionBySchema} = require('./createColumnDefinition')(app);
            const ddlProvider = require('../../ddlProvider')(null, null, app);
            const {getDefinitionByReference} = app.require('@hackolade/ddl-fe-utils');

            const collectionSchema = {...collection, ...(_.omit(collection?.role, 'properties') || {})};
            const tableName = getEntityName(collectionSchema);
            const schemaName = collectionSchema.compMod?.keyspaceName;
            const fullName = getNamePrefixedWithSchemaName(tableName, schemaName);
            const schemaData = {schemaName, dbVersion};

            return _.toPairs(collection.properties)
                .filter(([name, jsonSchema]) => !jsonSchema.compMod)
                .map(([name, jsonSchema]) => {
                    const definitionJsonSchema = getDefinitionByReference({
                        propertySchema: jsonSchema,
                        modelDefinitions,
                        internalDefinitions,
                        externalDefinitions,
                    });

                    return createColumnDefinitionBySchema({
                        name,
                        jsonSchema,
                        parentJsonSchema: collectionSchema,
                        ddlProvider,
                        schemaData,
                        definitionJsonSchema,
                    });
                })
                .map(ddlProvider.convertColumnDefinition)
                .map(script => `ALTER TABLE IF EXISTS ${fullName} ADD COLUMN IF NOT EXISTS ${script};`);
        };

const getDeleteColumnScript = app => collection => {
    const _ = app.require('lodash');
    const {getEntityName} = require('../../utils/general')(_);
    const {getNamePrefixedWithSchemaName, wrapInQuotes} = require('../general')({_});

    const collectionSchema = {...collection, ...(_.omit(collection?.role, 'properties') || {})};
    const tableName = getEntityName(collectionSchema);
    const schemaName = collectionSchema.compMod?.keyspaceName;
    const fullName = getNamePrefixedWithSchemaName(tableName, schemaName);

    return _.toPairs(collection.properties)
        .filter(([name, jsonSchema]) => !jsonSchema.compMod)
        .map(([name]) => `ALTER TABLE IF EXISTS ${fullName} DROP COLUMN IF EXISTS ${wrapInQuotes(name)};`);
};

const getFullTableName = (_) => (collection) => {
    const {getEntityName} = require('../../utils/general')(_);
    const {getNamePrefixedWithSchemaName} = require('../general')({_});

    const collectionSchema = {...collection, ...(_.omit(collection?.role, 'properties') || {})};
    const tableName = getEntityName(collectionSchema);
    const schemaName = collectionSchema.compMod?.keyspaceName;
    return getNamePrefixedWithSchemaName(tableName, schemaName);
}

const extractNewPropertyByName = (collection, fieldName) => {
    return collection.role.compMod?.newProperties?.find(newProperty => newProperty.name === fieldName);
}

const hasLengthChanged = (collection, fieldName) => {
    const oldProperty = collection.role.properties[fieldName];
    const newProperty = extractNewPropertyByName(collection, fieldName);

    const previousLength = oldProperty?.length;
    const newLength = newProperty?.length;
    return previousLength !== newLength;
}

const hasPrecisionOrScaleChanged = (collection, fieldName) => {
    const oldProperty = collection.role.properties[fieldName];
    const newProperty = extractNewPropertyByName(collection, fieldName);

    const previousPrecision = oldProperty?.precision;
    const newPrecision = newProperty?.precision;
    const previousScale = oldProperty?.scale;
    const newScale = newProperty?.scale;

    return previousPrecision !== newPrecision || previousScale !== newScale;
}

const getUpdateTypesScripts = (_, ddlProvider) => (collection) => {
    const fullTableName = getFullTableName(_)(collection);
    const {wrapInQuotes} = require('../general')({_});

    const changeTypeScripts = _.toPairs(collection.properties)
        .filter(([name, jsonSchema]) => {
            const hasTypeChanged = checkFieldPropertiesChanged(jsonSchema.compMod, ['type', 'mode']);
            if (!hasTypeChanged) {
                const isNewLength = hasLengthChanged(collection, name);
                const isNewPrecisionOrScale = hasPrecisionOrScaleChanged(collection, name);
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

const getModifyNonNullColumnsScripts = (_, ddlProvider) => (collection) => {
    const fullTableName = getFullTableName(_)(collection);
    const {wrapInQuotes} = require('../general')({_});

    const currentRequiredColumnNames = collection.required || [];
    const previousRequiredColumnNames = collection.role.required || [];

    const columnNamesToAddNotNullConstraint = _.difference(currentRequiredColumnNames, previousRequiredColumnNames);
    const columnNamesToRemoveNotNullConstraint = _.difference(previousRequiredColumnNames, currentRequiredColumnNames);

    const addNotNullConstraintsScript = columnNamesToAddNotNullConstraint
        .map(columnName => ddlProvider.setNotNullConstraint(fullTableName, wrapInQuotes(columnName)));
    const removeNotNullConstraint = _.toPairs(collection.properties)
        .filter(([name, jsonSchema]) => {
            return columnNamesToRemoveNotNullConstraint.includes(jsonSchema.compMod.oldField.name)
        })
        .map(([name]) => ddlProvider.dropNotNullConstraint(fullTableName, wrapInQuotes(name)));

    return [...addNotNullConstraintsScript, ...removeNotNullConstraint];
}

const getRenameColumnScripts = (_, ddlProvider) => (collection) => {
    const fullTableName = getFullTableName(_)(collection);
    const {wrapInQuotes} = require('../general')({_});

    return _.values(collection.properties)
        .filter(jsonSchema => checkFieldPropertiesChanged(jsonSchema.compMod, ['name']))
        .map(
            jsonSchema => {
                const oldColumnName = wrapInQuotes(jsonSchema.compMod.oldField.name);
                const newColumnName = wrapInQuotes(jsonSchema.compMod.newField.name);
                return ddlProvider.renameColumn(fullTableName, oldColumnName, newColumnName);
            }
        );
}

const getModifyColumnScript = app => collection => {
    const _ = app.require('lodash');
    const ddlProvider = require('../../ddlProvider')(null, null, app);

    const renameColumnScripts = getRenameColumnScripts(_, ddlProvider)(collection);
    const updateTypeScripts = getUpdateTypesScripts(_, ddlProvider)(collection);
    const modifyNotNullScripts = getModifyNonNullColumnsScripts(_, ddlProvider)(collection);

    return [
        ...renameColumnScripts,
        ...updateTypeScripts,
        ...modifyNotNullScripts
    ];
};

module.exports = {
    getAddCollectionScript,
    getDeleteCollectionScript,
    getAddColumnScript,
    getDeleteColumnScript,
    getModifyColumnScript,
};
