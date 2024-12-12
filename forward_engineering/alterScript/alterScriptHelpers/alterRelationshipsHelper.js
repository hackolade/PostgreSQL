const _ = require('lodash');
const { AlterScriptDto } = require('../types/AlterScriptDto');
const { AlterRelationshipDto } = require('../types/AlterRelationshipDto');
const { getNamePrefixedWithSchemaName, wrapInQuotes } = require('../../utils/general');

/**
 * @param relationship {AlterRelationshipDto}
 * @return string
 * */
const getRelationshipName = relationship => {
	return relationship.role.name;
};

/**
 * @param {AlterRelationshipDto} relationship
 * @return {string}
 * */
const getFullChildTableName = relationship => {
	const compMod = relationship.role.compMod;

	const childBucketName = compMod.child.bucket.name;
	const childEntityName = compMod.child.collection.name;
	return getNamePrefixedWithSchemaName(childEntityName, childBucketName);
};

/**
 * @return {(relationship: AlterRelationshipDto) => {
 *     isActivated: boolean,
 *     statement: string,
 * }}
 * */
const getAddSingleForeignKeyStatementDto = ddlProvider => relationship => {
	const compMod = relationship.role.compMod;

	const relationshipName = compMod.name?.new || getRelationshipName(relationship) || '';

	return ddlProvider.createForeignKey({
		name: relationshipName,
		foreignKey: compMod.child.collection.fkFields,
		primaryKey: compMod.parent.collection.fkFields,
		customProperties: compMod.customProperties?.new,
		foreignTable: compMod.child.collection.name,
		foreignSchemaName: compMod.child.bucket.name,
		foreignTableActivated: compMod.child.collection.isActivated,
		primaryTable: compMod.parent.collection.name,
		primarySchemaName: compMod.parent.bucket.name,
		primaryTableActivated: compMod.parent.collection.isActivated,
		isActivated: Boolean(relationship.role?.compMod?.isActivated?.new),
	});
};

/**
 * @param relationship {AlterRelationshipDto}
 * @return boolean
 * */
const canRelationshipBeAdded = relationship => {
	const compMod = relationship.role.compMod;
	if (!compMod) {
		return false;
	}
	return [
		compMod.name?.new || getRelationshipName(relationship),
		compMod.parent?.bucket,
		compMod.parent?.collection,
		compMod.parent?.collection?.fkFields?.length,
		compMod.child?.bucket,
		compMod.child?.collection,
		compMod.child?.collection?.fkFields?.length,
	].every(property => Boolean(property));
};

/**
 * @return {(addedRelationships: Array<AlterRelationshipDto>) => Array<AlterScriptDto>}
 * */
const getAddForeignKeyScriptDtos = ddlProvider => addedRelationships => {
	return addedRelationships
		.filter(relationship => canRelationshipBeAdded(relationship))
		.map(relationship => {
			const scriptDto = getAddSingleForeignKeyStatementDto(ddlProvider)(relationship);
			return AlterScriptDto.getInstance([scriptDto.statement], scriptDto.isActivated, false);
		})
		.filter(Boolean)
		.filter(res => res.scripts.some(scriptDto => Boolean(scriptDto.script)));
};

/**
 * @return {(relationship: AlterRelationshipDto) => {
 *     isActivated: boolean,
 *     statement: string,
 * }}
 * */
const getDeleteSingleForeignKeyStatementDto = ddlProvider => relationship => {
	const compMod = relationship.role.compMod;

	const ddlChildEntityName = getFullChildTableName(relationship);

	const relationshipName = compMod.name?.old || getRelationshipName(relationship) || '';
	const ddlRelationshipName = wrapInQuotes(relationshipName);
	const statement = ddlProvider.dropForeignKey(ddlChildEntityName, ddlRelationshipName);

	const isRelationshipActivated = Boolean(relationship.role?.compMod?.isActivated?.new);
	const isChildTableActivated = compMod.child.collection.isActivated;
	return {
		statement,
		isActivated: isRelationshipActivated && isChildTableActivated,
	};
};

/**
 * @param relationship {AlterRelationshipDto}
 * @return {boolean}
 * */
const canRelationshipBeDeleted = relationship => {
	const compMod = relationship.role.compMod;
	if (!compMod) {
		return false;
	}
	return [
		compMod.name?.old || getRelationshipName(relationship),
		compMod.child?.bucket,
		compMod.child?.collection,
	].every(property => Boolean(property));
};

/**
 * @return {(deletedRelationships: Array<AlterRelationshipDto>) => Array<AlterScriptDto>}
 * */
const getDeleteForeignKeyScriptDtos = ddlProvider => deletedRelationships => {
	return deletedRelationships
		.filter(relationship => canRelationshipBeDeleted(relationship))
		.map(relationship => {
			const scriptDto = getDeleteSingleForeignKeyStatementDto(ddlProvider)(relationship);
			return AlterScriptDto.getInstance([scriptDto.statement], scriptDto.isActivated, true);
		})
		.filter(Boolean)
		.filter(res => res.scripts.some(scriptDto => Boolean(scriptDto.script)));
};

/**
 * @return {(modifiedRelationships: Array<AlterRelationshipDto>) => Array<AlterScriptDto>}
 * */
const getModifyForeignKeyScriptDtos = ddlProvider => modifiedRelationships => {
	return modifiedRelationships
		.filter(relationship => canRelationshipBeAdded(relationship) && canRelationshipBeDeleted(relationship))
		.map(relationship => {
			const deleteScriptDto = getDeleteSingleForeignKeyStatementDto(ddlProvider)(relationship);
			const addScriptDto = getAddSingleForeignKeyStatementDto(ddlProvider)(relationship);
			const isActivated = addScriptDto.isActivated && deleteScriptDto.isActivated;
			return AlterScriptDto.getDropAndRecreateInstance(
				deleteScriptDto.statement,
				addScriptDto.statement,
				isActivated,
			);
		})
		.filter(Boolean)
		.filter(res => res.scripts.some(scriptDto => Boolean(scriptDto.script)));
};

module.exports = {
	getDeleteForeignKeyScriptDtos,
	getModifyForeignKeyScriptDtos,
	getAddForeignKeyScriptDtos,
};
