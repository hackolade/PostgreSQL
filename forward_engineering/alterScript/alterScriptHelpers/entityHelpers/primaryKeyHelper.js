const {AlterScriptDto} = require('../../types/AlterScriptDto');
const {
    AlterCollectionDto,
    AlterCollectionColumnDto,
    AlterCollectionRoleCompModPKDto,
    AlterCollectionColumnPrimaryKeyOptionDto,
    AlterCollectionRoleCompModPrimaryKey
} = require('../../types/AlterCollectionDto');

const amountOfColumnsInRegularPk = 1;

/**
 * @return {(collection: AlterCollectionDto) => boolean}
 * */

/**
 * @param entityName {string}
 * @return {string}
 * */
const getDefaultConstraintName = (entityName) => {
    return `${entityName}_pk`;
}

class PkTransitionDto {

    /**
     * @type {boolean}
     * */
    didTransitionHappen

    /**
     * @type {boolean | undefined}
     * */
    wasPkChangedInTransition

}

/**
 * @param optionHolder {AlterCollectionColumnPrimaryKeyOptionDto}
 * @return {<Partial<AlterCollectionColumnPrimaryKeyOptionDto>}
 * */
const extractOptionsForComparisonWithRegularPkOptions = (optionHolder) => {
    return {
        constraintName: optionHolder.constraintName,
        indexStorageParameters: optionHolder.indexStorageParameters,
        indexTablespace: optionHolder.indexTablespace,
        indexInclude: optionHolder.indexInclude?.map(e => {
            const indexIncludeEntry = {
                keyId: e.keyId,
            }
            if (e.type) {
                indexIncludeEntry.type = e.type;
            }
            return indexIncludeEntry;
        }),
    }
}

/**
 * @param columnJsonSchema {AlterCollectionColumnDto}
 * @return {Array<Partial<AlterCollectionColumnPrimaryKeyOptionDto>>}
 * */
const getCustomPropertiesOfRegularPkForComparisonWithRegularPkOptions = (columnJsonSchema) => {
    /**
     * @type {Array<AlterCollectionColumnPrimaryKeyOptionDto>}
     * */
    const constraintOptions = columnJsonSchema.primaryKeyOptions || [];
    return constraintOptions
        .map(option => extractOptionsForComparisonWithRegularPkOptions(option));
}

/**
 * @param compositePk {AlterCollectionRoleCompModPKDto}
 * @return {Array<Partial<AlterCollectionColumnPrimaryKeyOptionDto>>}
 * */
const getCustomPropertiesOfCompositePkForComparisonWithRegularPkOptions = (compositePk) => {
    const optionsForComparison = extractOptionsForComparisonWithRegularPkOptions(compositePk);
    return [optionsForComparison]
        .filter(o => Object.values(o).some(Boolean));
}

/**
 * @return {(collection: AlterCollectionDto) => PkTransitionDto}
 * */
const wasCompositePkChangedInTransitionFromCompositeToRegular = (_) => (collection) => {
    const noTransition = {
        didTransitionHappen: false,
    }
    /**
     * @type {AlterCollectionRoleCompModPrimaryKey}
     * */
    const pkDto = collection?.role?.compMod?.primaryKey || {};
    /**
     * @type {AlterCollectionRoleCompModPKDto[]}
     * */
    const oldPrimaryKeys = pkDto.old || [];
    const idsOfColumns = oldPrimaryKeys.flatMap(pk => pk.compositePrimaryKey.map(dto => dto.keyId))
    if (idsOfColumns.length !== amountOfColumnsInRegularPk) {
        // We return false, because it wouldn't count as transition between regular PK and composite PK
        // if composite PK did not constraint exactly 1 column
        return noTransition;
    }
    const idOfPkColumn = idsOfColumns[0];
    const newColumnJsonSchema = Object.values(collection.properties)
        .find(columnJsonSchema => columnJsonSchema.GUID === idOfPkColumn);
    if (!newColumnJsonSchema) {
        return noTransition;
    }
    const isNewColumnARegularPrimaryKey = newColumnJsonSchema?.primaryKey && !newColumnJsonSchema?.compositePrimaryKey;
    if (!isNewColumnARegularPrimaryKey) {
        return noTransition;
    }
    const constraintOptions = getCustomPropertiesOfRegularPkForComparisonWithRegularPkOptions(newColumnJsonSchema);
    const areOptionsEqual = oldPrimaryKeys.some((compositePk) => {
        if (compositePk.compositePrimaryKey.length !== amountOfColumnsInRegularPk) {
            return false;
        }
        const oldCompositePkAsRegularPkOptions = getCustomPropertiesOfCompositePkForComparisonWithRegularPkOptions(compositePk);
        return _(oldCompositePkAsRegularPkOptions).differenceWith(constraintOptions, _.isEqual).isEmpty();
    });

    return {
        didTransitionHappen: true,
        wasPkChangedInTransition: !areOptionsEqual,
    }
}

