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

/**
 * @param dto {{
 *     collection: Object
 * }}
 * @return {AlterScriptDto[]}
 * */
const getAlterContainersScriptDtos = ({ collection }) => {
	const addedContainers = collection.properties?.containers?.properties?.added?.items;
	const deletedContainers = collection.properties?.containers?.properties?.deleted?.items;
	const modifiedContainers = collection.properties?.containers?.properties?.modified?.items;

	const addContainersScriptDtos = []
		.concat(addedContainers)
		.filter(Boolean)
		.map(container => {
			const [containerName, containerData] = Object.entries(container.properties)[0];
			const isActivated = isObjectInDeltaModelActivated(containerData);
			return getAddContainerScriptDto(containerName, isActivated);
		});

	const deleteContainersScriptDtos = []
		.concat(deletedContainers)
		.filter(Boolean)
		.map(container => {
			const [containerName, containerData] = Object.entries(container.properties)[0];
			const isActivated = isObjectInDeltaModelActivated(containerData);
			return getDeleteContainerScriptDto(containerName, isActivated);
		});

	const modifyContainersScriptDtos = []
		.concat(modifiedContainers)
		.filter(Boolean)
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
	const createScriptsData = []
		.concat(collection.properties?.entities?.properties?.added?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0]);

	const deleteScriptsData = []
		.concat(collection.properties?.entities?.properties?.deleted?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0]);

	const modifyScriptsData = []
		.concat(collection.properties?.entities?.properties?.modified?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0]);

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
	const createViewsScriptDtos = []
		.concat(collection.properties?.views?.properties?.added?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.map(view => ({ ...view, ...(view.role || {}) }))
		.filter(view => view.compMod?.created && view.selectStatement)
		.map(getAddViewScriptDto(app));

	const deleteViewsScriptDtos = []
		.concat(collection.properties?.views?.properties?.deleted?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.map(view => ({ ...view, ...(view.role || {}) }))
		.map(getDeleteViewScriptDto(app));

	const modifyViewsScriptDtos = []
		.concat(collection.properties?.views?.properties?.modified?.items)
		.filter(Boolean)
		.map(viewWrapper => Object.values(viewWrapper.properties)[0])
		.map(view => ({ ...view, ...(view.role || {}) }))
		.flatMap(view => getModifyViewScriptDtos(view));

	return [...deleteViewsScriptDtos, ...createViewsScriptDtos, ...modifyViewsScriptDtos].filter(Boolean);
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
	const createUdtScriptDtos = []
		.concat(collection.properties?.modelDefinitions?.properties?.added?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.map(item => ({ ...item, ...(_.omit(item.role, 'properties') || {}) }))
		.filter(item => item.compMod?.created)
		.map(getCreateUdtScriptDto({ app, dbVersion, modelDefinitions, internalDefinitions, externalDefinitions }));

	const deleteUdtScriptDtos = []
		.concat(collection.properties?.modelDefinitions?.properties?.deleted?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.map(item => ({ ...item, ...(_.omit(item.role, 'properties') || {}) }))
		.filter(collection => collection.compMod?.deleted)
		.map(getDeleteUdtScriptDto(app));

	const addColumnScriptDtos = []
		.concat(collection.properties?.modelDefinitions?.properties?.added?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.filter(item => !item.compMod)
		.map(item => ({ ...item, ...(_.omit(item.role, 'properties') || {}) }))
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

	const deleteColumnScriptDtos = []
		.concat(collection.properties?.modelDefinitions?.properties?.deleted?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.filter(item => !item.compMod)
		.map(item => ({ ...item, ...(_.omit(item.role, 'properties') || {}) }))
		.filter(item => item.childType === 'composite')
		.flatMap(getDeleteColumnFromTypeScriptDtos(app));

	const modifyColumnScriptDtos = []
		.concat(collection.properties?.modelDefinitions?.properties?.modified?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.filter(item => !item.compMod)
		.map(item => ({ ...item, ...(_.omit(item.role, 'properties') || {}) }))
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

	const addedRelationships = []
		.concat(collection.properties?.relationships?.properties?.added?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.filter(
			relationship =>
				relationship?.role?.compMod?.created && !ignoreRelationshipIDs.includes(relationship?.role?.id),
		);

	const deletedRelationships = []
		.concat(collection.properties?.relationships?.properties?.deleted?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.filter(
			relationship =>
				relationship?.role?.compMod?.deleted && !ignoreRelationshipIDs.includes(relationship?.role?.id),
		);

	const modifiedRelationships = []
		.concat(collection.properties?.relationships?.properties?.modified?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.filter(
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
	const addedContainers = collection.properties?.containers?.properties?.added?.items;
	const deletedContainers = collection.properties?.containers?.properties?.deleted?.items;
	const modifiedContainers = collection.properties?.containers?.properties?.modified?.items;

	const addContainersSequencesScriptDtos = []
		.concat(addedContainers)
		.filter(Boolean)
		.map(container => Object.values(container.properties)[0])
		.flatMap(container => getAddContainerSequencesScriptDtos({ container }));

	const deleteContainersScriptDtos = []
		.concat(deletedContainers)
		.filter(Boolean)
		.map(container => Object.values(container.properties)[0])
		.flatMap(container => getDeleteContainerSequencesScriptDtos({ container }));

	const modifyContainersScriptDtos = []
		.concat(modifiedContainers)
		.filter(Boolean)
		.map(container => Object.values(container.properties)[0])
		.flatMap(container => getModifyContainerSequencesScriptDtos({ container }));

	return [...addContainersSequencesScriptDtos, ...deleteContainersScriptDtos, ...modifyContainersScriptDtos].filter(
		Boolean,
	);
};

const getInlineRelationships = ({ collection, options }) => {
	if (options?.scriptGenerationOptions?.feActiveOptions?.foreignKeys !== 'inline') {
		return [];
	}

	const addedCollectionIDs = []
		.concat(collection.properties?.entities?.properties?.added?.items)
		.filter(item => item && Object.values(item.properties)?.[0]?.compMod?.created)
		.map(item => Object.values(item.properties)[0].role.id);

	const addedRelationships = []
		.concat(collection.properties?.relationships?.properties?.added?.items)
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
