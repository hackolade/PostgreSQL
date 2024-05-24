class Sequence {
	/**
	 *@type {number | undefined}
	 */
	cache;

	/**
	 * @type {boolean}
	 */
	cycle;

	/**
	 * @type {'bigint' | 'integer' | 'smallint'}
	 */
	dataType;

	/**
	 * @type {boolean}
	 */
	ifNotExist;

	/**
	 * @type {number | undefined}
	 */
	increment;

	/**
	 * @type {number | undefined}
	 */
	maxValue;

	/**
	 * @type {number | undefined}
	 */
	minValue;

	/**
	 * @type {object[]}
	 */
	ownedByColumn;

	/**
	 * @type {boolean}
	 */
	ownedByNone;

	/**
	 * @type {string}
	 */
	sequenceName;

	/**
	 * @type {number | undefined}
	 */
	start;

	/**
	 * @type {boolean}
	 */
	temporary;

	/**
	 * @type {boolean}
	 */
	unlogged;
}

class SequenceDto {
	/**
	 * @type {string}
	 */
	sequence_name;

	/**
	 * @type {number}
	 */
	increment;

	/**
	 * @type {number}
	 */
	start;

	/**
	 * @type {'bigint' | 'integer' | 'smallint'}
	 */
	data_type;

	/**
	 * @type {number}
	 */
	maximum_value;

	/**
	 * @type {number}
	 */
	minimum_value;

	/**
	 * @type {'YES' | 'NO'}
	 */
	cycle_option;

	/**
	 * @type {number}
	 */
	cache_size;

	/**
	 * @type {'t' | 'u' | 'p' | null}
	 */
	rel_persistance;

	/**
	 * @type {string | null}
	 */
	column_name;

	/**
	 * @type {string | null}
	 */
	table_name;
}

module.exports = {
	Sequence,
	SequenceDto,
};