/**
 * @return {(collection: AlterCollectionDto) => PkTransitionDto}
 * */
const wasCompositePkChangedInTransitionFromRegularToComposite = (_) => (collection) => {
    const noTransition = {
        didTransitionHappen: false,
    }
    /**
     * @type {AlterCollectionRoleCompModPrimaryKey}
     * */
    const pkDto = collection?.role?.compMod?.primaryKey || {};
    /**
     * @type {AlterCollectionRoleCompModPKDto[]}
     * */
    const newPrimaryKeys = pkDto.new || [];
    const idsOfColumns = newPrimaryKeys.flatMap(pk => pk.compositePrimaryKey.map(dto => dto.keyId))
    if (idsOfColumns.length !== amountOfColumnsInRegularPk) {
        // We return false, because it wouldn't count as transition between regular PK and composite PK
        // if composite PK does not constraint exactly 1 column
        return noTransition;
    }
    const idOfPkColumn = idsOfColumns[0];
    const oldColumnJsonSchema = Object.values(collection.role.properties)
        .find(columnJsonSchema => columnJsonSchema.GUID === idOfPkColumn);
    if (!oldColumnJsonSchema) {
        return noTransition;
    }
    const isOldColumnARegularPrimaryKey = oldColumnJsonSchema?.primaryKey && !oldColumnJsonSchema?.compositePrimaryKey;
    if (!isOldColumnARegularPrimaryKey) {
        return noTransition;
    }
    const constraintOptions = getCustomPropertiesOfRegularPkForComparisonWithRegularPkOptions(oldColumnJsonSchema);
    const areOptionsEqual = newPrimaryKeys.some((compositePk) => {
        if (compositePk.compositePrimaryKey.length !== amountOfColumnsInRegularPk) {
            return false;
        }
        const oldCompositePkAsRegularPkOptions = getCustomPropertiesOfCompositePkForComparisonWithRegularPkOptions(compositePk);
        return _(oldCompositePkAsRegularPkOptions).differenceWith(constraintOptions, _.isEqual).isEmpty();
    });

    return {
        didTransitionHappen: true,
        wasPkChangedInTransition: !areOptionsEqual,
    }
}

/**
 * @param primaryKey {AlterCollectionRoleCompModPKDto}
 * @param entityName {string}
 * @return {string}
 * */
const getConstraintNameForCompositePk = (primaryKey, entityName) => {
    if (primaryKey.constraintName) {
        return primaryKey.constraintName;
    }
    return getDefaultConstraintName(entityName);
}

/**
 * @param _
 * @return {(
 *      primaryKey: AlterCollectionRoleCompModPKDto,
 *      entityName: string,
 *      entityJsonSchema: AlterCollectionDto,
 * ) => {
 *         name: string,
 *         keyType: string,
 *         columns: Array<{
 *      		isActivated: boolean,
 *      		name: string,
 *  	   }>,
 *         include: Array<{
 *              isActivated: boolean,
 *              name: string,
 *         }>,
 *         storageParameters: string,
 *         tablespace: string,
 *      }
 *  }
 * */
