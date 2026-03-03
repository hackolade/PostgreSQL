const { AlterScriptDto, SCRIPT_TYPE } = require('../types/AlterScriptDto');
const { AlterRelationshipDto } = require('../types/AlterRelationshipDto');
const { getNamePrefixedWithSchemaName, wrapInQuotes } = require('../../utils/general');

/**
 * @param relationship {AlterRelationshipDto}
 * @return string
 * */
const getRelationshipName = relationship => {
	return relationship.role.code || relationship.role.name;
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

	const relationshipName = compMod.code?.new || compMod.name?.new || getRelationshipName(relationship) || '';

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
		compMod.code?.new || compMod.name?.new || getRelationshipName(relationship),
		compMod.parent?.bucket,
		compMod.parent?.collection,
		compMod.parent?.collection?.fkFields?.length,
		compMod.child?.bucket,
		compMod.child?.collection,
		compMod.child?.collection?.fkFields?.length,
	].every(Boolean);
};

/**
 * @return {(addedRelationships: Array<AlterRelationshipDto>) => Array<AlterScriptDto>}
 * */
const getAddForeignKeyScriptDtos = ddlProvider => addedRelationships => {
	return addedRelationships
		.filter(relationship => canRelationshipBeAdded(relationship))
		.map(relationship => {
			const scriptDto = getAddSingleForeignKeyStatementDto(ddlProvider)(relationship);
			return AlterScriptDto.getInstance(
				scriptDto.statement,
				scriptDto.isActivated,
				false,
				SCRIPT_TYPE.alterEntity,
			);
		})
		.filter(Boolean);
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

	const relationshipName = compMod.code?.old || compMod.name?.old || getRelationshipName(relationship) || '';
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
		compMod.code?.old || compMod.name?.old || getRelationshipName(relationship),
		compMod.child?.bucket,
		compMod.child?.collection,
	].every(Boolean);
};

/**
 * @return {(deletedRelationships: Array<AlterRelationshipDto>) => Array<AlterScriptDto>}
 * */
const getDeleteForeignKeyScriptDtos = ddlProvider => deletedRelationships => {
	return deletedRelationships
		.filter(relationship => canRelationshipBeDeleted(relationship))
		.map(relationship => {
			const scriptDto = getDeleteSingleForeignKeyStatementDto(ddlProvider)(relationship);
			return AlterScriptDto.getInstance(
				scriptDto.statement,
				scriptDto.isActivated,
				true,
				SCRIPT_TYPE.alterEntity,
			);
		})
		.filter(Boolean);
};

/**
 * @return {(modifiedRelationships: Array<AlterRelationshipDto>) => Array<AlterScriptDto>}
 * */
const getModifyForeignKeyScriptDtos = ddlProvider => modifiedRelationships => {
	return modifiedRelationships
		.filter(relationship => canRelationshipBeAdded(relationship) && canRelationshipBeDeleted(relationship))
		.flatMap(relationship => {
			const deleteScriptDto = getDeleteSingleForeignKeyStatementDto(ddlProvider)(relationship);
			const addScriptDto = getAddSingleForeignKeyStatementDto(ddlProvider)(relationship);
			const isActivated = addScriptDto.isActivated && deleteScriptDto.isActivated;
			return [
				AlterScriptDto.getInstance(deleteScriptDto.statement, isActivated, true, SCRIPT_TYPE.alterEntity),
				AlterScriptDto.getInstance(addScriptDto.statement, isActivated, false, SCRIPT_TYPE.alterEntity),
			];
		})
		.filter(Boolean);
};

module.exports = {
	getDeleteForeignKeyScriptDtos,
	getModifyForeignKeyScriptDtos,
	getAddForeignKeyScriptDtos,
	getRelationshipName,
};
