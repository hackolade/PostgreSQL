const { getAlterScriptDtos } = require('./alterScriptFromDeltaHelper');
const { AlterScriptDto } = require('./types/AlterScriptDto');
const { commentIfDeactivated } = require('../utils/general');

/**
 * @param {AlterScriptDto} dtos
 * @param {boolean} shouldApplyDropStatements
 * @return {AlterScriptDto}
 * */
const commentDto = (dto, shouldApplyDropStatements) => {
	let script = dto.script;
	const shouldDeactivate = dto.isActivated === false || (!shouldApplyDropStatements && dto.isDropScript);
	if (shouldDeactivate) {
		script = commentIfDeactivated(script, {
			isActivated: false,
			isPartOfLine: false,
		});
	}
	return { ...dto, script };
};

/**
 * @param {AlterScriptDto[]} dtos
 * @param {boolean} shouldApplyDropStatements
 * @return {AlterScriptDto[]}
 * */
const commentDtosIfRequired = (dtos, shouldApplyDropStatements) => {
	return dtos.reduce((finalDtos, dto) => {
		if (!dto) {
			return finalDtos;
		}
		return [...finalDtos, commentDto(dto, shouldApplyDropStatements)];
	}, []);
};

/**
 * @param {AlterScriptDto[]} dtos
 * @param {boolean} shouldApplyDropStatements
 * @return {string}
 * */
const joinAlterScriptDtosIntoScript = (dtos, shouldApplyDropStatements) => {
	return dtos.reduce((finalScript, dto) => {
		if (!dto) {
			return finalScript;
		}
		const { script } = commentDto(dto, shouldApplyDropStatements);
		return `${finalScript}\n\n${script}`;
	}, '');
};

/**
 * @param data {CoreData}
 * @param app {App}
 * @return {string}
 * */
const buildEntityLevelAlterScript = (data, app) => {
	const alterScriptDtos = getAlterScriptDtos(data, app);
	const shouldApplyDropStatements = data.options?.additionalOptions?.some(
		option => option.id === 'applyDropStatements' && option.value,
	);

	return data.options?.keepDtos
		? commentDtosIfRequired(alterScriptDtos, shouldApplyDropStatements)
		: joinAlterScriptDtosIntoScript(alterScriptDtos, shouldApplyDropStatements);
};

/**
 * @param data {CoreData}
 * @param app {App}
 * @return { boolean}
 * */
const doesEntityLevelAlterScriptContainDropStatements = (data, app) => {
	const alterScriptDtos = getAlterScriptDtos(data, app);
	return alterScriptDtos.some(alterScriptDto => alterScriptDto?.isActivated && alterScriptDto.isDropScript);
};

const mapCoreDataForContainerLevelScripts = data => {
	return {
		...data,
		jsonSchema: data.collections[0],
		internalDefinitions: Object.values(data.internalDefinitions)[0],
	};
};

/**
 * @param data {CoreData}
 * @param app {App}
 * @return {string}
 * */
const buildContainerLevelAlterScript = (data, app) => {
	const preparedData = mapCoreDataForContainerLevelScripts(data);
	const alterScriptDtos = getAlterScriptDtos(preparedData, app);
	const shouldApplyDropStatements = preparedData.options?.additionalOptions?.some(
		option => option.id === 'applyDropStatements' && option.value,
	);

	return preparedData.options?.keepDtos
		? commentDtosIfRequired(alterScriptDtos, shouldApplyDropStatements)
		: joinAlterScriptDtosIntoScript(alterScriptDtos, shouldApplyDropStatements);
};

/**
 * @param data {CoreData}
 * @param app {App}
 * @return { boolean}
 * */
const doesContainerLevelAlterScriptContainDropStatements = (data, app) => {
	const preparedData = mapCoreDataForContainerLevelScripts(data);
	const alterScriptDtos = getAlterScriptDtos(preparedData, app);
	return alterScriptDtos.some(alterScriptDto => alterScriptDto?.isActivated && alterScriptDto.isDropScript);
};

module.exports = {
	buildEntityLevelAlterScript,
	doesEntityLevelAlterScriptContainDropStatements,
	buildContainerLevelAlterScript,
	doesContainerLevelAlterScriptContainDropStatements,
};