const getCreateCompositePKDDLProviderConfig = (_) => (
    primaryKey,
    entityName,
    entity
) => {
    const constraintName = getConstraintNameForCompositePk(primaryKey, entityName);
    const pkColumns = _.toPairs(entity.role.properties)
        .filter(([name, jsonSchema]) => Boolean(primaryKey.compositePrimaryKey.find(keyDto => keyDto.keyId === jsonSchema.GUID)))
        .map(([name, jsonSchema]) => ({
            name,
            isActivated: jsonSchema.isActivated,
        }));

    let storageParameters = '';
    let indexTablespace = '';
    let includeColumns = [];
    if (primaryKey.indexStorageParameters) {
        storageParameters = primaryKey.indexStorageParameters;
    }
    if (primaryKey.indexTablespace) {
        indexTablespace = primaryKey.indexTablespace;
    }
    if (primaryKey.indexInclude) {
        includeColumns = _.toPairs(entity.role.properties)
            .filter(([name, jsonSchema]) => Boolean(primaryKey.indexInclude.find(keyDto => keyDto.keyId === jsonSchema.GUID)))
            .map(([name, jsonSchema]) => ({
                name,
                isActivated: jsonSchema.isActivated,
            }));
    }

    return {
        name: constraintName,
        keyType: 'PRIMARY KEY',
        columns: pkColumns,
        include: includeColumns,
        storageParameters,
        tablespace: indexTablespace,
    }
}

/**
 * @return {(collection: AlterCollectionDto) => Array<AlterScriptDto>}
 * */
const getAddCompositePkScripts = (_, ddlProvider) => (collection) => {
    const {
        getFullCollectionName,
        getSchemaOfAlterCollection,
        getEntityName,
    } = require('../../../utils/general')(_);

    /**
     * @type {AlterCollectionRoleCompModPrimaryKey}
     * */
    const pkDto = collection?.role?.compMod?.primaryKey || {};
    const newPrimaryKeys = pkDto.new || [];
    const oldPrimaryKeys = pkDto.old || [];
    if (newPrimaryKeys.length === 0 && oldPrimaryKeys.length === 0) {
        return [];
    }
    const transitionToCompositeDto = wasCompositePkChangedInTransitionFromRegularToComposite(_)(collection);
    if (transitionToCompositeDto.didTransitionHappen && !transitionToCompositeDto.wasPkChangedInTransition) {
        return [];
    }
    if (newPrimaryKeys.length === oldPrimaryKeys.length) {
        const areKeyArraysEqual = _(oldPrimaryKeys).differenceWith(newPrimaryKeys, _.isEqual).isEmpty();
        if (areKeyArraysEqual) {
            return []
        }
    }

    const collectionSchema = getSchemaOfAlterCollection(collection);
    const fullTableName = getFullCollectionName(collectionSchema);
    const entityName = getEntityName(collectionSchema);

    return newPrimaryKeys
        .map((newPk) => {
            const ddlConfig = getCreateCompositePKDDLProviderConfig(_)(newPk, entityName, collection);
            return ddlProvider.createKeyConstraint(
                fullTableName,
                collection.isActivated,
                ddlConfig
            );
        })
        .filter(Boolean)
        .map(scriptDto => AlterScriptDto.getInstance([scriptDto.statement], scriptDto.isActivated, false))
        .filter(Boolean);
}

/**
 * @return {(collection: AlterCollectionDto) => Array<AlterScriptDto>}
 * */
