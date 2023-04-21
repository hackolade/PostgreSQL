const {checkFieldPropertiesChanged} = require('./common');

/**
 * @typedef {{
 *     id: string,
 *     chkConstrName: string,
 *     constrExpression: string,
 * }} CheckConstraint
 *
 * @typedef {{
 *     old?: CheckConstraint,
 *     new?: CheckConstraint
 * }} CheckConstraintHistoryEntry
 * */

const getFullTableName = (_) => (collection) => {
    const {getEntityName} = require('../../utils/general')(_);
    const {getNamePrefixedWithSchemaName} = require('../general')({_});

    const collectionSchema = {...collection, ...(_.omit(collection?.role, 'properties') || {})};
    const tableName = getEntityName(collectionSchema);
    const schemaName = collectionSchema.compMod?.keyspaceName;
    return getNamePrefixedWithSchemaName(tableName, schemaName);
}

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
    const fullName = getFullTableName(_)(collection);
    return `DROP TABLE IF EXISTS ${fullName};`;
};

/**
 * @return {(collection: Object) => Array<CheckConstraintHistoryEntry>}
 * */
const mapCheckConstraintNamesToChangeHistory = (_) => (collection) => {
    const checkConstraintHistory = collection?.compMod?.chkConstr;
    if (!checkConstraintHistory) {
        return [];
    }
    const newConstraints = checkConstraintHistory.new || [];
    const oldConstraints = checkConstraintHistory.old || [];
    const constrNames = _.chain([ ...newConstraints, ...oldConstraints ])
        .map(constr => constr.chkConstrName)
        .uniq()
        .value();

    return constrNames.map(chkConstrName => {
        return {
            old: _.find(oldConstraints, { chkConstrName }),
            new: _.find(newConstraints, { chkConstrName }),
        };
    })
}

/**
 * @return {(constraintHistory: Array<CheckConstraintHistoryEntry>, fullTableName: string) => Array<string>}
 * */
const getDropCheckConstraintScripts = (_, ddlProvider) => (constraintHistory, fullTableName) => {
    const {wrapInQuotes} = require('../general')({_});

    return constraintHistory
        .filter(historyEntry => historyEntry.old && !historyEntry.new)
        .map(historyEntry => {
            const wrappedConstraintName = wrapInQuotes(historyEntry.old.chkConstrName);
            return ddlProvider.dropConstraint(fullTableName, wrappedConstraintName);
        });
}

/**
 * @return {(constraintHistory: Array<CheckConstraintHistoryEntry>, fullTableName: string) => Array<string>}
 * */
const getAddCheckConstraintScripts = (_, ddlProvider) => (constraintHistory, fullTableName) => {
    const {wrapInQuotes} = require('../general')({_});

    return constraintHistory
        .filter(historyEntry => historyEntry.new && !historyEntry.old)
        .map(historyEntry => {
            const { chkConstrName, constrExpression } = historyEntry.new;
            return ddlProvider.addCheckConstraint(fullTableName, wrapInQuotes(chkConstrName), constrExpression);
        });
}

/**
 * @return {(constraintHistory: Array<CheckConstraintHistoryEntry>, fullTableName: string) => Array<string>}
 * */
const getUpdateCheckConstraintScripts = (_, ddlProvider) => (constraintHistory, fullTableName) => {
    const {wrapInQuotes} = require('../general')({_});

    return constraintHistory
        .filter(historyEntry => {
            if (historyEntry.old && historyEntry.new) {
                const oldExpression = historyEntry.old.constrExpression;
                const newExpression = historyEntry.new.constrExpression;
                return oldExpression !== newExpression;
            }
            return false;
        })
        .map(historyEntry => {
            const { chkConstrName: oldConstrainName } = historyEntry.old;
            const dropConstraintScript = ddlProvider.dropConstraint(fullTableName, wrapInQuotes(oldConstrainName));

            const { chkConstrName: newConstrainName, constrExpression: newConstraintExpression } = historyEntry.new;
            const addConstraintScript = ddlProvider.addCheckConstraint(fullTableName, wrapInQuotes(newConstrainName), newConstraintExpression);

            return [dropConstraintScript, addConstraintScript];
        })
        .flat();
}

/**
 * @return (collection: Object) => Array<string>
 * */
const getModifyCheckConstraintScripts = (_, ddlProvider) => (collection) => {
    const fullTableName = getFullTableName(_)(collection);
    const constraintHistory = mapCheckConstraintNamesToChangeHistory(_)(collection);

    const addCheckConstraintScripts = getAddCheckConstraintScripts(_, ddlProvider)(constraintHistory, fullTableName);
    const dropCheckConstraintScripts = getDropCheckConstraintScripts(_, ddlProvider)(constraintHistory, fullTableName);
    const updateCheckConstraintScripts = getUpdateCheckConstraintScripts(_, ddlProvider)(constraintHistory, fullTableName);

    return [
        ...addCheckConstraintScripts,
        ...dropCheckConstraintScripts,
        ...updateCheckConstraintScripts,
    ]
}

/**
 * @return (collection: Object) => Array<string>
 * */
const getModifyCollectionScript = (app) => (collection) => {
    const _ = app.require('lodash');
    const ddlProvider = require('../../ddlProvider')(null, null, app);

    const modifyCheckConstraintScripts = getModifyCheckConstraintScripts(_, ddlProvider)(collection);
    return [...modifyCheckConstraintScripts]
}

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

const hasLengthChanged = (collection, oldFieldName, currentJsonSchema) => {
    const oldProperty = collection.role.properties[oldFieldName];

    const previousLength = oldProperty?.length;
    const newLength = currentJsonSchema?.length;
    return previousLength !== newLength;
}

const hasPrecisionOrScaleChanged = (collection, oldFieldName, currentJsonSchema) => {
    const oldProperty = collection.role.properties[oldFieldName];

    const previousPrecision = oldProperty?.precision;
    const newPrecision = currentJsonSchema?.precision;
    const previousScale = oldProperty?.scale;
    const newScale = currentJsonSchema?.scale;

    return previousPrecision !== newPrecision || previousScale !== newScale;
}

const getUpdateTypesScripts = (_, ddlProvider) => (collection) => {
    const fullTableName = getFullTableName(_)(collection);
    const {wrapInQuotes} = require('../general')({_});

    const changeTypeScripts = _.toPairs(collection.properties)
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

    const addNotNullConstraintsScript = _.toPairs(collection.properties)
        .filter(([name, jsonSchema]) => {
            const oldName = jsonSchema.compMod.oldField.name;
            const shouldRemoveForOldName = columnNamesToRemoveNotNullConstraint.includes(oldName);
            const shouldAddForNewName = columnNamesToAddNotNullConstraint.includes(name);
            return shouldAddForNewName && !shouldRemoveForOldName;
        })
        .map(([columnName]) => ddlProvider.setNotNullConstraint(fullTableName, wrapInQuotes(columnName)));
    const removeNotNullConstraint = _.toPairs(collection.properties)
        .filter(([name, jsonSchema]) => {
            const oldName = jsonSchema.compMod.oldField.name;
            const shouldRemoveForOldName = columnNamesToRemoveNotNullConstraint.includes(oldName);
            const shouldAddForNewName = columnNamesToAddNotNullConstraint.includes(name);
            return shouldRemoveForOldName && !shouldAddForNewName;
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
    getModifyCollectionScript,
    getAddColumnScript,
    getDeleteColumnScript,
    getModifyColumnScript,
};
