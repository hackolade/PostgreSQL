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
 * @return {({
 *      columns?: Array<{keyId: string}>,
 *      collection: AlterCollectionDto
 * }) => Object}
 * */
const setNamesToColumns = ({_}) => ({columns, collection}) => {
    return (columns || [])
        .map(column => {
            return {
                ...column, name: getColumnNameById({_})({columnId: column.keyId, collection}),
            }
        })
        .filter(column => Boolean(column.name));
}

/**
 * @return {({ index: AlterIndexDto, collection: AlterCollectionDto }) => Object}
 * */
const mapIndexToFeIndexDto = ({_}) => ({
                                           index, collection,
                                       }) => {
    const {getSchemaNameFromCollection} = require('../../../utils/general')(_);

    const schemaName = getSchemaNameFromCollection({collection});

    const columnsWithNamesSet = setNamesToColumns({_})({
        columns: index.columns,
        collection
    });

    const includeColumnsWithNameSet = setNamesToColumns({_})({
        columns: index.include,
        collection
    });

    return {
        ...index,
        schemaName,
        columns: columnsWithNamesSet,
        include: includeColumnsWithNameSet,
    }
}

/**
 * @return {({
 * oldIndex: AlterIndexDto,
 * newIndex: AlterIndexDto,
 * indexPropertiesToCompare: Array<string>,
 * }) => boolean}
 * */
const areIndexesDifferent = ({_}) => ({oldIndex, newIndex, indexPropertiesToCompare}) => {
    const newIndexWithRelevantProperties = _.pick(newIndex, indexPropertiesToCompare);
    const oldIndexWithRelevantProperties = _.pick(oldIndex, indexPropertiesToCompare);
    return !_.isEqual(newIndexWithRelevantProperties, oldIndexWithRelevantProperties);
}

/**
 * @return {({ oldIndex: AlterIndexDto, newIndex: AlterIndexDto }) => boolean}
 * */
const shouldDropAndRecreateIndex = ({_}) => ({oldIndex, newIndex}) => {
    const indexPropertiesToCompare = [
        'index_method',
        'columns',
        'include',
        'nullsDistinct',
        'where',
    ];
    return areIndexesDifferent({_})({ oldIndex, newIndex, indexPropertiesToCompare });
}

/**
 * @return {({ oldIndex: AlterIndexDto, newIndex: AlterIndexDto }) => boolean}
 * */
const shouldAlterIndex = ({_}) => ({oldIndex, newIndex}) => {
    const indexPropertiesToCompare = [
        'indxName',
        'index_tablespace_name',
        'index_storage_parameter'
    ];
    return areIndexesDifferent({_})({ oldIndex, newIndex, indexPropertiesToCompare });
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
 *      index: AlterIndexDto,
 *      collection: AlterCollectionDto,
 *      additionalDataForDdlProvider: Object,
 * }) => AlterScriptDto | undefined}
 * */
const getCreateIndexScriptDto = ({ _, ddlProvider }) => ({ index, collection, additionalDataForDdlProvider }) => {
    const {getNamePrefixedWithSchemaName} = require('../../../utils/general')(_);

    const {dbData, tableName, isParentActivated, schemaName} = additionalDataForDdlProvider;

    const indexForFeScript = mapIndexToFeIndexDto({_})({index, collection});
    const fullIndexName = getNamePrefixedWithSchemaName(indexForFeScript.indxName, schemaName);
    const indexWithFullName = {
        ...indexForFeScript,
        indxName: fullIndexName,
    }

    const script = ddlProvider.createIndex(tableName, indexWithFullName, dbData, isParentActivated);
    const isIndexActivated = indexForFeScript.isActivated && isParentActivated;
    return AlterScriptDto.getInstance([script], isIndexActivated, false);
}

/**
 * @return {({
 *      collection: AlterCollectionDto,
 *      additionalDataForDdlProvider: Object,
 * }) => Array<AlterScriptDto>}
 * */
const getAddedIndexesScriptDtos = ({_, ddlProvider}) => ({collection, additionalDataForDdlProvider}) => {
    const newIndexes = collection?.role?.compMod?.Indxs?.new || [];
    const oldIndexes = collection?.role?.compMod?.Indxs?.old || [];

    return newIndexes
        .filter(newIndex => {
            const correspondingOldIndex = oldIndexes.find(oldIndex => areOldIndexDtoAndNewIndexDtoDescribingSameDatabaseIndex({
                oldIndex, newIndex
            }));
            return !Boolean(correspondingOldIndex);
        })
        .map(newIndex => {
            return getCreateIndexScriptDto({ _, ddlProvider })({
                index: newIndex,
                collection,
                additionalDataForDdlProvider
            });
        })
        .filter(Boolean);
}

