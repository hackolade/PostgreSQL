const { AlterScriptDto } = require('../../types/AlterScriptDto');
const {AlterCollectionDto, AlterCollectionColumnDto,AlterCollectionRoleCompModPKDto} = require('../../types/AlterCollectionDto');


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
    const { getFullCollectionName, getSchemaOfAlterCollection } = require('../../../utils/general')(_);
    const collectionSchema = getSchemaOfAlterCollection(collection);

    const fullTableName = getFullCollectionName(collectionSchema);
    const constraintName = getEntityNameFromCollection(collection) + '_pk';

    return _.toPairs(collection.properties)
        .filter(([name, jsonSchema]) => {
            const isRegularPrimaryKey = jsonSchema.primaryKey && !jsonSchema.compositePrimaryKey;
            const oldName = jsonSchema.compMod.oldField.name;
            const wasTheFieldAPrimaryKey = Boolean(collection.role.properties[oldName]?.primaryKey);
            return isRegularPrimaryKey && !wasTheFieldAPrimaryKey;
        })
        .map(([name, jsonSchema]) => {
            const nameForDDl = prepareName(name);
            const columnNamesForDDL = [nameForDDl];
            return ddlProvider.addPkConstraint(fullTableName, constraintName, columnNamesForDDL);
        })
        .map(scriptLine => AlterScriptDto.getInstance([scriptLine], collection.isActivated, false))
        .filter(Boolean);
}

/**
 * @return {(collection: AlterCollectionDto) => Array<AlterScriptDto>}
 * */
const getDropPkScripts = (_, ddlProvider) => (collection) => {
    const fullTableName = generateFullEntityName(collection);

    return _.toPairs(collection.properties)
        .filter(([name, jsonSchema]) => {
            const oldName = jsonSchema.compMod.oldField.name;
            const oldJsonSchema = collection.role.properties[oldName];
            const wasTheFieldARegularPrimaryKey = oldJsonSchema?.primaryKey && !oldJsonSchema?.compositePrimaryKey;

            const isNotAPrimaryKey = !jsonSchema.primaryKey && !jsonSchema.compositePrimaryKey;
            return wasTheFieldARegularPrimaryKey && isNotAPrimaryKey;
        })
        .map(([name, jsonSchema]) => {
            return ddlProvider.dropConstraint(fullTableName, );
        })
        .map(scriptLine => AlterScriptDto.getInstance([scriptLine], collection.isActivated, true))
        .filter(Boolean);
}

/**
 * @return {(collection: AlterCollectionDto) => Array<AlterScriptDto>}
 * */
const getModifyPkScripts = (_, ddlProvider) => (collection) => {
    const dropPkScripts = getDropPkScripts(_, ddlProvider)(collection);
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
