const _ = require('lodash');
const { AlterCollectionDto } = require('../../types/AlterCollectionDto');
const { AlterIndexDto } = require('../../types/AlterIndexDto');
const { AlterScriptDto } = require('../../types/AlterScriptDto');
const { getSchemaNameFromCollection, getNamePrefixedWithSchemaName, wrapInQuotes } = require('../../../utils/general');
const { dropIndex, createIndex, getWithOptions } = require('../../../ddlProvider/ddlHelpers/indexHelper');
const assignTemplates = require('../../../utils/assignTemplates');
const templates = require('../../../ddlProvider/templates');

/**
 * @typedef {{
 *     oldIndex: AlterIndexDto,
 *     newIndex: AlterIndexDto,
 * }} ModifiedIndexDto
 * */

/**
 * @param {string} columnId
 * @param {AlterCollectionDto} collection
 * @return {string | undefined}
 * */
const getColumnNameById = ({ columnId, collection }) => {
	const rolePropertiesEntries = _.toPairs(collection?.role?.properties || collection?.properties || {}).map(
		([name, value]) => ({ ...value, name }),
	);
	const oldProperties = (collection?.role?.compMod?.oldProperties || []).map(property => ({
		...property,
		GUID: property.id,
	}));
	const properties = rolePropertiesEntries.length > 0 ? rolePropertiesEntries : oldProperties;
	const propertySchema = properties.find(fieldJsonSchema => fieldJsonSchema.GUID === columnId);

	if (propertySchema) {
		return propertySchema.name;
	}

	return undefined;
};

/**
 * @param {Array<{keyId: string}>} columns
 * @param {AlterCollectionDto} collection
 * @return {Object}
 * */
const setNamesToColumns = ({ columns, collection }) => {
	return (columns || [])
		.map(column => {
			return {
				...column,
				name: getColumnNameById({ columnId: column.keyId, collection }),
			};
		})
		.filter(column => Boolean(column.name));
};

/**
 * @param {AlterIndexDto} index
 * @param {AlterCollectionDto} collection
 * @return {Object}
 * */
const mapIndexToFeIndexDto = ({ index, collection }) => {
	const schemaName = getSchemaNameFromCollection({ collection });

	const columnsWithNamesSet = setNamesToColumns({
		columns: index.columns,
		collection,
	});

	const includeColumnsWithNameSet = setNamesToColumns({
		columns: index.include,
		collection,
	});

	return {
		...index,
		schemaName,
		columns: columnsWithNamesSet,
		include: includeColumnsWithNameSet,
	};
};

/**
 * @param {AlterIndexDto} oldIndex
 * @param {AlterIndexDto} newIndex
 * @param {Array<string>} indexPropertiesToCompare
 * @return {boolean}
 * */
const areIndexesDifferent = ({ oldIndex, newIndex, indexPropertiesToCompare }) => {
	const newIndexWithRelevantProperties = _.pick(newIndex, indexPropertiesToCompare);
	const oldIndexWithRelevantProperties = _.pick(oldIndex, indexPropertiesToCompare);
	return !_.isEqual(newIndexWithRelevantProperties, oldIndexWithRelevantProperties);
};

/**
 * @param {string} schemaName
 * @param {string} oldIndexName
 * @param {string} newIndexName
 * @return {string}
 * */
const alterIndexRename = ({ schemaName, oldIndexName, newIndexName }) => {
	const ddlSchemaName = wrapInQuotes(schemaName);
	const ddlOldIndexName = getNamePrefixedWithSchemaName(wrapInQuotes(oldIndexName), ddlSchemaName);
	const ddlNewIndexName = wrapInQuotes(newIndexName);

	const templatesConfig = {
		oldIndexName: ddlOldIndexName,
		newIndexName: ddlNewIndexName,
	};
	return assignTemplates(templates.alterIndexRename, templatesConfig);
};

/**
 * @param {string} schemaName
 * @param {string} indexName
 * @param {string} tablespaceName
 * @return {string}
 * */
const alterIndexTablespace = ({ schemaName, indexName, tablespaceName }) => {
	const ddlSchemaName = wrapInQuotes(schemaName);
	const ddlIndexName = getNamePrefixedWithSchemaName(wrapInQuotes(indexName), ddlSchemaName);

	const templatesConfig = {
		indexName: ddlIndexName,
		tablespaceName,
	};
	return assignTemplates(templates.alterIndexTablespace, templatesConfig);
};

/**
 * @param {string} schemaName
 * @param {string} indexName
 * @param {Object} index
 * @return {string}
 * */
const alterIndexStorageParams = ({ schemaName, indexName, index }) => {
	const ddlSchemaName = wrapInQuotes(schemaName);
	const ddlIndexName = getNamePrefixedWithSchemaName(wrapInQuotes(indexName), ddlSchemaName);

	const ddlIndexStorageParameters = getWithOptions(index);
	const templatesConfig = {
		indexName: ddlIndexName,
		options: ddlIndexStorageParameters,
	};
	return assignTemplates(templates.alterIndexStorageParams, templatesConfig);
};

