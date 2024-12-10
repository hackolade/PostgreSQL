const _ = require('lodash');
const { AlterScriptDto } = require('../../types/AlterScriptDto');
const { App } = require('../../../types/coreApplicationTypes');
const { getDbName, getGroupItemsByCompMode } = require('../../../utils/general');
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

	return (container.role?.sequences || [])
		.map(sequence => createSequenceScript({ schemaName, sequence }))
		.map(script => AlterScriptDto.getInstance([script], true, false))
		.filter(Boolean);
};

/**
 * @param {Object} props
 * @param {Object} props.container
 * @return {AlterScriptDto[]}
 * */
const getModifyContainerSequencesScriptDtos = ({ container }) => {
	const schemaName = getDbName([container.role]);
	const sequencesCompMod = container.role?.compMod?.[sequencesCompModKey] || {};
	const { new: newItems = [], old: oldItems = [] } = sequencesCompMod;

	const { removed, added, modified } = getGroupItemsByCompMode({
		newItems,
		oldItems,
	});

	const removedScriptDtos = removed
		.map(sequence => dropSequenceScript({ schemaName, sequence }))
		.map(script => AlterScriptDto.getInstance([script], true, true));
	const addedScriptDtos = added
		.map(sequence => createSequenceScript({ schemaName, sequence }))
		.map(script => AlterScriptDto.getInstance([script], true, false));

	const modifiedScriptDtos = modified
		.map(sequence => {
			const oldSequence = _.find(oldItems, { id: sequence.id }) || {};
			return alterSequenceScript({
				schemaName,
				sequence,
				oldSequence,
			});
		})
		.map(script => AlterScriptDto.getInstance([script], true, false));

	return [...modifiedScriptDtos, ...removedScriptDtos, ...addedScriptDtos].filter(Boolean);
};

/**
 * @param {Object} props
 * @param {Object} props.container
 * @return {AlterScriptDto[]}
 * */
const getDeleteContainerSequencesScriptDtos = ({ container }) => {
	const schemaName = getDbName([container.role]);

	return (container.role?.sequences || [])
		.map(sequence => dropSequenceScript({ schemaName, sequence }))
		.map(script => AlterScriptDto.getInstance([script], true, true))
		.filter(Boolean);
};

module.exports = {
	getAddContainerSequencesScriptDtos,
	getModifyContainerSequencesScriptDtos,
	getDeleteContainerSequencesScriptDtos,
};