const getDropCompositePkScripts = (_, ddlProvider) => (collection) => {
    const {
        getFullCollectionName,
        getSchemaOfAlterCollection,
        getEntityName,
        wrapInQuotes
    } = require('../../../utils/general')(_);

    const pkDto = collection?.role?.compMod?.primaryKey || {};
    const newPrimaryKeys = pkDto.new || [];
    const oldPrimaryKeys = pkDto.old || [];
    if (newPrimaryKeys.length === 0 && oldPrimaryKeys.length === 0) {
        return [];
    }
    const transitionToCompositeDto = wasCompositePkChangedInTransitionFromCompositeToRegular(_)(collection);
    if (transitionToCompositeDto.didTransitionHappen && !transitionToCompositeDto.wasPkChangedInTransition) {
        return [];
    }
    if (newPrimaryKeys.length === oldPrimaryKeys.length) {
        const areKeyArraysEqual = _(oldPrimaryKeys).differenceWith(newPrimaryKeys, _.isEqual).isEmpty();
        if (areKeyArraysEqual) {
            return []
        }
    }

    const collectionSchema = getSchemaOfAlterCollection(collection);
    const fullTableName = getFullCollectionName(collectionSchema);
    const entityName = getEntityName(collectionSchema);

    return oldPrimaryKeys
        .map((oldPk) => {
            let constraintName = wrapInQuotes(getDefaultConstraintName(entityName));
            if (oldPk.constraintName) {
                constraintName = wrapInQuotes(oldPk.constraintName);
            }
            return ddlProvider.dropPkConstraint(fullTableName, constraintName);
        })
        .map(scriptLine => AlterScriptDto.getInstance([scriptLine], collection.isActivated, true))
        .filter(Boolean);
}

/**
 * @return {(collection: AlterCollectionDto) => Array<AlterScriptDto>}
 * */
const getModifyCompositePkScripts = (_, ddlProvider) => (collection) => {
    const dropCompositePkScripts = getDropCompositePkScripts(_, ddlProvider)(collection);
    const addCompositePkScripts = getAddCompositePkScripts(_, ddlProvider)(collection);

    return [
        ...dropCompositePkScripts,
        ...addCompositePkScripts,
    ].filter(Boolean);
}

/**
 * @param columnJsonSchema {AlterCollectionColumnDto}
 * @param entityName {string}
 * @return {string}
 * */
const getConstraintNameForRegularPk = (columnJsonSchema, entityName) => {
    const constraintOptions = columnJsonSchema.primaryKeyOptions;
    if (constraintOptions?.length && constraintOptions?.length > 0) {
        /**
         * @type {AlterCollectionColumnPrimaryKeyOptionDto}
         * */
        const constraintOption = constraintOptions[0];
        if (constraintOption.constraintName) {
            return constraintOption.constraintName;
        }
    }
    return getDefaultConstraintName(entityName);
}

/**
 * @param _
 * @return {(
 *      name: string,
 *      columnJsonSchema: AlterCollectionColumnDto,
 *      entityName: string,
 *      entityJsonSchema: AlterCollectionDto,
 * ) => {
 *         name: string,
 *         keyType: string,
 *         columns: Array<{
 *      		isActivated: boolean,
 *      		name: string,
 *  	   }>,
 *         include: Array<{
 *              isActivated: boolean,
 *              name: string,
 *         }>,
 *         storageParameters: string,
 *         tablespace: string,
 *      }
 *  }
 * */
const getCreateRegularPKDDLProviderConfig = (_) => (
    columnName,
    columnJsonSchema,
    entityName,
    entity
) => {
    const constraintName = getConstraintNameForRegularPk(columnJsonSchema, entityName);
    const pkColumns = [{
        name: columnName,
        isActivated: columnJsonSchema.isActivated,
    }];

    let storageParameters = '';
    let indexTablespace = '';
    let includeColumns = [];
    const constraintOptions = columnJsonSchema.primaryKeyOptions;
    if (constraintOptions?.length && constraintOptions?.length > 0) {
        /**
         * @type {AlterCollectionColumnPrimaryKeyOptionDto}
         * */
        const constraintOption = constraintOptions[0];
        if (constraintOption.indexStorageParameters) {
            storageParameters = constraintOption.indexStorageParameters;
        }
        if (constraintOption.indexTablespace) {
            indexTablespace = constraintOption.indexTablespace;
        }
        if (constraintOption.indexInclude) {
            includeColumns = _.toPairs(entity.role.properties)
                .filter(([name, jsonSchema]) => Boolean(constraintOption.indexInclude.find(keyDto => keyDto.keyId === jsonSchema.GUID)))
                .map(([name, jsonSchema]) => ({
                    name,
                    isActivated: jsonSchema.isActivated,
                }));
        }
    }

    return {
        name: constraintName,
        keyType: 'PRIMARY KEY',
        columns: pkColumns,
        include: includeColumns,
        storageParameters,
        tablespace: indexTablespace,
    }
}


