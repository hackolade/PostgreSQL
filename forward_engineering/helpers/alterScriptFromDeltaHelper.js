const {
    getAddContainerScriptDto,
    getDeleteContainerScriptDto,
    getModifyContainerScriptDtos
} = require('./alterScriptHelpers/alterContainerHelper');
const {
    getAddCollectionScriptDto,
    getDeleteCollectionScriptDto,
    getAddColumnScriptDtos,
    getDeleteColumnScriptDtos,
    getModifyColumnScriptDtos,
    getModifyCollectionScriptDtos,
} = require('./alterScriptHelpers/alterEntityHelper');
const {
    getDeleteUdtScriptDto,
    getCreateUdtScriptDto,
    getAddColumnToTypeScriptDtos,
    getDeleteColumnFromTypeScriptDtos,
    getModifyColumnOfTypeScriptDto,
} = require('./alterScriptHelpers/alterUdtHelper');
const {
    getAddViewScriptDto,
    getDeleteViewScriptDto,
    getModifyViewScriptDtos
} = require('./alterScriptHelpers/alterViewHelper');

const getComparisonModelCollection = collections => {
    return collections
        .map(collection => JSON.parse(collection))
        .find(collection => collection.collectionName === 'comparisonModelCollection');
};

const getAlterContainersScripts = ({collection, app}) => {
    const addedContainers = collection.properties?.containers?.properties?.added?.items;
    const deletedContainers = collection.properties?.containers?.properties?.deleted?.items;
    const modifiedContainers = collection.properties?.containers?.properties?.modified?.items;

    const addContainersScripts = []
        .concat(addedContainers)
        .filter(Boolean)
        .map(container => getAddContainerScriptDto(app)(Object.keys(container.properties)[0]));
    const deleteContainersScripts = []
        .concat(deletedContainers)
        .filter(Boolean)
        .map(container => getDeleteContainerScriptDto(app)(Object.keys(container.properties)[0]));
    const modifyContainersScripts = []
        .concat(modifiedContainers)
        .filter(Boolean)
        .map(containerWrapper => Object.values(containerWrapper.properties)[0])
        .map(container => getModifyContainerScriptDtos(app)(container))

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
        .map(getAddCollectionScriptDto({app, dbVersion, modelDefinitions, internalDefinitions, externalDefinitions}));
    const deleteCollectionScripts = []
        .concat(collection.properties?.entities?.properties?.deleted?.items)
        .filter(Boolean)
        .map(item => Object.values(item.properties)[0])
        .filter(collection => collection.compMod?.deleted)
        .map(getDeleteCollectionScriptDto(app));
    const modifyCollectionScripts = []
        .concat(collection.properties?.entities?.properties?.modified?.items)
        .filter(Boolean)
        .map(item => Object.values(item.properties)[0])
        .map(getModifyCollectionScriptDtos(app))
        .flat();
    const addColumnScripts = []
        .concat(collection.properties?.entities?.properties?.added?.items)
        .filter(Boolean)
        .map(item => Object.values(item.properties)[0])
        .filter(collection => !collection.compMod)
        .flatMap(getAddColumnScriptDtos({app, dbVersion, modelDefinitions, internalDefinitions, externalDefinitions}));
    const deleteColumnScripts = []
        .concat(collection.properties?.entities?.properties?.deleted?.items)
        .filter(Boolean)
        .map(item => Object.values(item.properties)[0])
        .filter(collection => !collection.compMod)
        .flatMap(getDeleteColumnScriptDtos(app));
    const modifyColumnScript = []
        .concat(collection.properties?.entities?.properties?.modified?.items)
        .filter(Boolean)
        .map(item => Object.values(item.properties)[0])
        .filter(collection => !collection.compMod)
        .flatMap(getModifyColumnScriptDtos(app));

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
        .map(view => ({...view, ...(view.role || {})}))
        .filter(view => view.compMod?.created && view.selectStatement)
        .map(getAddViewScriptDto(app));

    const deleteViewsScripts = []
        .concat(collection.properties?.views?.properties?.deleted?.items)
        .filter(Boolean)
        .map(item => Object.values(item.properties)[0])
        .map(view => ({...view, ...(view.role || {})}))
        .map(getDeleteViewScriptDto(app));

    const modifyViewsScripts = []
        .concat(collection.properties?.views?.properties?.modified?.items)
        .filter(Boolean)
        .map(viewWrapper => Object.values(viewWrapper.properties)[0])
        .map(view => ({...view, ...(view.role || {})}))
        .flatMap(view => getModifyViewScriptDtos(app)(view));

    return [
        ...deleteViewsScripts,
        ...createViewsScripts,
        ...modifyViewsScripts,
    ].map(script => script.trim());
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
        .map(item => ({...item, ...(app.require('lodash').omit(item.role, 'properties') || {})}))
        .filter(item => item.compMod?.created)
        .map(getCreateUdtScriptDto({app, dbVersion, modelDefinitions, internalDefinitions, externalDefinitions}));
    const deleteUdtScripts = []
        .concat(collection.properties?.modelDefinitions?.properties?.deleted?.items)
        .filter(Boolean)
        .map(item => Object.values(item.properties)[0])
        .map(item => ({...item, ...(app.require('lodash').omit(item.role, 'properties') || {})}))
        .filter(collection => collection.compMod?.deleted)
        .map(getDeleteUdtScriptDto(app));
    const addColumnScripts = []
        .concat(collection.properties?.modelDefinitions?.properties?.added?.items)
        .filter(Boolean)
        .map(item => Object.values(item.properties)[0])
        .filter(item => !item.compMod)
        .map(item => ({...item, ...(app.require('lodash').omit(item.role, 'properties') || {})}))
        .filter(item => item.childType === 'composite')
        .flatMap(
            getAddColumnToTypeScriptDtos({app, dbVersion, modelDefinitions, internalDefinitions, externalDefinitions}),
        );
    const deleteColumnScripts = []
        .concat(collection.properties?.modelDefinitions?.properties?.deleted?.items)
        .filter(Boolean)
        .map(item => Object.values(item.properties)[0])
        .filter(item => !item.compMod)
        .map(item => ({...item, ...(app.require('lodash').omit(item.role, 'properties') || {})}))
        .filter(item => item.childType === 'composite')
        .flatMap(getDeleteColumnFromTypeScriptDtos(app));

    const modifyColumnScripts = []
        .concat(collection.properties?.modelDefinitions?.properties?.modified?.items)
        .filter(Boolean)
        .map(item => Object.values(item.properties)[0])
        .filter(item => !item.compMod)
        .map(item => ({...item, ...(app.require('lodash').omit(item.role, 'properties') || {})}))
        .filter(item => item.childType === 'composite')
        .flatMap(getModifyColumnOfTypeScriptDto(app));

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
