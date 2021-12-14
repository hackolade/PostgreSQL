const { getAddContainerScript, getDeleteContainerScript } = require('./alterScriptHelpers/alterContainerHelper');
const {
	getAddCollectionScript,
	getDeleteCollectionScript,
	getAddColumnScript,
	getDeleteColumnScript,
} = require('./alterScriptHelpers/alterEntityHelper');
const {
	getDeleteUdtScript,
	getCreateUdtScript,
	getAddColumnToTypeScript,
	getDeleteColumnFromTypeScript,
} = require('./alterScriptHelpers/alterUdtHelper');
const { getAddViewScript, getDeleteViewScript } = require('./alterScriptHelpers/alterViewHelper');

const getComparisonModelCollection = collections => {
	return collections
		.map(collection => JSON.parse(collection))
		.find(collection => collection.collectionName === 'comparisonModelCollection');
};

const getAlterContainersScripts = collection => {
	const addedContainers = collection.properties?.containers?.properties?.added?.items;
	const deletedContainers = collection.properties?.containers?.properties?.deleted?.items;

	const addContainersScripts = []
		.concat(addedContainers)
		.filter(Boolean)
		.map(container => getAddContainerScript(Object.keys(container.properties)[0]));
	const deleteContainersScripts = []
		.concat(deletedContainers)
		.filter(Boolean)
		.map(container => getDeleteContainerScript(Object.keys(container.properties)[0]));

	return [].concat(addContainersScripts).concat(deleteContainersScripts);
};

const getAlterCollectionsScripts = (collection, app, dbVersion) => {
	const createCollectionsScripts = []
		.concat(collection.properties?.entities?.properties?.added?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.filter(collection => collection.compMod?.created)
		.map(getAddCollectionScript(app, dbVersion));
	const deleteCollectionScripts = []
		.concat(collection.properties?.entities?.properties?.deleted?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.filter(collection => collection.compMod?.deleted)
		.map(getDeleteCollectionScript(app));
	const addColumnScripts = []
		.concat(collection.properties?.entities?.properties?.added?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.filter(collection => !collection.compMod)
		.flatMap(getAddColumnScript(app));
	const deleteColumnScripts = []
		.concat(collection.properties?.entities?.properties?.deleted?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.filter(collection => !collection.compMod)
		.flatMap(getDeleteColumnScript(app));

	return [...createCollectionsScripts, ...deleteCollectionScripts, ...addColumnScripts, ...deleteColumnScripts].map(
		script => script.trim(),
	);
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
		.filter(view => view.compMod?.deleted)
		.map(getDeleteViewScript(app));

	return [...deleteViewsScripts, ...createViewsScripts].map(script => script.trim());
};

const getAlterModelDefinitionsScripts = (collection, app, dbVersion) => {
	const createUdtScripts = []
		.concat(collection.properties?.modelDefinitions?.properties?.added?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.map(item => ({ ...item, ...(app.require('lodash').omit(item.role, 'properties') || {}) }))
		.filter(item => item.compMod?.created)
		.map(getCreateUdtScript(app, dbVersion));
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
		.flatMap(getAddColumnToTypeScript(app));
	const deleteColumnScripts = []
		.concat(collection.properties?.modelDefinitions?.properties?.deleted?.items)
		.filter(Boolean)
		.map(item => Object.values(item.properties)[0])
		.filter(item => !item.compMod)
		.map(item => ({ ...item, ...(app.require('lodash').omit(item.role, 'properties') || {}) }))
		.filter(item => item.childType === 'composite')
		.flatMap(getDeleteColumnFromTypeScript(app));

	return [...deleteUdtScripts, ...createUdtScripts, ...addColumnScripts, ...deleteColumnScripts].map(script =>
		script.trim(),
	);
};

module.exports = {
	getComparisonModelCollection,
	getAlterContainersScripts,
	getAlterCollectionsScripts,
	getAlterViewScripts,
	getAlterModelDefinitionsScripts,
};