/**
 * @return {(columnJsonSchema: AlterCollectionColumnDto, collection: AlterCollectionDto) => boolean}
 * */
const wasFieldChangedToBeARegularPk = (_) => (columnJsonSchema, collection) => {
    const oldName = columnJsonSchema.compMod.oldField.name;
    const oldColumnJsonSchema = collection.role.properties[oldName];

    const isRegularPrimaryKey = columnJsonSchema.primaryKey && !columnJsonSchema.compositePrimaryKey;
    const wasTheFieldAnyPrimaryKey = Boolean(oldColumnJsonSchema?.primaryKey);

    return isRegularPrimaryKey && !wasTheFieldAnyPrimaryKey;
}

/**
 * @return {(columnJsonSchema: AlterCollectionColumnDto, collection: AlterCollectionDto) => PkTransitionDto}
 * */
const wasRegularPkChangedInTransitionFromCompositeToRegular = (_) => (columnJsonSchema, collection) => {
    const noTransition = {
        didTransitionHappen: false,
    }
    const oldName = columnJsonSchema.compMod.oldField.name;
    const oldColumnJsonSchema = collection.role.properties[oldName];

    const isRegularPrimaryKey = columnJsonSchema.primaryKey && !columnJsonSchema.compositePrimaryKey;
    const wasTheFieldAnyPrimaryKey = Boolean(oldColumnJsonSchema?.primaryKey);

    if (!(isRegularPrimaryKey && wasTheFieldAnyPrimaryKey)) {
        return noTransition;
    }

    /**
     * @type {AlterCollectionRoleCompModPrimaryKey}
     * */
    const pkDto = collection?.role?.compMod?.primaryKey || {};
    const newPrimaryKeys = pkDto.new || [];
    /**
     * @type {AlterCollectionRoleCompModPKDto[]}
     * */
    const oldPrimaryKeys = pkDto.old || [];
    const wasTheFieldACompositePrimaryKey = oldPrimaryKeys.some(compPk => compPk.compositePrimaryKey.some((pk) => pk.keyId === oldColumnJsonSchema.GUID));
    const isTheFieldACompositePrimaryKey = newPrimaryKeys.some(compPk => compPk.compositePrimaryKey.some((pk) => pk.keyId === columnJsonSchema.GUID));

    const wasCompositePkRemoved = wasTheFieldACompositePrimaryKey && !isTheFieldACompositePrimaryKey;

    if (isRegularPrimaryKey && wasCompositePkRemoved) {
        // return compare custom properties and amount of columns.
        // If there was a transition and amount of composite PK columns is not equal
        // to amount of regular pk columns, we must recreate PK
        const constraintOptions = getCustomPropertiesOfRegularPkForComparisonWithRegularPkOptions(columnJsonSchema);
        const areOptionsEqual = oldPrimaryKeys.some((oldCompositePk) => {
            if (oldCompositePk.compositePrimaryKey.length !== amountOfColumnsInRegularPk) {
                return false;
            }
            const oldCompositePkAsRegularPkOptions = getCustomPropertiesOfCompositePkForComparisonWithRegularPkOptions(oldCompositePk);
            return _(oldCompositePkAsRegularPkOptions).differenceWith(constraintOptions, _.isEqual).isEmpty();
        });
        return {
            didTransitionHappen: true,
            wasPkChangedInTransition: !areOptionsEqual,
        }
    }

    return noTransition;
}

/**
 * @return {(columnJsonSchema: AlterCollectionColumnDto, collection: AlterCollectionDto) => PkTransitionDto}
 * */