/**
 * @param {string} schemaName
 * @param {string} indexName
 * @return {string}
 * */
const reindexIndex = ({ schemaName, indexName }) => {
	const ddlSchemaName = wrapInQuotes(schemaName);
	const ddlIndexName = getNamePrefixedWithSchemaName(wrapInQuotes(indexName), ddlSchemaName);

	const templatesConfig = {
		indexName: ddlIndexName,
	};
	return assignTemplates(templates.reindexIndex, templatesConfig);
};

/**
 * @param {AlterIndexDto} oldIndex
 * @param {AlterIndexDto} newIndex
 * @return {boolean}
 * */
const shouldDropAndRecreateIndex = ({ oldIndex, newIndex }) => {
	const indexPropertiesToCompare = ['index_method', 'columns', 'include', 'nullsDistinct', 'where'];
	return areIndexesDifferent({ oldIndex, newIndex, indexPropertiesToCompare });
};

/**
 * @param {AlterIndexDto} oldIndex
 * @param {AlterIndexDto} newIndex
 * @return {boolean}
 * */
const shouldAlterIndex = ({ oldIndex, newIndex }) => {
	const indexPropertiesToCompare = ['indxName', 'index_tablespace_name', 'index_storage_parameter'];
	return areIndexesDifferent({ oldIndex, newIndex, indexPropertiesToCompare });
};

/**
 * @param {AlterIndexDto} oldIndex
 * @param {AlterIndexDto} newIndex
 * @return {boolean}
 * */
const areOldIndexDtoAndNewIndexDtoDescribingSameDatabaseIndex = ({ oldIndex, newIndex }) => {
	return oldIndex.id === newIndex.id || oldIndex.indxName === newIndex.indxName;
};

/**
 * @param {AlterIndexDto} index
 * @param {AlterCollectionDto} collection
 * @param {Object} additionalDataForDdlProvider
 * @return {AlterScriptDto | undefined}
 * */
const getCreateIndexScriptDto = ({ index, collection, additionalDataForDdlProvider }) => {
	const { dbData, tableName, isParentActivated } = additionalDataForDdlProvider;

	const indexForFeScript = mapIndexToFeIndexDto({ index, collection });

	const script = createIndex(tableName, indexForFeScript, dbData, isParentActivated);
	const isIndexActivated = indexForFeScript.isActivated && isParentActivated;
	return AlterScriptDto.getInstance([script], isIndexActivated, false);
};

/**
 * @param {AlterCollectionDto} collection
 * @param {Object} additionalDataForDdlProvider
 * @return {Array<AlterScriptDto>}
 * */
const getAddedIndexesScriptDtos = ({ collection, additionalDataForDdlProvider }) => {
	const newIndexes = collection?.role?.Indxs || [];
	const oldIndexes = collection?.role?.compMod?.Indxs?.old || [];

	return newIndexes
		.filter(newIndex => {
			const correspondingOldIndex = oldIndexes.find(oldIndex =>
				areOldIndexDtoAndNewIndexDtoDescribingSameDatabaseIndex({
					oldIndex,
					newIndex,
				}),
			);
			return !correspondingOldIndex;
		})
		.map(newIndex => {
			return getCreateIndexScriptDto({
				index: newIndex,
				collection,
				additionalDataForDdlProvider,
			});
		})
		.filter(Boolean);
};

/**
 * @param {AlterIndexDto} index
 * @param {Object} additionalDataForDdlProvider
 * @return {AlterScriptDto | undefined}
 * */
const getDeleteIndexScriptDto = ({ index, additionalDataForDdlProvider }) => {
	const { isParentActivated, schemaName } = additionalDataForDdlProvider;

	const fullIndexName = getNamePrefixedWithSchemaName(index.indxName, schemaName);
	const script = dropIndex({ indexName: fullIndexName });
	const isIndexActivated = index.isActivated && isParentActivated;
	return AlterScriptDto.getInstance([script], isIndexActivated, true);
};

/**
 * @param {AlterCollectionDto} collection
 * @param {Object} additionalDataForDdlProvider
 * @return {Array<AlterScriptDto>}
 * */
const getDeletedIndexesScriptDtos = ({ collection, additionalDataForDdlProvider }) => {
	const newIndexes = collection?.role?.compMod?.Indxs?.new || [];
	const oldIndexes = collection?.role?.compMod?.Indxs?.old || [];

	return oldIndexes
		.filter(oldIndex => {
			const correspondingNewIndex = newIndexes.find(newIndex =>
				areOldIndexDtoAndNewIndexDtoDescribingSameDatabaseIndex({
					oldIndex,
					newIndex,
				}),
			);
			return !correspondingNewIndex;
		})
		.map(oldIndex => {
			return getDeleteIndexScriptDto({ index: oldIndex, additionalDataForDdlProvider });
		})
		.filter(Boolean);
};

/**
 * @param {Object} additionalDataForDdlProvider
 * @param {AlterIndexDto} newIndex
 * @param {AlterIndexDto} oldIndex
 * @return {Array<AlterScriptDto>}
 * */
