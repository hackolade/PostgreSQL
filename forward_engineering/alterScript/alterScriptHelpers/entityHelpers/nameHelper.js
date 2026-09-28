const { AlterScriptDto, SCRIPT_TYPE } = require('../../types/AlterScriptDto');
const {
	getEntityName,
	getNamePrefixedWithSchemaName,
	wrapInQuotes,
	isParentContainerActivated,
	isObjectInDeltaModelActivated,
	getId,
} = require('../../../utils/general');
const assignTemplates = require('../../../utils/assignTemplates');
const templates = require('../../../ddlProvider/templates');

const getDdlName = ({ code, collectionName, name } = {}) => code || collectionName || name || '';

const valueBeforeChange = (change, currentValue) => {
	if (change && change.old !== change.new) {
		return change.old;
	}

	return currentValue;
};

/**
 * @param {Object} collection
 * @return {AlterScriptDto | undefined}
 */
const getRenameCollectionScriptDto = collection => {
	const role = collection?.role;
	const collectionSchema = { ...collection, ...role };
	const compMod = { ...collection?.compMod, ...role?.compMod };
	const newName = getEntityName(collectionSchema);
	const oldName = getDdlName({
		code: valueBeforeChange(compMod.code, collectionSchema.code),
		collectionName: valueBeforeChange(compMod.collectionName, collectionSchema.collectionName),
		name: valueBeforeChange(compMod.name, collectionSchema.name),
	});

	if (!oldName || !newName || oldName === newName) {
		return;
	}

	const script = assignTemplates(templates.renameTable, {
		tableName: getNamePrefixedWithSchemaName(oldName, compMod.keyspaceName),
		newName: wrapInQuotes(newName),
	});
	const isContainerActivated = isParentContainerActivated(collection);
	const isCollectionActivated = isContainerActivated && isObjectInDeltaModelActivated(collection);

	return AlterScriptDto.getInstance(script, isCollectionActivated, false, SCRIPT_TYPE.alterEntity, getId(collection));
};

/**
 * @param {Object} collection
 * @return {AlterScriptDto[]}
 */
const getRenameCollectionScriptDtos = collection => {
	return [getRenameCollectionScriptDto(collection)].filter(Boolean);
};

module.exports = {
	getRenameCollectionScriptDtos,
};
