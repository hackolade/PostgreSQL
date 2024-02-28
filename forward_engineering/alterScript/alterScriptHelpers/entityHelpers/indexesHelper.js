const {AlterCollectionDto} = require('../../types/AlterCollectionDto');
const {AlterIndexDto} = require('../../types/AlterIndexDto');
const {AlterScriptDto} = require("../../types/AlterScriptDto");

/**
 * @typedef {{
 *     oldIndex: AlterIndexDto,
 *     newIndex: AlterIndexDto,
 * }} ModifiedIndexDto
 * */

/**
 * @return {({ columnId: string, collection: AlterCollectionDto }) => string | undefined}
 * */
const getColumnNameById = ({_}) => ({columnId, collection}) => {
    const nameToSchemaInProperties = _.toPairs(collection.role.properties || {})
        .find(([fieldName, fieldJsonSchema]) => {
            return fieldJsonSchema.GUID === columnId;
        });
    if (nameToSchemaInProperties?.length) {
        return nameToSchemaInProperties[0];
    }
    return undefined;
}

/**
 * @return {({ index: AlterIndexDto, collection: AlterCollectionDto }) => Object}
 * */
const mapIndexToFeIndexDto = ({_}) => ({
                                           index, collection,
                                       }) => {
    const {getSchemaNameFromCollection} = require('../../../utils/general')(_);

    const schemaName = getSchemaNameFromCollection(collection);

    const columnsWithNamesSet = (index.columns || [])
        .map(indexedColumn => {
            return {
                ...indexedColumn, name: getColumnNameById({_})({columnId: indexedColumn.keyId, collection}),
            }
        })
        .filter(indexedColumn => Boolean(indexedColumn.name));

    return {
        ...index, schemaName, columns: columnsWithNamesSet,
    }
}

/**
 * @return {({ oldIndex: AlterIndexDto, newIndex: AlterIndexDto }) => boolean}
 * */
const wasIndexModified = ({_}) => ({oldIndex, newIndex}) => {
    if (oldIndex.id === newIndex.id) {
        return _.isEqual(newIndex, oldIndex);
    }
    // Case for removing and re-creating an index
    if (oldIndex.indxName === newIndex.indxName) {
        const oldIndexNoId = {
            ...oldIndex, id: undefined,
        };
        const newIndexNoId = {
            ...newIndex, id: undefined,
        };
        return _.isEqual(newIndexNoId, oldIndexNoId);
    }
    // It means "old index" and "new index" dtos describe 2 different indexes
    // Hence the "new" index was not modified
    return false;
}

/**
 * @param oldIndex {AlterIndexDto}
 * @param newIndex {AlterIndexDto}
 * @return {boolean}
 * */
const areOldIndexDtoAndNewIndexDtoDescribingSameDatabaseIndex = ({oldIndex, newIndex}) => {
    return (oldIndex.id === newIndex.id) || (oldIndex.indxName === oldIndex.indxName);
}

/**
 * @return {({
 *      collection: AlterCollectionDto,
 *      additionalDataForDdlProvider: Object,
 * }) => Array<AlterIndexDto>}
 * */
const getAddedIndexesScriptDtos = ({_, ddlProvider}) => ({collection, additionalDataForDdlProvider}) => {
    const { dbData, tableName, isParentActivated, } = additionalDataForDdlProvider;

    const newIndexes = collection?.role?.compMod?.Indxs?.new || [];
    const oldIndexes = collection?.role?.compMod?.Indxs?.old || [];

    return newIndexes
        .filter(newIndex => {
            const correspondingOldIndex = oldIndexes.find(oldIndex => areOldIndexDtoAndNewIndexDtoDescribingSameDatabaseIndex({
                oldIndex, newIndex
            }));
            return !Boolean(correspondingOldIndex);
        })
        .map(newIndex => mapIndexToFeIndexDto({_})({index: newIndex, collection}))
        .map(newIndex => {
            const script = ddlProvider.createIndex(tableName, newIndex, dbData, isParentActivated);
            const isIndexActivated = newIndex.isActivated && isParentActivated;
            return AlterScriptDto.getInstance([script], isIndexActivated, false);
        })
        .filter(Boolean);
}

/**
 * @return {({
 *      collection: AlterCollectionDto,
 *      additionalDataForDdlProvider: Object,
 * }) => Array<AlterIndexDto>}
 * */
const getDeletedIndexesScriptDtos = ({_, ddlProvider}) => ({collection, additionalDataForDdlProvider}) => {
    const { dbData, tableName, isParentActivated, } = additionalDataForDdlProvider;

    const newIndexes = collection?.role?.compMod?.Indxs?.new || [];
    const oldIndexes = collection?.role?.compMod?.Indxs?.old || [];

    return oldIndexes
        .filter(oldIndex => {
            const correspondingNewIndex = newIndexes.find(newIndex => areOldIndexDtoAndNewIndexDtoDescribingSameDatabaseIndex({
                oldIndex, newIndex
            }));
            return !Boolean(correspondingNewIndex);
        });
}

/**
 * @return {({ collection: AlterCollectionDto }) => Array<ModifiedIndexDto>}
 * */
const getModifiedIndexes = ({_}) => ({collection}) => {
    const newIndexes = collection?.role?.compMod?.Indxs?.new || [];
    const oldIndexes = collection?.role?.compMod?.Indxs?.old || [];

    return newIndexes
        .map(newIndex => {
            const correspondingOldIndex = oldIndexes.find(oldIndex => areOldIndexDtoAndNewIndexDtoDescribingSameDatabaseIndex({
                oldIndex, newIndex
            }));
            if (correspondingOldIndex) {
                return {
                    newIndex,
                    oldIndex: correspondingOldIndex,
                };
            }
            return undefined;
        })
        .filter(Boolean);
}

/**
 * @return {({ collection: AlterCollectionDto, dbVersion: string }) => Array<AlterScriptDto>}
 * */
const getModifyIndexesScriptDtos = ({_, ddlProvider}) => ({collection, dbVersion}) => {
    const additionalDataForDdlProvider = {
        dbData: {dbVersion},
        tableName: collection?.compMod?.collectionName?.new || '',
        isParentActivated: collection.isActivated,
    }

    return []
        .filter(Boolean);
}

module.exports = {}