/**
 * @return {({
 *      index: AlterIndexDto,
 *      additionalDataForDdlProvider: Object,
 * }) => AlterScriptDto | undefined}
 * */
const getDeleteIndexScriptDto = ({ _, ddlProvider }) => ({ index, additionalDataForDdlProvider }) => {
    const {getNamePrefixedWithSchemaName, wrapInQuotes} = require('../../../utils/general')(_);

    const {isParentActivated, schemaName} = additionalDataForDdlProvider;

    const fullIndexName = getNamePrefixedWithSchemaName(index.indxName, schemaName);
    const ddlIndexName = wrapInQuotes(fullIndexName);
    const script = ddlProvider.dropIndex({indexName: ddlIndexName});
    const isIndexActivated = index.isActivated && isParentActivated;
    return AlterScriptDto.getInstance([script], isIndexActivated, true);
}

/**
 * @return {({
 *      collection: AlterCollectionDto,
 *      additionalDataForDdlProvider: Object,
 * }) => Array<AlterScriptDto>}
 * */
const getDeletedIndexesScriptDtos = ({_, ddlProvider}) => ({collection, additionalDataForDdlProvider}) => {
    const newIndexes = collection?.role?.compMod?.Indxs?.new || [];
    const oldIndexes = collection?.role?.compMod?.Indxs?.old || [];

    return oldIndexes
        .filter(oldIndex => {
            const correspondingNewIndex = newIndexes.find(newIndex => areOldIndexDtoAndNewIndexDtoDescribingSameDatabaseIndex({
                oldIndex, newIndex
            }));
            return !Boolean(correspondingNewIndex);
        })
        .map(oldIndex => {
            return getDeleteIndexScriptDto({_, ddlProvider})({ index: oldIndex, additionalDataForDdlProvider });
        })
        .filter(Boolean);
}

/**
 * @return {({
 *      collection: AlterCollectionDto,
 *      additionalDataForDdlProvider: Object,
 * }) => Array<AlterScriptDto>}
 * */
const getModifiedIndexesScriptDtos = ({_, ddlProvider}) => ({collection, additionalDataForDdlProvider}) => {
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
        .filter(Boolean)
        .flatMap(({ newIndex, oldIndex }) => {
            const shouldDropAndRecreate = shouldDropAndRecreateIndex({ _ })({ newIndex, oldIndex });
            if (shouldDropAndRecreate) {
                const deleteIndexScriptDto = getDeleteIndexScriptDto({ _, ddlProvider })({ index: oldIndex, additionalDataForDdlProvider });
                const createIndexScriptDto = getCreateIndexScriptDto({ _, ddlProvider })({
                    index: newIndex,
                    collection,
                    additionalDataForDdlProvider
                });
                return [deleteIndexScriptDto, createIndexScriptDto];
            }

            const shouldAlter = shouldAlterIndex({_})({ oldIndex, newIndex });
            if (shouldAlter) {
                return [];
            }

            return [];
        })
        .filter(Boolean);
}

/**
 * @return {({ collection: AlterCollectionDto, dbVersion: string }) => Array<AlterScriptDto>}
 * */
const getModifyIndexesScriptDtos = ({_, ddlProvider}) => ({collection, dbVersion}) => {
    const {getSchemaNameFromCollection} = require('../../../utils/general')(_);
    const additionalDataForDdlProvider = {
        dbData: {dbVersion},
        tableName: collection?.compMod?.collectionName?.new || '',
        schemaName: getSchemaNameFromCollection({collection}) || '',
        isParentActivated: collection.isActivated,
    }

    const deletedIndexesScriptDtos = getDeletedIndexesScriptDtos({_, ddlProvider})({
        collection, additionalDataForDdlProvider
    });
    const addedIndexesScriptDtos = getAddedIndexesScriptDtos({_, ddlProvider})({
        collection, additionalDataForDdlProvider
    });
    const modifyIndexesScriptDtos = getModifiedIndexesScriptDtos({ _, ddlProvider })({
        collection, additionalDataForDdlProvider
    })

    return [
        ...deletedIndexesScriptDtos,
        ...addedIndexesScriptDtos,
        ...modifyIndexesScriptDtos,
    ]
        .filter(Boolean);
}

module.exports = {
    getModifyIndexesScriptDtos,
}
