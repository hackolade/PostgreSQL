const _ = require('lodash');
const {
	getAddContainerScriptDto,
	getDeleteContainerScriptDto,
	getModifyContainerScriptDtos,
} = require('./alterScriptHelpers/alterContainerHelper');
const {
	getAddCollectionScriptDto,
	getDeleteCollectionScriptDto,
	getAddColumnScriptDtos,
	getDeleteColumnScriptDtos,
	getModifyColumnScriptDtos,
	getModifyCollectionScriptDtos,
	getModifyCollectionKeysScriptDtos,
} = require('./alterScriptHelpers/alterEntityHelper');
const {
	getDeleteUdtScriptDto,
	getCreateUdtScriptDto,
	getAddColumnToTypeScriptDtos,
	getDeleteColumnFromTypeScriptDtos,
	getModifyColumnOfTypeScriptDtos,
} = require('./alterScriptHelpers/alterUdtHelper');
const {
	getAddViewScriptDto,
	getDeleteViewScriptDto,
	getModifyViewScriptDtos,
} = require('./alterScriptHelpers/alterViewHelper');
const {
	getModifyForeignKeyScriptDtos,
	getDeleteForeignKeyScriptDtos,
	getAddForeignKeyScriptDtos,
} = require('./alterScriptHelpers/alterRelationshipsHelper');
const { AlterScriptDto, ModificationScript } = require('./types/AlterScriptDto');
const { App, CoreData } = require('../types/coreApplicationTypes');
const { InternalDefinitions, ModelDefinitions, ExternalDefinitions } = require('../types/coreApplicationDataTypes');
const {
	getModifyContainerSequencesScriptDtos,
	getDeleteContainerSequencesScriptDtos,
	getAddContainerSequencesScriptDtos,
} = require('./alterScriptHelpers/containerHelpers/sequencesHelper');
const { isObjectInDeltaModelActivated } = require('../utils/general');
const { getModifiedCommentOnColumnScriptDtos } = require('./alterScriptHelpers/columnHelpers/commentsHelper');

const getItems = data => [data?.items].flat().filter(Boolean);
const getItemProperties = data => getItems(data).map(item => Object.values(item.properties)[0]);

/**
 * @param dto {{
 *     collection: Object
 * }}
 * @return {AlterScriptDto[]}
 * */
const getAlterContainersScriptDtos = ({ collection }) => {
	const containersData = collection.properties?.containers?.properties;
	const addedContainers = getItems(containersData?.added);
	const deletedContainers = getItems(containersData?.deleted);
	const modifiedContainers = getItems(containersData?.modified);

	const addContainersScriptDtos = addedContainers.map(container => {
		const [containerName, containerData] = Object.entries(container.properties)[0];
		const isActivated = isObjectInDeltaModelActivated(containerData);
		return getAddContainerScriptDto(containerName, isActivated);
	});

	const deleteContainersScriptDtos = deletedContainers.map(container => {
		const [containerName, containerData] = Object.entries(container.properties)[0];
		const isActivated = isObjectInDeltaModelActivated(containerData);
		return getDeleteContainerScriptDto(containerName, isActivated);
	});

	const modifyContainersScriptDtos = modifiedContainers
		.map(containerWrapper => Object.values(containerWrapper.properties)[0])
		.flatMap(container => getModifyContainerScriptDtos(container));

	return [...addContainersScriptDtos, ...deleteContainersScriptDtos, ...modifyContainersScriptDtos].filter(Boolean);
};

const sortCollectionsByRelationships = (collections, relationships) => {
	const collectionToChildren = new Map(); // Map of collection IDs to their children
	const collectionParentCount = new Map(); // Track how many parents each collection has

	// Initialize maps
	for (const collection of collections) {
		collectionToChildren.set(collection.role.id, []);
		collectionParentCount.set(collection.role.id, 0);
	}

	for (const relationship of relationships) {
		const parent = relationship.role.parentCollection;
		const child = relationship.role.childCollection;
		if (collectionToChildren.has(parent)) {
			collectionToChildren.get(parent).push(child);
		}
		collectionParentCount.set(child, (collectionParentCount.get(child) || 0) + 1);
	}

	// Find collections with no parents
	const queue = collections
		.filter(collection => collectionParentCount.get(collection.role.id) === 0)
		.map(collection => collection.role.id);

	const sortedIds = [];

	// Sort collections
	while (queue.length > 0) {
		const current = queue.shift();
		sortedIds.push(current);

		for (const child of collectionToChildren.get(current) || []) {
			collectionParentCount.set(child, collectionParentCount.get(child) - 1);
			if (collectionParentCount.get(child) <= 0) {
				queue.push(child);
			}
		}
	}

	// Add any unvisited collection
	for (const collection of collections) {
		if (!sortedIds.includes(collection.role.id)) {
			sortedIds.unshift(collection.role.id);
		}
	}

	// Map back to collection objects in sorted order
	const idToCollection = Object.fromEntries(collections.map(c => [c.role.id, c]));
	return sortedIds.map(id => idToCollection[id]);
};

