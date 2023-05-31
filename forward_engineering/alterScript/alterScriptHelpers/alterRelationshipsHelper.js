const {AlterScriptDto} = require("../types/AlterScriptDto");


/**
 * @param relationship {Object}
 * @return string
 * */
const getRelationshipName = (relationship) => {
    return relationship.role.name;
}

/**
 * @return {(relationship: Object) => string}
 * */
const getAddSingleForeignKeyScript = (ddlProvider, _) => (relationship) => {
    const compMod = relationship.role.compMod;
    
    // const parentDBName = replaceSpaceWithUnderscore(compMod.parent.bucketName);
    // const parentEntityName = replaceSpaceWithUnderscore(compMod.parent.collectionName);
    // const parentTableName = getFullEntityName(parentDBName, parentEntityName);
    //
    // const childDBName = replaceSpaceWithUnderscore(compMod.child.bucketName);
    // const childEntityName = replaceSpaceWithUnderscore(compMod.child.collectionName);
    // const childTableName = getFullEntityName(childDBName, childEntityName);
    //
    // const relationshipName = compMod.name?.new || getRelationshipName(relationship) || '';
    //
    // const addFkConstraintDto = {
    //     childTableName,
    //     fkConstraintName: prepareName(relationshipName),
    //     childColumns: compMod.child.fieldNames.map(name => prepareName(name)),
    //     parentTableName,
    //     parentColumns: compMod.parent.fieldNames.map(name => prepareName(name)),
    // };
    // return ddlProvider.addFkConstraint(addFkConstraintDto);

    return '';
}

/**
 * @param relationship {Object}
 * @return boolean
 * */
const canRelationshipBeAdded = (relationship) => {
    const compMod = relationship.role.compMod;
    if (!compMod) {
        return false;
    }
    return [
        (compMod.name?.new || getRelationshipName(relationship)),
        compMod.parent?.bucketName,
        compMod.parent?.collectionName,
        compMod.parent?.fieldNames?.length,
        compMod.child?.bucketName,
        compMod.child?.collectionName,
        compMod.child?.fieldNames?.length,
    ].every(property => Boolean(property));
}

/**
 * @return {(addedRelationships: Array<Object>) => Array<AlterScriptDto>}
 * */
const getAddForeignKeyScriptDtos = (ddlProvider, _) => (addedRelationships) => {
    return addedRelationships
        .filter((relationship) => canRelationshipBeAdded(relationship))
        .map(relationship => {
            const script = getAddSingleForeignKeyScript(ddlProvider, _)(relationship);
            const isActivated = Boolean(relationship.role?.compMod?.isActivated?.new);
            return AlterScriptDto.getInstance([script], isActivated, false);
        })
        .filter(Boolean)
        .filter(res => res.scripts.some(scriptDto => Boolean(scriptDto.script)));
}

/**
 * @return {(relationship: Object) => string}
 * */
const getDeleteSingleForeignKeyScript = (ddlProvider, _) => (relationship) => {
    const { getNamePrefixedWithSchemaName, wrapInQuotes } = require('../../utils/general')(_);
    const compMod = relationship.role.compMod;

    const childBucketName = compMod.child.bucketName;
    const childEntityName = compMod.child.collectionName;
    const ddlChildEntityName = getNamePrefixedWithSchemaName(childEntityName, childBucketName);

    const relationshipName = compMod.name?.old || getRelationshipName(relationship) || '';
    const ddlRelationshipName = wrapInQuotes(relationshipName);
    return ddlProvider.dropForeignKey(ddlChildEntityName, ddlRelationshipName);
}

const canRelationshipBeDeleted = (relationship) => {
    const compMod = relationship.role.compMod;
    if (!compMod) {
        return false;
    }
    return [
        (compMod.name?.old || getRelationshipName(relationship)),
        compMod.child?.bucketName,
        compMod.child?.collectionName,
    ].every(property => Boolean(property));
}

/**
 * @return {(deletedRelationships: Array<Object>) => Array<AlterScriptDto>}
 * */
const getDeleteForeignKeyScriptDtos = (ddlProvider, _) => (deletedRelationships) => {
    return deletedRelationships
        .filter((relationship) => canRelationshipBeDeleted(relationship))
        .map(relationship => {
            const script = getDeleteSingleForeignKeyScript(ddlProvider, _)(relationship);
            const isActivated = Boolean(relationship.role?.compMod?.isActivated?.new);
            return AlterScriptDto.getInstance([script], isActivated, true);
        })
        .filter(Boolean)
        .filter(res => res.scripts.some(scriptDto => Boolean(scriptDto.script)));
}

/**
 * @return {(modifiedRelationships: Array<Object>) => Array<AlterScriptDto>}
 * */
const getModifyForeignKeyScriptDtos = (ddlProvider, _) => (modifiedRelationships) => {
    return modifiedRelationships
        .filter(relationship => canRelationshipBeAdded(relationship) && canRelationshipBeDeleted(relationship))
        .map(relationship => {
            const deleteScript = getDeleteSingleForeignKeyScript(ddlProvider, _)(relationship);
            const addScript = getAddSingleForeignKeyScript(ddlProvider, _)(relationship);
            const isActivated = Boolean(relationship.role?.compMod?.isActivated?.new);
            return AlterScriptDto.getDropAndRecreateInstance(deleteScript, addScript, isActivated);
        })
        .filter(Boolean)
        .filter(res => res.scripts.some(scriptDto => Boolean(scriptDto.script)));
}

module.exports = {
    getDeleteForeignKeyScriptDtos,
    getModifyForeignKeyScriptDtos,
    getAddForeignKeyScriptDtos,
}