const getAlterIndexScriptDtos = ({ newIndex, oldIndex, additionalDataForDdlProvider }) => {
	const alterIndexScriptDtos = [];

	const { isParentActivated, schemaName } = additionalDataForDdlProvider;
	const isNewIndexActivated = newIndex.isActivated && isParentActivated;

	const shouldRename = !_.isEqual(newIndex.indxName, oldIndex.indxName);
	if (shouldRename) {
		const script = alterIndexRename({
			schemaName,
			oldIndexName: oldIndex.indxName,
			newIndexName: newIndex.indxName,
		});
		const renameScriptDto = AlterScriptDto.getInstance([script], isNewIndexActivated, false);
		alterIndexScriptDtos.push(renameScriptDto);
	}

	const shouldUpdateTablespace = !_.isEqual(newIndex.index_tablespace_name, oldIndex.index_tablespace_name);
	if (shouldUpdateTablespace) {
		const script = alterIndexTablespace({
			schemaName,
			indexName: newIndex.indxName,
			tablespaceName: newIndex.index_tablespace_name,
		});
		const changeTablespaceScriptDto = AlterScriptDto.getInstance([script], isNewIndexActivated, false);
		alterIndexScriptDtos.push(changeTablespaceScriptDto);
	}

	const shouldUpdateStorageParams = !_.isEqual(newIndex.index_storage_parameter, oldIndex.index_storage_parameter);
	if (shouldUpdateStorageParams) {
		const updateStorageParamsScript = alterIndexStorageParams({
			schemaName,
			indexName: newIndex.indxName,
			index: newIndex,
		});
		const updateStorageParamsScriptDto = AlterScriptDto.getInstance(
			[updateStorageParamsScript],
			isNewIndexActivated,
			false,
		);
		alterIndexScriptDtos.push(updateStorageParamsScriptDto);

		const reindexScript = reindexIndex({
			schemaName,
			indexName: newIndex.indxName,
		});
		const reindexScriptDto = AlterScriptDto.getInstance([reindexScript], isNewIndexActivated, false);
		alterIndexScriptDtos.push(reindexScriptDto);
	}

	return alterIndexScriptDtos.filter(Boolean);
};

/**
 * @param {AlterCollectionDto} collection
 * @param {Object} additionalDataForDdlProvider
 * @return {Array<AlterScriptDto>}
 * */
const getModifiedIndexesScriptDtos = ({ collection, additionalDataForDdlProvider }) => {
	const newIndexes = collection?.role?.compMod?.Indxs?.new || [];
	const oldIndexes = collection?.role?.compMod?.Indxs?.old || [];

	return newIndexes
		.map(newIndex => {
			const correspondingOldIndex = oldIndexes.find(oldIndex =>
				areOldIndexDtoAndNewIndexDtoDescribingSameDatabaseIndex({
					oldIndex,
					newIndex,
				}),
			);
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
			const shouldDropAndRecreate = shouldDropAndRecreateIndex({ newIndex, oldIndex });
			if (shouldDropAndRecreate) {
				const deleteIndexScriptDto = getDeleteIndexScriptDto({
					index: oldIndex,
					additionalDataForDdlProvider,
				});
				const createIndexScriptDto = getCreateIndexScriptDto({
					index: newIndex,
					collection,
					additionalDataForDdlProvider,
				});
				return [deleteIndexScriptDto, createIndexScriptDto];
			}

			const shouldAlter = shouldAlterIndex({ oldIndex, newIndex });
			if (shouldAlter) {
				return getAlterIndexScriptDtos({
					oldIndex,
					newIndex,
					additionalDataForDdlProvider,
				});
			}

			return [];
		})
		.filter(Boolean);
};

/**
 * @param {AlterCollectionDto} collection
 * @param {string} dbVersion
 * @return {Array<AlterScriptDto>}
 * */
const getModifyIndexesScriptDtos = ({ collection, dbVersion }) => {
	const additionalDataForDdlProvider = getAdditionalDataForDdlProvider({ dbVersion, collection });

	const deletedIndexesScriptDtos = getDeletedIndexesScriptDtos({
		collection,
		additionalDataForDdlProvider,
	});
	const addedIndexesScriptDtos = getAddedIndexesScriptDtos({
		collection,
		additionalDataForDdlProvider,
	});
	const modifyIndexesScriptDtos = getModifiedIndexesScriptDtos({
		collection,
		additionalDataForDdlProvider,
	});

	return [...deletedIndexesScriptDtos, ...addedIndexesScriptDtos, ...modifyIndexesScriptDtos].filter(Boolean);
};

/**
 * @param {AlterCollectionDto} collection
 * @param {string} dbVersion
 * */
const getAdditionalDataForDdlProvider = ({ dbVersion, collection }) => {
	return {
		dbData: { dbVersion },
		tableName: collection?.compMod?.collectionName?.new || collection?.role?.name || '',
		schemaName: getSchemaNameFromCollection({ collection }) || '',
		isParentActivated: collection.isActivated,
	};
};

module.exports = {
	getModifyIndexesScriptDtos,
	getAddedIndexesScriptDtos,
	getAdditionalDataForDdlProvider,
};