/**
 * @param dto {{
 *     collection: Object,
 *     app: App,
 *     dbVersion: string,
 *     modelDefinitions: ModelDefinitions,
 *     internalDefinitions: InternalDefinitions,
 *     externalDefinitions: ExternalDefinitions,
 * }}
 * @return {AlterScriptDto[]}
 * */
const getAlterCollectionsScriptDtos = ({
	collection,
	app,
	dbVersion,
	modelDefinitions,
	internalDefinitions,
	externalDefinitions,
	inlineDeltaRelationships,
}) => {
	const entitiesData = collection.properties?.entities?.properties;
	const createScriptsData = getItemProperties(entitiesData?.added);
	const deleteScriptsData = getItemProperties(entitiesData?.deleted);
	const modifyScriptsData = getItemProperties(entitiesData?.modified);

	const createCollectionsScriptDtos = sortCollectionsByRelationships(
		createScriptsData.filter(collection => collection.compMod?.created),
		inlineDeltaRelationships,
	).map(
		getAddCollectionScriptDto({
			app,
			dbVersion,
			modelDefinitions,
			internalDefinitions,
			externalDefinitions,
			inlineDeltaRelationships,
		}),
	);

	const deleteCollectionScriptDtos = deleteScriptsData
		.filter(collection => collection.compMod?.deleted)
		.map(getDeleteCollectionScriptDto(app));

	const modifyCollectionScriptDtos = modifyScriptsData.flatMap(getModifyCollectionScriptDtos({ dbVersion }));
	const modifyCollectionKeysScriptDtos = modifyScriptsData.flatMap(getModifyCollectionKeysScriptDtos({ dbVersion }));

	const addColumnScriptDtos = createScriptsData
		.filter(item => !item?.compMod?.created)
		.flatMap(
			getAddColumnScriptDtos({ app, dbVersion, modelDefinitions, internalDefinitions, externalDefinitions }),
		);

	const deleteColumnScriptDtos = deleteScriptsData
		.filter(item => !item?.compMod?.deleted)
		.flatMap(getDeleteColumnScriptDtos(app));

	const modifyColumnScriptDtos = modifyScriptsData.flatMap(
		getModifyColumnScriptDtos({ app, dbVersion, modelDefinitions, internalDefinitions, externalDefinitions }),
	);

	return [
		...createCollectionsScriptDtos,
		...deleteCollectionScriptDtos,
		...modifyCollectionScriptDtos,
		...addColumnScriptDtos,
		...deleteColumnScriptDtos,
		...modifyColumnScriptDtos,
		...modifyCollectionKeysScriptDtos,
	].filter(Boolean);
};

/**
 * @param collection {Object}
 * @param app {App}
 * @return {AlterScriptDto[]}
 * */
const getAlterViewScriptDtos = (collection, app) => {
	const viewsData = collection.properties?.views?.properties;
	const modifyScriptsData = getItemProperties(viewsData?.modified);

	const createViewsScriptDtos = getItemProperties(viewsData?.added)
		.map(view => ({ ...view, ..._.omit(view.role, 'properties') }))
		.filter(view => view.compMod?.created)
		.map(getAddViewScriptDto(app));

	const deleteViewsScriptDtos = getItemProperties(viewsData?.deleted)
		.map(view => ({ ...view, ..._.omit(view.role, 'properties') }))
		.map(getDeleteViewScriptDto(app));

	const modifyViewsScriptDtos = modifyScriptsData
		.map(view => ({ ...view, ..._.omit(view.role, 'properties') }))
		.flatMap(getModifyViewScriptDtos);

	const modifyCommentScriptDtos = modifyScriptsData.flatMap(getModifiedCommentOnColumnScriptDtos);

	return [
		...deleteViewsScriptDtos,
		...createViewsScriptDtos,
		...modifyViewsScriptDtos,
		...modifyCommentScriptDtos,
	].filter(Boolean);
};

