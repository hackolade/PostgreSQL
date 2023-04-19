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
 * @return {Map<string, CheckConstraintHistoryEntry>}
 * */
const mapCheckConstraintNamesToChangeHistory = (collection) => {
    const out = new Map();
    const checkConstraintHistory = collection?.compMod?.chkConstr;
    if (!checkConstraintHistory) {
        return out;
    }
    const newConstraints = checkConstraintHistory.new || [];
    const oldConstraints = checkConstraintHistory.old || [];

    /**
     * @param constraints {Array<any>}
     * @param constraintType {"new" | "old"}
     * */
    const fillConstraintHistoryMap = (constraints, constraintType) => {
        for (const constraint of constraints) {
            let existingHistoryEntry = out.get(constraint.chkConstrName);
            if (!existingHistoryEntry) {
                existingHistoryEntry = {"new": undefined, old: undefined};
                out.set(constraint.chkConstrName, existingHistoryEntry);
            }
            existingHistoryEntry[constraintType] = constraint;
        }
    }

    fillConstraintHistoryMap(newConstraints, 'new');
    fillConstraintHistoryMap(oldConstraints, 'old');
    return out;
}

/**
 * @return {(constraintHistory: Map<string, CheckConstraintHistoryEntry>, collection: Object) => Array<string>}
 * */
const getDropCheckConstraintScripts = (_, ddlProvider) => (constraintHistory, collection) => {
    const {wrapInQuotes} = require('../general')({_});

    const fullTableName = getFullTableName(_)(collection);
    return Array.from(constraintHistory.values())
        .filter(historyEntry => historyEntry.old && !historyEntry.new)
        .map(historyEntry => {
            const wrappedConstraintName = wrapInQuotes(historyEntry.old.chkConstrName);
            return ddlProvider.dropConstraint(fullTableName, wrappedConstraintName);
        });
}

/**
 * @return {(constraintHistory: Map<string, CheckConstraintHistoryEntry>, collection: Object) => Array<string>}
 * */
const getAddCheckConstraintScripts = (_, ddlProvider) => (constraintHistory, collection) => {
    const {wrapInQuotes} = require('../general')({_});

    const fullTableName = getFullTableName(_)(collection);
    return Array.from(constraintHistory.values())
        .filter(historyEntry => historyEntry.new && !historyEntry.old)
        .map(historyEntry => {
            const { chkConstrName, constrExpression } = historyEntry.new;
            return ddlProvider.addCheckConstraint(fullTableName, wrapInQuotes(chkConstrName), constrExpression);
        });
}

/**
 * @return {(constraintHistory: Map<string, CheckConstraintHistoryEntry>, collection: Object) => Array<string>}
 * */
const getUpdateCheckConstraintScripts = (_, ddlProvider) => (constraintHistory, collection) => {
    const {wrapInQuotes} = require('../general')({_});

    const fullTableName = getFullTableName(_)(collection);
    return Array.from(constraintHistory.values())
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
    const constraintHistory = mapCheckConstraintNamesToChangeHistory(collection);

    const addCheckConstraintScripts = getAddCheckConstraintScripts(_, ddlProvider)(constraintHistory, collection);
    const dropCheckConstraintScripts = getDropCheckConstraintScripts(_, ddlProvider)(constraintHistory, collection);
    const updateCheckConstraintScripts = getUpdateCheckConstraintScripts(_, ddlProvider)(constraintHistory, collection);

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
    const {wrapInQuotes} = require('../general')({_});

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
