const { AlterScriptDto } = require('../../types/AlterScriptDto');
const {
    AlterCollectionDto,
    AlterCollectionColumnDto,
    AlterCollectionRoleCompModPKDto,
    AlterCollectionColumnPrimaryKeyOptionDto
} = require('../../types/AlterCollectionDto');


/**
 * @return {(collection: AlterCollectionDto, guid: string) => AlterCollectionColumnDto | undefined}
 * */
const getPropertyByGuid = (_) => (collection, guid) => {
    const propertyInArray = _.toPairs(collection?.role?.properties)
        .filter(([name, jsonSchema]) => jsonSchema.GUID === guid)
        .map(([name, jsonSchema]) => jsonSchema);
    if (!propertyInArray.length) {
        return undefined;
    }
    return propertyInArray[0];
}

/**
 * @return {(collection: AlterCollectionDto, guids: string[]) => Array<AlterCollectionColumnDto>}
 * */
const getPropertiesByGuids = (_) => (collection, guids) => {
    return guids
        .map(guid => getPropertyByGuid(_)(collection, guid))
        .filter(Boolean);
}

/**
 * @return {(collection: AlterCollectionDto) => boolean}
 * */
const didCompositePkChange = (_) => (collection) => {
    const pkDto = collection?.role?.compMod?.primaryKey || {};
    const newPrimaryKeys = pkDto.new || [];
    const oldPrimaryKeys = pkDto.old || [];
    if (newPrimaryKeys.length !== oldPrimaryKeys.length) {
        return true;
    }
    if (newPrimaryKeys.length === 0 && oldPrimaryKeys.length === 0) {
        return false;
    }
    const areKeyArraysEqual = _(oldPrimaryKeys).differenceWith(newPrimaryKeys, _.isEqual).isEmpty();
    return !areKeyArraysEqual;
}

/**
 * @param wrapInQuotes {(s: string) => string}
 * @return {(entityName: string) => string}
 * */
const getDefaultConstraintName = (wrapInQuotes) => (entityName) => {
    return wrapInQuotes(`${entityName}_pk`);
}

/**
 * @return {(collection: AlterCollectionDto) => Array<AlterScriptDto>}
 * */
const getAddCompositePkScripts = (_, ddlProvider) => (collection) => {
    const didPkChange = didCompositePkChange(_)(collection);
    if (!didPkChange) {
        return []
    }
    const fullTableName = generateFullEntityName(collection);
    const constraintName = getEntityNameFromCollection(collection) + '_pk';
    const pkDto = collection?.role?.compMod?.primaryKey || {};
    const newPrimaryKeys = pkDto.new || [];

    return newPrimaryKeys
        .map((newPk) => {
            /**
             * @type {Array<AlterCollectionRoleCompModPKDto>}
             * */
            const compositePrimaryKey = newPk.compositePrimaryKey || [];
            const guidsOfColumnsInPk = compositePrimaryKey.map((compositePkEntry) => compositePkEntry.keyId);
            const columnsInPk = getPropertiesByGuids(_)(collection, guidsOfColumnsInPk);
            const columnNamesForDDL = columnsInPk.map(column => prepareName(column.compMod.newField.name));
            if (!columnNamesForDDL.length) {
                return undefined;
            }
            return ddlProvider.addPkConstraint(fullTableName, constraintName, columnNamesForDDL);
        })
        .filter(Boolean)
        .map(scriptLine => AlterScriptDto.getInstance([scriptLine], collection.isActivated, false))
        .filter(Boolean);
}

/**
 * @return {(collection: AlterCollectionDto) => Array<AlterScriptDto>}
 * */
const getDropCompositePkScripts = (_, ddlProvider) => (collection) => {
    const didPkChange = didCompositePkChange(_)(collection);
    if (!didPkChange) {
        return []
    }
    const fullTableName = generateFullEntityName(collection);
    const pkDto = collection?.role?.compMod?.primaryKey || {};
    const oldPrimaryKeys = pkDto.old || [];
    return oldPrimaryKeys
        .map(oldPk => ddlProvider.dropPkConstraint(fullTableName))
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
 * @return {(collection: AlterCollectionDto) => Array<AlterScriptDto>}
 * */
const getAddPkScripts = (_, ddlProvider) => (collection) => {
    const {
        getFullCollectionName,
        getSchemaOfAlterCollection,
        getEntityName,
        wrapInQuotes
    } = require('../../../utils/general')(_);
    const collectionSchema = getSchemaOfAlterCollection(collection);

    const fullTableName = getFullCollectionName(collectionSchema);
    const entityName = getEntityName(collectionSchema);
    const constraintName = getDefaultConstraintName(wrapInQuotes)(entityName);

    return _.toPairs(collection.properties)
        .filter(([name, jsonSchema]) => {
            const isRegularPrimaryKey = jsonSchema.primaryKey && !jsonSchema.compositePrimaryKey;
            const oldName = jsonSchema.compMod.oldField.name;
            const wasTheFieldAPrimaryKey = Boolean(collection.role.properties[oldName]?.primaryKey);
            return isRegularPrimaryKey && !wasTheFieldAPrimaryKey;
        })
        .map(([name, jsonSchema]) => {
            const pkColumns = [{
                name: wrapInQuotes(name),
                isActivated: jsonSchema.isActivated,
            }]

            return ddlProvider.createKeyConstraint(
                fullTableName,
                collection.isActivated,
                {
                    name: constraintName,
                    columns: pkColumns,
                    include: [],
                    storageParameters: '',
                    tablespace: '',
                });
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
            const oldName = jsonSchema.compMod.oldField.name;
            const oldJsonSchema = collection.role.properties[oldName];
            const wasTheFieldARegularPrimaryKey = oldJsonSchema?.primaryKey && !oldJsonSchema?.compositePrimaryKey;

            const isNotAPrimaryKey = !jsonSchema.primaryKey && !jsonSchema.compositePrimaryKey;
            return wasTheFieldARegularPrimaryKey && isNotAPrimaryKey;
        })
        .map(([name, jsonSchema]) => {
            const constraintOptions = jsonSchema.primaryKeyOptions;
            let constraintName = getDefaultConstraintName(wrapInQuotes)(entityName);
            if (constraintOptions?.length && constraintOptions?.length > 0) {
                /**
                 * @type {AlterCollectionColumnPrimaryKeyOptionDto}
                 * */
                const constraintOption = constraintOptions[0];
                if (constraintOption.constraintName) {
                    constraintName = wrapInQuotes(constraintOption.constraintName);
                }
            }

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
    // const modifyCompositePkScripts = getModifyCompositePkScripts(_, ddlProvider)(collection);
    const modifyPkScripts = getModifyPkScripts(_, ddlProvider)(collection);

    return [
        // ...modifyCompositePkScripts,
        ...modifyPkScripts,
    ].filter(Boolean);
}

module.exports = {
    getModifyPkConstraintsScriptDtos,
}