/**
 * @param dto {{
 *     collection: Object,
 *     app: App,
 *     dbVersion: string,
 *     modelDefinitions: ModelDefinitions,
 *     internalDefinitions: InternalDefinitions,
 *     externalDefinitions: ExternalDefinitions,
 * }}
 * @return {AlterScriptDto[]}
 * */
const getAlterModelDefinitionsScriptDtos = ({
	collection,
	app,
	dbVersion,
	modelDefinitions,
	internalDefinitions,
	externalDefinitions,
}) => {
	const definitionsData = collection.properties?.modelDefinitions?.properties;
	const createUdtScriptDtos = getItemProperties(definitionsData?.added)
		.map(item => ({ ...item, ..._.omit(item.role, 'properties') }))
		.filter(item => item.compMod?.created)
		.map(getCreateUdtScriptDto({ app, dbVersion, modelDefinitions, internalDefinitions, externalDefinitions }));

	const deleteUdtScriptDtos = getItemProperties(definitionsData?.deleted)
		.map(item => ({ ...item, ..._.omit(item.role, 'properties') }))
		.filter(collection => collection.compMod?.deleted)
		.map(getDeleteUdtScriptDto(app));

	const addColumnScriptDtos = getItemProperties(definitionsData?.added)
		.filter(item => !item.compMod)
		.map(item => ({ ...item, ..._.omit(item.role, 'properties') }))
		.filter(item => item.childType === 'composite')
		.flatMap(
			getAddColumnToTypeScriptDtos({
				app,
				dbVersion,
				modelDefinitions,
				internalDefinitions,
				externalDefinitions,
			}),
		);

	const deleteColumnScriptDtos = getItemProperties(definitionsData?.deleted)
		.filter(item => !item.compMod)
		.map(item => ({ ...item, ..._.omit(item.role, 'properties') }))
		.filter(item => item.childType === 'composite')
		.flatMap(getDeleteColumnFromTypeScriptDtos(app));

	const modifyColumnScriptDtos = getItemProperties(definitionsData?.modified)
		.filter(item => !item.compMod)
		.map(item => ({ ...item, ..._.omit(item.role, 'properties') }))
		.filter(item => item.childType === 'composite')
		.flatMap(getModifyColumnOfTypeScriptDtos(app));

	return [
		...deleteUdtScriptDtos,
		...createUdtScriptDtos,
		...addColumnScriptDtos,
		...deleteColumnScriptDtos,
		...modifyColumnScriptDtos,
	].filter(Boolean);
};

/**
 * @return Array<AlterScriptDto>
 * */
const getAlterRelationshipsScriptDtos = ({ collection, app, ignoreRelationshipIDs = [] }) => {
	const ddlProvider = require('../ddlProvider/ddlProvider')(null, null, app);
	const relationshipData = collection.properties?.relationships?.properties;

	const addedRelationships = getItemProperties(relationshipData?.added).filter(
		relationship => relationship?.role?.compMod?.created && !ignoreRelationshipIDs.includes(relationship?.role?.id),
	);

	const deletedRelationships = getItemProperties(relationshipData?.deleted).filter(
		relationship => relationship?.role?.compMod?.deleted && !ignoreRelationshipIDs.includes(relationship?.role?.id),
	);

	const modifiedRelationships = getItemProperties(relationshipData?.modified).filter(
		relationship =>
			relationship?.role?.compMod?.modified && !ignoreRelationshipIDs.includes(relationship?.role?.id),
	);

	const deleteFkScriptDtos = getDeleteForeignKeyScriptDtos(ddlProvider)(deletedRelationships);
	const addFkScriptDtos = getAddForeignKeyScriptDtos(ddlProvider)(addedRelationships);
	const modifiedFkScriptDtos = getModifyForeignKeyScriptDtos(ddlProvider)(modifiedRelationships);

	return [...deleteFkScriptDtos, ...addFkScriptDtos, ...modifiedFkScriptDtos].filter(Boolean);
};

/**
 * @param dto {AlterScriptDto}
 * @return {AlterScriptDto | undefined}
 */
