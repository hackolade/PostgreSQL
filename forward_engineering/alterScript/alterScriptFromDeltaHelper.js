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
    getModifyColumnOfTypeScriptDtos,
} = require('./alterScriptHelpers/alterUdtHelper');
const {
    getAddViewScriptDto,
    getDeleteViewScriptDto,
    getModifyViewScriptDtos
} = require('./alterScriptHelpers/alterViewHelper');
const {
    getModifyForeignKeyScriptDtos,
    getDeleteForeignKeyScriptDtos,
    getAddForeignKeyScriptDtos
} = require("./alterScriptHelpers/alterRelationshipsHelper");
const {AlterScriptDto, ModificationScript} = require("./types/AlterScriptDto");
const {App, CoreData} = require("../types/coreApplicationTypes");
const {InternalDefinitions, ModelDefinitions, ExternalDefinitions} = require("../types/coreApplicationDataTypes");
const { getModifyContainerSequencesScriptDtos, getDeleteContainerSequencesScriptDtos, getAddContainerSequencesScriptDtos } = require('./alterScriptHelpers/containerHelpers/sequencesHelper');


/**
 * @param dto {{
 *     collection: Object,
 *     app: App,
 * }}
 * @return {AlterScriptDto[]}
 * */
const getAlterContainersScriptDtos = ({collection, app}) => {
    const addedContainers = collection.properties?.containers?.properties?.added?.items;
    const deletedContainers = collection.properties?.containers?.properties?.deleted?.items;
    const modifiedContainers = collection.properties?.containers?.properties?.modified?.items;

    const addContainersScriptDtos = []
        .concat(addedContainers)
        .filter(Boolean)
        .map(container => getAddContainerScriptDto(app)(Object.keys(container.properties)[0]));
    const deleteContainersScriptDtos = []
        .concat(deletedContainers)
        .filter(Boolean)
        .map(container => getDeleteContainerScriptDto(app)(Object.keys(container.properties)[0]));
    const modifyContainersScriptDtos = []
        .concat(modifiedContainers)
        .filter(Boolean)
        .map(containerWrapper => Object.values(containerWrapper.properties)[0])
        .flatMap(container => getModifyContainerScriptDtos(app)(container))

    return [
        ...addContainersScriptDtos,
        ...deleteContainersScriptDtos,
        ...modifyContainersScriptDtos,
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
const getAlterCollectionsScriptDtos = ({
                                           collection,
                                           app,
                                           dbVersion,
                                           modelDefinitions,
                                           internalDefinitions,
                                           externalDefinitions,
                                       }) => {
    const createCollectionsScriptDtos = []
        .concat(collection.properties?.entities?.properties?.added?.items)
        .filter(Boolean)
        .map(item => Object.values(item.properties)[0])
        .filter(collection => collection.compMod?.created)
        .map(getAddCollectionScriptDto({app, dbVersion, modelDefinitions, internalDefinitions, externalDefinitions}));
    const deleteCollectionScriptDtos = []
        .concat(collection.properties?.entities?.properties?.deleted?.items)
        .filter(Boolean)
        .map(item => Object.values(item.properties)[0])
        .filter(collection => collection.compMod?.deleted)
        .map(getDeleteCollectionScriptDto(app));
    const modifyCollectionScriptDtos = []
        .concat(collection.properties?.entities?.properties?.modified?.items)
        .filter(Boolean)
        .map(item => Object.values(item.properties)[0])
        .flatMap(getModifyCollectionScriptDtos(app));
    const addColumnScriptDtos = []
        .concat(collection.properties?.entities?.properties?.added?.items)
        .filter(Boolean)
        .map(item => Object.values(item.properties)[0])
        .filter(collection => !collection.compMod)
        .flatMap(getAddColumnScriptDtos({app, dbVersion, modelDefinitions, internalDefinitions, externalDefinitions}));
    const deleteColumnScriptDtos = []
        .concat(collection.properties?.entities?.properties?.deleted?.items)
        .filter(Boolean)
        .map(item => Object.values(item.properties)[0])
        .filter(collection => !collection.compMod)
        .flatMap(getDeleteColumnScriptDtos(app));
    const modifyColumnScriptDtos = []
        .concat(collection.properties?.entities?.properties?.modified?.items)
        .filter(Boolean)
        .map(item => Object.values(item.properties)[0])
        .filter(collection => !collection.compMod)
        .flatMap(getModifyColumnScriptDtos({app, dbVersion, modelDefinitions, internalDefinitions, externalDefinitions}));

    return [
        ...createCollectionsScriptDtos,
        ...deleteCollectionScriptDtos,
        ...modifyCollectionScriptDtos,
        ...addColumnScriptDtos,
        ...deleteColumnScriptDtos,
        ...modifyColumnScriptDtos,
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
        .map(view => ({...view, ...(view.role || {})}))
        .filter(view => view.compMod?.created && view.selectStatement)
        .map(getAddViewScriptDto(app));

    const deleteViewsScriptDtos = []
        .concat(collection.properties?.views?.properties?.deleted?.items)
        .filter(Boolean)
        .map(item => Object.values(item.properties)[0])
        .map(view => ({...view, ...(view.role || {})}))
        .map(getDeleteViewScriptDto(app));

    const modifyViewsScriptDtos = []
        .concat(collection.properties?.views?.properties?.modified?.items)
        .filter(Boolean)
        .map(viewWrapper => Object.values(viewWrapper.properties)[0])
        .map(view => ({...view, ...(view.role || {})}))
        .flatMap(view => getModifyViewScriptDtos(app)(view));

    return [
        ...deleteViewsScriptDtos,
        ...createViewsScriptDtos,
        ...modifyViewsScriptDtos,
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
    const createUdtScriptDtos = []
        .concat(collection.properties?.modelDefinitions?.properties?.added?.items)
        .filter(Boolean)
        .map(item => Object.values(item.properties)[0])
        .map(item => ({...item, ...(app.require('lodash').omit(item.role, 'properties') || {})}))
        .filter(item => item.compMod?.created)
        .map(getCreateUdtScriptDto({app, dbVersion, modelDefinitions, internalDefinitions, externalDefinitions}));
    const deleteUdtScriptDtos = []
        .concat(collection.properties?.modelDefinitions?.properties?.deleted?.items)
        .filter(Boolean)
        .map(item => Object.values(item.properties)[0])
        .map(item => ({...item, ...(app.require('lodash').omit(item.role, 'properties') || {})}))
        .filter(collection => collection.compMod?.deleted)
        .map(getDeleteUdtScriptDto(app));
    const addColumnScriptDtos = []
        .concat(collection.properties?.modelDefinitions?.properties?.added?.items)
        .filter(Boolean)
        .map(item => Object.values(item.properties)[0])
        .filter(item => !item.compMod)
        .map(item => ({...item, ...(app.require('lodash').omit(item.role, 'properties') || {})}))
        .filter(item => item.childType === 'composite')
        .flatMap(
            getAddColumnToTypeScriptDtos({app, dbVersion, modelDefinitions, internalDefinitions, externalDefinitions}),
        );
    const deleteColumnScriptDtos = []
        .concat(collection.properties?.modelDefinitions?.properties?.deleted?.items)
        .filter(Boolean)
        .map(item => Object.values(item.properties)[0])
        .filter(item => !item.compMod)
        .map(item => ({...item, ...(app.require('lodash').omit(item.role, 'properties') || {})}))
        .filter(item => item.childType === 'composite')
        .flatMap(getDeleteColumnFromTypeScriptDtos(app));

    const modifyColumnScriptDtos = []
        .concat(collection.properties?.modelDefinitions?.properties?.modified?.items)
        .filter(Boolean)
        .map(item => Object.values(item.properties)[0])
        .filter(item => !item.compMod)
        .map(item => ({...item, ...(app.require('lodash').omit(item.role, 'properties') || {})}))
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
const getAlterRelationshipsScriptDtos = ({
                                             collection,
                                             app,
                                         }) => {
    const _ = app.require('lodash');
    const ddlProvider = require('../ddlProvider/ddlProvider')(null, null, app);

    const addedRelationships = []
        .concat(collection.properties?.relationships?.properties?.added?.items)
        .filter(Boolean)
        .map(item => Object.values(item.properties)[0])
        .filter(relationship => relationship?.role?.compMod?.created);
    const deletedRelationships = []
        .concat(collection.properties?.relationships?.properties?.deleted?.items)
        .filter(Boolean)
        .map(item => Object.values(item.properties)[0])
        .filter(relationship => relationship?.role?.compMod?.deleted);
    const modifiedRelationships = []
        .concat(collection.properties?.relationships?.properties?.modified?.items)
        .filter(Boolean)
        .map(item => Object.values(item.properties)[0])
        .filter(relationship => relationship?.role?.compMod?.modified);

    const deleteFkScriptDtos = getDeleteForeignKeyScriptDtos(ddlProvider, _)(deletedRelationships);
    const addFkScriptDtos = getAddForeignKeyScriptDtos(ddlProvider, _)(addedRelationships);
    const modifiedFkScriptDtos = getModifyForeignKeyScriptDtos(ddlProvider, _)(modifiedRelationships);

    return [
        ...deleteFkScriptDtos,
        ...addFkScriptDtos,
        ...modifiedFkScriptDtos,
    ].filter(Boolean);
}

/**
 * @param dto {AlterScriptDto}
 * @return {AlterScriptDto | undefined}
 */
const prettifyAlterScriptDto = (dto) => {
    if (!dto) {
        return undefined;
    }
    /**
     * @type {Array<ModificationScript>}
     * */
    const nonEmptyScriptModificationDtos = dto.scripts
        .map((scriptDto) => ({
            ...scriptDto,
            script: (scriptDto.script || '').trim()
        }))
        .filter((scriptDto) => Boolean(scriptDto.script));
    if (!nonEmptyScriptModificationDtos.length) {
        return undefined;
    }
    return {
        ...dto,
        scripts: nonEmptyScriptModificationDtos
    }
}

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
        .flatMap(container => getAddContainerSequencesScriptDtos({ app })({ container }))
    const deleteContainersScriptDtos = []
        .concat(deletedContainers)
        .filter(Boolean)
        .map(container => Object.values(container.properties)[0])
        .flatMap(container => getDeleteContainerSequencesScriptDtos({ app })({ container }))
    const modifyContainersScriptDtos = []
        .concat(modifiedContainers)
        .filter(Boolean)
        .map(container => Object.values(container.properties)[0])
        .flatMap(container => getModifyContainerSequencesScriptDtos({ app })({ container }))

    return [
        ...addContainersSequencesScriptDtos,
        ...deleteContainersScriptDtos,
        ...modifyContainersScriptDtos,
    ].filter(Boolean);
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
    const containersScriptDtos = getAlterContainersScriptDtos({collection, app});
    const collectionsScriptDtos = getAlterCollectionsScriptDtos({
        collection,
        app,
        dbVersion,
        modelDefinitions,
        internalDefinitions,
        externalDefinitions,
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
    const relationshipScriptDtos = getAlterRelationshipsScriptDtos({collection, app});
    const containersSequencesScriptDtos = getAlterContainersSequencesScriptDtos({collection, app});

    return [
        ...containersScriptDtos,
        ...modelDefinitionsScriptDtos,
        ...collectionsScriptDtos,
        ...containersSequencesScriptDtos,
        ...viewScriptDtos,
        ...relationshipScriptDtos,
    ]
        .filter(Boolean)
        .map((dto) => prettifyAlterScriptDto(dto))
        .filter(Boolean);
};

module.exports = {
    getAlterScriptDtos,
};
