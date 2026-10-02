const { AlterScriptDto, SCRIPT_TYPE } = require('../../types/AlterScriptDto');
const {
	getViewName,
	getNamePrefixedWithSchemaName,
	wrapInQuotes,
	isParentContainerActivated,
	isObjectInDeltaModelActivated,
	getId,
} = require('../../../utils/general');
const assignTemplates = require('../../../utils/assignTemplates');
const templates = require('../../../ddlProvider/templates');

const getDdlName = ({ code, name } = {}) => code || name || '';

const valueBeforeChange = (change, currentValue) => {
	if (change && change.old !== change.new) {
		return change.old;
	}

	return currentValue;
};

/**
 * @param {Object} view
 * @return {AlterScriptDto | undefined}
 */
const getRenameViewScriptDto = view => {
	const role = view?.role;
	const viewSchema = { ...view, ...role };
	const compMod = { ...view?.compMod, ...role?.compMod };
	const newName = getViewName(viewSchema);
	const oldName = getDdlName({
		code: valueBeforeChange(compMod.code, viewSchema.code),
		name: valueBeforeChange(compMod.name, viewSchema.name),
	});

	if (!oldName || !newName || oldName === newName) {
		return;
	}

	const script = assignTemplates(templates.renameView, {
		viewName: getNamePrefixedWithSchemaName(oldName, compMod.keyspaceName),
		newName: wrapInQuotes(newName),
	});
	const isContainerActivated = isParentContainerActivated(view);
	const isViewActivated = isContainerActivated && isObjectInDeltaModelActivated(view);

	return AlterScriptDto.getInstance(script, isViewActivated, false, SCRIPT_TYPE.alterView, getId(view));
};

/**
 * @param {Object} view
 * @return {AlterScriptDto[]}
 */
const getRenameViewScriptDtos = view => {
	return [getRenameViewScriptDto(view)].filter(Boolean);
};

module.exports = {
	getRenameViewScriptDtos,
};