const prettifyAlterScriptDto = dto => {
	if (!dto) {
		return undefined;
	}
	/**
	 * @type {Array<ModificationScript>}
	 * */
	const nonEmptyScriptModificationDtos = dto.scripts
		.map(scriptDto => ({
			...scriptDto,
			script: (scriptDto.script || '').trim(),
		}))
		.filter(scriptDto => Boolean(scriptDto.script));
	if (!nonEmptyScriptModificationDtos.length) {
		return undefined;
	}
	return {
		...dto,
		scripts: nonEmptyScriptModificationDtos,
	};
};

/**
 * @param {{
 * collection: Object,
 * app: App,
 * }} dto
 * @return {AlterScriptDto[]}
 * */
const getAlterContainersSequencesScriptDtos = ({ collection, app }) => {
	const containersData = collection.properties?.containers?.properties;
	const addedContainers = getItemProperties(containersData?.added);
	const deletedContainers = getItemProperties(containersData?.deleted);
	const modifiedContainers = getItemProperties(containersData?.modified);

	const addContainersSequencesScriptDtos = addedContainers.flatMap(container =>
		getAddContainerSequencesScriptDtos({ container }),
	);

	const deleteContainersScriptDtos = deletedContainers.flatMap(container =>
		getDeleteContainerSequencesScriptDtos({ container }),
	);

	const modifyContainersScriptDtos = modifiedContainers.flatMap(container =>
		getModifyContainerSequencesScriptDtos({ container }),
	);

	return [...addContainersSequencesScriptDtos, ...deleteContainersScriptDtos, ...modifyContainersScriptDtos].filter(
		Boolean,
	);
};

const getInlineRelationships = ({ collection, options }) => {
	if (options?.scriptGenerationOptions?.feActiveOptions?.foreignKeys !== 'inline') {
		return [];
	}

	const addedCollectionIDs = getItems(collection.properties?.entities?.properties?.added)
		.filter(item => item && Object.values(item.properties)?.[0]?.compMod?.created)
		.map(item => Object.values(item.properties)[0].role.id);

	const addedRelationships = getItems(collection.properties?.relationships?.properties?.added)
		.map(item => item && Object.values(item.properties)[0])
		.filter(r => r?.role?.compMod?.created && addedCollectionIDs.includes(r?.role?.childCollection));

	return addedRelationships;
};

/**
 * @param data {CoreData}
 * @param app {App}
 * @return {Array<AlterScriptDto>}
 * */
const getAlterScriptDtos = (data, app) => {
	const collection = JSON.parse(data.jsonSchema);
	if (!collection) {
		throw new Error(
			'"comparisonModelCollection" is not found. Alter script can be generated only from Delta model',
		);
	}

	const modelDefinitions = JSON.parse(data.modelDefinitions);
	const internalDefinitions = JSON.parse(data.internalDefinitions);
	const externalDefinitions = JSON.parse(data.externalDefinitions);
	const dbVersion = data.modelData[0]?.dbVersion;
	const inlineDeltaRelationships = getInlineRelationships({ collection, options: data.options });
	const containersScriptDtos = getAlterContainersScriptDtos({ collection });
	const collectionsScriptDtos = getAlterCollectionsScriptDtos({
		collection,
		app,
		dbVersion,
		modelDefinitions,
		internalDefinitions,
		externalDefinitions,
		inlineDeltaRelationships,
	});
	const viewScriptDtos = getAlterViewScriptDtos(collection, app);
	const modelDefinitionsScriptDtos = getAlterModelDefinitionsScriptDtos({
		collection,
		app,
		dbVersion,
		modelDefinitions,
		internalDefinitions,
		externalDefinitions,
	});
	const relationshipScriptDtos = getAlterRelationshipsScriptDtos({
		collection,
		app,
		ignoreRelationshipIDs: inlineDeltaRelationships.map(relationship => relationship.role.id),
	});
	const containersSequencesScriptDtos = getAlterContainersSequencesScriptDtos({ collection, app });

	return [
		...containersScriptDtos,
		...modelDefinitionsScriptDtos,
		...collectionsScriptDtos,
		...containersSequencesScriptDtos,
		...viewScriptDtos,
		...relationshipScriptDtos,
	]
		.filter(Boolean)
		.map(dto => prettifyAlterScriptDto(dto))
		.filter(Boolean);
};

module.exports = {
	getAlterScriptDtos,
};