const wasRegularPkChangedInTransitionFromRegularToComposite = (_) => (columnJsonSchema, collection) => {
    const noTransition = {
        didTransitionHappen: false,
    }
    const oldName = columnJsonSchema.compMod.oldField.name;
    const oldColumnJsonSchema = collection.role.properties[oldName];

    const wasRegularPrimaryKey = oldColumnJsonSchema.primaryKey && !oldColumnJsonSchema.compositePrimaryKey;
    const isTheFieldAnyPrimaryKey = Boolean(columnJsonSchema?.primaryKey);

    if (!(wasRegularPrimaryKey && isTheFieldAnyPrimaryKey)) {
        return noTransition;
    }

    /**
     * @type {AlterCollectionRoleCompModPrimaryKey}
     * */
    const pkDto = collection?.role?.compMod?.primaryKey || {};
    const newPrimaryKeys = pkDto.new || [];
    /**
     * @type {AlterCollectionRoleCompModPKDto[]}
     * */
    const oldPrimaryKeys = pkDto.old || [];
    const wasTheFieldACompositePrimaryKey = oldPrimaryKeys.some(compPk => compPk.compositePrimaryKey.some((pk) => pk.keyId === oldColumnJsonSchema.GUID));
    const isTheFieldACompositePrimaryKey = newPrimaryKeys.some(compPk => compPk.compositePrimaryKey.some((pk) => pk.keyId === columnJsonSchema.GUID));

    const wasCompositePkAdded = isTheFieldACompositePrimaryKey && !wasTheFieldACompositePrimaryKey;

    if (wasRegularPrimaryKey && wasCompositePkAdded) {
        // return compare custom properties and amount of columns.
        // If there was a transition and amount of composite PK columns is not equal
        // to amount of regular pk columns, we must recreate PK
        const constraintOptions = getCustomPropertiesOfRegularPkForComparisonWithRegularPkOptions(oldColumnJsonSchema);
        const areOptionsEqual = newPrimaryKeys.some((oldCompositePk) => {
            if (oldCompositePk.compositePrimaryKey.length !== amountOfColumnsInRegularPk) {
                return false;
            }
            const oldCompositePkAsRegularPkOptions = getCustomPropertiesOfCompositePkForComparisonWithRegularPkOptions(oldCompositePk);
            return _(oldCompositePkAsRegularPkOptions).differenceWith(constraintOptions, _.isEqual).isEmpty();
        });
        return {
            didTransitionHappen: true,
            wasPkChangedInTransition: !areOptionsEqual,
        }
    }

    return noTransition;
}

/**
 * @return {(columnJsonSchema: AlterCollectionColumnDto, collection: AlterCollectionDto) => boolean}
 * */
const isFieldNoLongerARegularPk = (_) => (columnJsonSchema, collection) => {
    const oldName = columnJsonSchema.compMod.oldField.name;

    const oldJsonSchema = collection.role.properties[oldName];
    const wasTheFieldARegularPrimaryKey = oldJsonSchema?.primaryKey && !oldJsonSchema?.compositePrimaryKey;

    const isNotAnyPrimaryKey = !columnJsonSchema.primaryKey && !columnJsonSchema.compositePrimaryKey;
    return wasTheFieldARegularPrimaryKey && isNotAnyPrimaryKey;
}

/**
 * @return {(columnJsonSchema: AlterCollectionColumnDto, collection: AlterCollectionDto) => boolean}
 * */
const wasRegularPkModified = (_) => (columnJsonSchema, collection) => {
    const oldName = columnJsonSchema.compMod.oldField.name;
    const oldJsonSchema = collection.role.properties[oldName] || {};

    const isRegularPrimaryKey = columnJsonSchema.primaryKey && !columnJsonSchema.compositePrimaryKey;
    const wasTheFieldARegularPrimaryKey = oldJsonSchema?.primaryKey && !oldJsonSchema?.compositePrimaryKey;

    if (!(isRegularPrimaryKey && wasTheFieldARegularPrimaryKey)) {
        return false;
    }
    const constraintOptions = getCustomPropertiesOfRegularPkForComparisonWithRegularPkOptions(columnJsonSchema);
    const oldConstraintOptions = getCustomPropertiesOfRegularPkForComparisonWithRegularPkOptions(oldJsonSchema);
    const areOptionsEqual = _(oldConstraintOptions).differenceWith(constraintOptions, _.isEqual).isEmpty();
    return !areOptionsEqual;
}

