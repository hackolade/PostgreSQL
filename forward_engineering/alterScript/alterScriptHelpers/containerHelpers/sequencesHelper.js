const _ = require('lodash');
const { AlterScriptDto, SCRIPT_TYPE } = require('../../types/AlterScriptDto');
const { App } = require('../../../types/coreApplicationTypes');
const { getDbName, getGroupItemsByCompMode, isObjectInDeltaModelActivated, getId } = require('../../../utils/general');
const {
	createSequenceScript,
	dropSequenceScript,
	alterSequenceScript,
} = require('../../../ddlProvider/ddlHelpers/sequenceHelper');

const sequencesCompModKey = 'sequences';

/**
 * @param {Object} props
 * @param {Object} props.container
 * @return {AlterScriptDto[]}
 * */
const getAddContainerSequencesScriptDtos = ({ container }) => {
	const schemaName = getDbName([container.role]);
	const isContainerActivated = isObjectInDeltaModelActivated(container);

	return (container.role?.sequences || [])
		.map(sequence => {
			const script = createSequenceScript({ schemaName, sequence });
			return AlterScriptDto.getInstance(
				script,
				isContainerActivated,
				false,
				SCRIPT_TYPE.alterContainer,
				getId(container),
			);
		})
		.filter(Boolean);
};

/**
 * @param {Object} props
 * @param {Object} props.container
 * @return {AlterScriptDto[]}
 * */
const getModifyContainerSequencesScriptDtos = ({ container }) => {
	const schemaName = getDbName([container.role]);
	const isContainerActivated = isObjectInDeltaModelActivated(container);
	const sequencesCompMod = container.role?.compMod?.[sequencesCompModKey] || {};
	const { new: newItems = [], old: oldItems = [] } = sequencesCompMod;

	const { removed, added, modified } = getGroupItemsByCompMode({
		newItems,
		oldItems,
	});

	const removedScriptDtos = removed.map(sequence => {
		const script = dropSequenceScript({ schemaName, sequence });
		return AlterScriptDto.getInstance(
			script,
			isContainerActivated,
			true,
			SCRIPT_TYPE.alterContainer,
			getId(container),
		);
	});

	const addedScriptDtos = added.map(sequence => {
		const script = createSequenceScript({ schemaName, sequence });
		return AlterScriptDto.getInstance(
			script,
			isContainerActivated,
			false,
			SCRIPT_TYPE.alterContainer,
			getId(container),
		);
	});

	const modifiedScriptDtos = modified.map(sequence => {
		const oldSequence = _.find(oldItems, { id: sequence.id }) || {};
		const script = alterSequenceScript({
			schemaName,
			sequence,
			oldSequence,
		});
		return AlterScriptDto.getInstance(
			script,
			isContainerActivated,
			false,
			SCRIPT_TYPE.alterContainer,
			getId(container),
		);
	});

	return [...modifiedScriptDtos, ...removedScriptDtos, ...addedScriptDtos].filter(Boolean);
};

/**
 * @param {Object} props
 * @param {Object} props.container
 * @return {AlterScriptDto[]}
 * */
const getDeleteContainerSequencesScriptDtos = ({ container }) => {
	const schemaName = getDbName([container.role]);
	const isContainerActivated = isObjectInDeltaModelActivated(container);

	return (container.role?.sequences || [])
		.map(sequence => {
			const script = dropSequenceScript({ schemaName, sequence });
			return AlterScriptDto.getInstance(
				script,
				isContainerActivated,
				true,
				SCRIPT_TYPE.alterContainer,
				getId(container),
			);
		})
		.filter(Boolean);
};

module.exports = {
	getAddContainerSequencesScriptDtos,
	getModifyContainerSequencesScriptDtos,
	getDeleteContainerSequencesScriptDtos,
};
