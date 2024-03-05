
const { Sequence, SequenceDto } = require('../../../forward_engineering/types/schemaSequenceTypes');

/**
 * @param {{sequence: SequenceDto }} 
 * @returns {object[]}
 */
const getOwnedByColumn = ({ sequence }) => {
	if (!sequence.column_name) {
		return [];
	}
	return [{ entity: sequence.table_name, name: sequence.column_name }];
};

/**
 * @param {{ sequence: SequenceDto }} 
 * @returns {Sequence}
 */
const mapSequenceData = ({ sequence }) => {
	return {
		sequenceName: sequence.sequence_name,
		increment: sequence.increment,
		start: sequence.start_value,
		dataType: sequence.data_type,
		maxValue: sequence.maximum_value,
		minValue: sequence.minimum_value,
		cycle: sequence.cycle_option === 'YES',
		ownedByColumn: getOwnedByColumn({ sequence }),
		ownedByNone: !sequence.column_name,
	};
};

module.exports = {
	mapSequenceData,
};