/**
 * @return {(collection: AlterCollectionDto) => Array<AlterScriptDto>}
 * */
const getAddPkScripts = (_, ddlProvider) => (collection) => {
    const {
        getFullCollectionName,
        getSchemaOfAlterCollection,
        getEntityName,
    } = require('../../../utils/general')(_);

    const collectionSchema = getSchemaOfAlterCollection(collection);
    const fullTableName = getFullCollectionName(collectionSchema);
    const entityName = getEntityName(collectionSchema);

    return _.toPairs(collection.properties)
        .filter(([name, jsonSchema]) => {
            if (wasFieldChangedToBeARegularPk(_)(jsonSchema, collection)) {
                return true;
            }
            const transitionToRegularDto = wasRegularPkChangedInTransitionFromCompositeToRegular(_)(jsonSchema, collection);
            if (transitionToRegularDto.didTransitionHappen) {
                return transitionToRegularDto.wasPkChangedInTransition;
            }
            return wasRegularPkModified(_)(jsonSchema, collection);
        })
        .map(([name, jsonSchema]) => {
            const ddlConfig = getCreateRegularPKDDLProviderConfig(_)(name, jsonSchema, entityName, collection);
            return ddlProvider.createKeyConstraint(
                fullTableName,
                collection.isActivated,
                ddlConfig
            );
        })
        .map(scriptDto => AlterScriptDto.getInstance([scriptDto.statement], scriptDto.isActivated, false))
        .filter(Boolean);
}

/**
 * @return {(collection: AlterCollectionDto) => Array<AlterScriptDto>}
 * */
const getDropPkScript = (_, ddlProvider) => (collection) => {
    const {
        getFullCollectionName,
        getSchemaOfAlterCollection,
        getEntityName,
        wrapInQuotes
    } = require('../../../utils/general')(_);

    const collectionSchema = getSchemaOfAlterCollection(collection);
    const fullTableName = getFullCollectionName(collectionSchema);
    const entityName = getEntityName(collectionSchema);

    return _.toPairs(collection.properties)
        .filter(([name, jsonSchema]) => {
            if (isFieldNoLongerARegularPk(_)(jsonSchema, collection)) {
                return true;
            }
            const transitionToRegularDto = wasRegularPkChangedInTransitionFromRegularToComposite(_)(jsonSchema, collection);
            if (transitionToRegularDto.didTransitionHappen) {
                return transitionToRegularDto.wasPkChangedInTransition;
            }
            return wasRegularPkModified(_)(jsonSchema, collection);
        })
        .map(([name, jsonSchema]) => {
            const oldName = jsonSchema.compMod.oldField.name;
            const oldJsonSchema = collection.role.properties[oldName];
            const constraintName = wrapInQuotes(getConstraintNameForRegularPk(oldJsonSchema, entityName));
            return ddlProvider.dropPkConstraint(fullTableName, constraintName);
        })
        .map(scriptLine => AlterScriptDto.getInstance([scriptLine], collection.isActivated, true))
        .filter(Boolean);
}

/**
 * @return {(collection: AlterCollectionDto) => Array<AlterScriptDto>}
 * */
const getModifyPkScripts = (_, ddlProvider) => (collection) => {
    const dropPkScripts = getDropPkScript(_, ddlProvider)(collection);
    const addPkScripts = getAddPkScripts(_, ddlProvider)(collection);

    return [
        ...dropPkScripts,
        ...addPkScripts,
    ].filter(Boolean);
}

/**
 * @return {(collection: AlterCollectionDto) => Array<AlterScriptDto>}
 * */
const getModifyPkConstraintsScriptDtos = (_, ddlProvider) => (collection) => {
    const modifyCompositePkScripts = getModifyCompositePkScripts(_, ddlProvider)(collection);
    const modifyPkScripts = getModifyPkScripts(_, ddlProvider)(collection);

    return [
        ...modifyCompositePkScripts,
        ...modifyPkScripts,
    ].filter(Boolean);
}

module.exports = {
    getModifyPkConstraintsScriptDtos,
}
