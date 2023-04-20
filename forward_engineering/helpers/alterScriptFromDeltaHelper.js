const { getAddContainerScript, getDeleteContainerScript, getModifyContainerScript} = require('./alterScriptHelpers/alterContainerHelper');
const {
	getAddCollectionScript,
	getDeleteCollectionScript,
	getAddColumnScript,
	getDeleteColumnScript,
	getModifyColumnScript, getModifyCollectionScript,
} = require('./alterScriptHelpers/alterEntityHelper');
const {
	getDeleteUdtScript,
	getCreateUdtScript,
	getAddColumnToTypeScript,
	getDeleteColumnFromTypeScript,
	getModifyColumnOfTypeScript,
} = require('./alterScriptHelpers/alterUdtHelper');
const { getAddViewScript, getDeleteViewScript } = require('./alterScriptHelpers/alterViewHelper');

const getComparisonModelCollection = collections => {
	return collections
		.map(collection => JSON.parse(collection))
		.find(collection => collection.collectionName === 'comparisonModelCollection');
};

const getAlterContainersScripts = ({ collection, app}) => {
	const addedContainers = collection.properties?.containers?.properties?.added?.items;
	const deletedContainers = collection.properties?.containers?.properties?.deleted?.items;
	const modifiedContainers = collection.properties?.containers?.properties?.modified?.items;

	const addContainersScripts = []
		.concat(addedContainers)
		.filter(Boolean)
		.map(container => getAddContainerScript(app)(Object.keys(container.properties)[0]));
	const deleteContainersScripts = []
		.concat(deletedContainers)
		.filter(Boolean)
		.map(container => getDeleteContainerScript(app)(Object.keys(container.properties)[0]));
	const modifyContainersScripts = []
		.concat(modifiedContainers)
		.filter(Boolean)
		.map(containerWrapper => Object.values(containerWrapper.properties)[0])
		.map(container => getModifyContainerScript(app)(container))

	return [
		...addContainersScripts,
		...deleteContainersScripts,
		...modifyContainersScripts,
	];
};

const getAlterCollectionsScripts = ({
	collection,
	app,
	dbVersion,
	modelDefinitions,
	internalDefinitions,
	externalDefinitions,
}) => {
	const createCollectionsScripts = []
		.concat(collection.properties?.entities?.properties?.added?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.filter(collection => collection.compMod?.created)
		.map(getAddCollectionScript({ app, dbVersion, modelDefinitions, internalDefinitions, externalDefinitions }));
	const deleteCollectionScripts = []
		.concat(collection.properties?.entities?.properties?.deleted?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.filter(collection => collection.compMod?.deleted)
		.map(getDeleteCollectionScript(app));
	const modifyCollectionScripts = []
		.concat(collection.properties?.entities?.properties?.modified?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.map(getModifyCollectionScript(app))
		.flat();
	const addColumnScripts = []
		.concat(collection.properties?.entities?.properties?.added?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.filter(collection => !collection.compMod)
		.flatMap(getAddColumnScript({ app, dbVersion, modelDefinitions, internalDefinitions, externalDefinitions }));
	const deleteColumnScripts = []
		.concat(collection.properties?.entities?.properties?.deleted?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.filter(collection => !collection.compMod)
		.flatMap(getDeleteColumnScript(app));
	const modifyColumnScript = []
		.concat(collection.properties?.entities?.properties?.modified?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.filter(collection => !collection.compMod)
		.flatMap(getModifyColumnScript(app));

	return [
		...createCollectionsScripts,
		...deleteCollectionScripts,
		...modifyCollectionScripts,
		...addColumnScripts,
		...deleteColumnScripts,
		...modifyColumnScript,
	].map(script => script.trim());
};

const getAlterViewScripts = (collection, app) => {
	const createViewsScripts = []
		.concat(collection.properties?.views?.properties?.added?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.map(view => ({ ...view, ...(view.role || {}) }))
		.filter(view => view.compMod?.created && view.selectStatement)
		.map(getAddViewScript(app));

	const deleteViewsScripts = []
		.concat(collection.properties?.views?.properties?.deleted?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.map(view => ({ ...view, ...(view.role || {}) }))
		.map(getDeleteViewScript(app));

	return [...deleteViewsScripts, ...createViewsScripts].map(script => script.trim());
};

const getAlterModelDefinitionsScripts = ({
	collection,
	app,
	dbVersion,
	modelDefinitions,
	internalDefinitions,
	externalDefinitions,
}) => {
	const createUdtScripts = []
		.concat(collection.properties?.modelDefinitions?.properties?.added?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.map(item => ({ ...item, ...(app.require('lodash').omit(item.role, 'properties') || {}) }))
		.filter(item => item.compMod?.created)
		.map(getCreateUdtScript({ app, dbVersion, modelDefinitions, internalDefinitions, externalDefinitions }));
	const deleteUdtScripts = []
		.concat(collection.properties?.modelDefinitions?.properties?.deleted?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.map(item => ({ ...item, ...(app.require('lodash').omit(item.role, 'properties') || {}) }))
		.filter(collection => collection.compMod?.deleted)
		.map(getDeleteUdtScript(app));
	const addColumnScripts = []
		.concat(collection.properties?.modelDefinitions?.properties?.added?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.filter(item => !item.compMod)
		.map(item => ({ ...item, ...(app.require('lodash').omit(item.role, 'properties') || {}) }))
		.filter(item => item.childType === 'composite')
		.flatMap(
			getAddColumnToTypeScript({ app, dbVersion, modelDefinitions, internalDefinitions, externalDefinitions }),
		);
	const deleteColumnScripts = []
		.concat(collection.properties?.modelDefinitions?.properties?.deleted?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.filter(item => !item.compMod)
		.map(item => ({ ...item, ...(app.require('lodash').omit(item.role, 'properties') || {}) }))
		.filter(item => item.childType === 'composite')
		.flatMap(getDeleteColumnFromTypeScript(app));

	const modifyColumnScripts = []
		.concat(collection.properties?.modelDefinitions?.properties?.modified?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.filter(item => !item.compMod)
		.map(item => ({ ...item, ...(app.require('lodash').omit(item.role, 'properties') || {}) }))
		.filter(item => item.childType === 'composite')
		.flatMap(getModifyColumnOfTypeScript(app));

	return [
		...deleteUdtScripts,
		...createUdtScripts,
		...addColumnScripts,
		...deleteColumnScripts,
		...modifyColumnScripts,
	]
		.filter(Boolean)
		.map(script => script.trim());
};

module.exports = {
	getComparisonModelCollection,
	getAlterContainersScripts,
	getAlterCollectionsScripts,
	getAlterViewScripts,
	getAlterModelDefinitionsScripts,
};
