/**
 * @typedef {'bigint' | 'integer' | 'smallint'} DataType
 * 
 * @typedef {{
 * cache?: number;
 * cycle: boolean;
 * dataType: DataType;
 * ifNotExist: boolean;
 * increment?: number;
 * maxValue?: number;
 * minValue?: number;
 * ownedByColumn: object[];
 * ownedByNone: boolean;
 * sequenceName: string;
 * start?: number;
 * temporary: boolean;
 * unlogged: boolean;
 * }} Sequence
 * 
 * @typedef {{
 * key: keyof Sequence;
 * clause: string;
 * getOption: ({ sequence: Sequence, config: OptionConfig }) => {}
 * }} OptionConfig
 */

module.exports = ({
	_,
	templates,
	assignTemplates,
	getNamePrefixedWithSchemaName,
}) => {
	/**
	 * @param {string} schemaName 
	 * @param {Sequence[]} sequences 
	 * @returns {string}
	 */
	const getSequencesScript = (schemaName, sequences) => {
		return _.map(sequences, (sequence) => createSequenceScript(schemaName, sequence)).join('\n');
	};

	/**
	 * @param {string} schemaName 
	 * @param {Sequence} sequence
	 * @returns {string}
	 */
	const createSequenceScript = (schemaName, sequence) => {
		const sequenceSchemaName = sequence.temporary ? '' : schemaName;
		const name = getNamePrefixedWithSchemaName(
			sequence.sequenceName,
			sequenceSchemaName
		);
		const ifNotExists = getIfNotExists(sequence);
		const sequenceType = getSequenceType(sequence);
		const options = getSequenceOptions(sequence);

		return assignTemplates(templates.createSequence, {
			name,
			ifNotExists,
			sequenceType,
			options,
		});
	};

	const alterSequenceScript = (schemaName, sequence, oldSequence) => {
		const sequenceSchemaName = sequence.temporary ? '' : schemaName;
		const sequenceName = oldSequence.sequenceName || sequence.sequenceName;
		const name = getNamePrefixedWithSchemaName(
			sequenceName,
			sequenceSchemaName
		);
		const modifiedSequence = _.omitBy(sequence, (value, key) => _.isEqual(value, oldSequence[key]));
		const options = getSequenceOptions(modifiedSequence);
		const sequenceType = getAlterSequenceType(modifiedSequence);
		const newName = modifiedSequence.sequenceName;
		/**
		 * @type {Array}
		 */
		const configs = [
			{ key: 'options', value: options, template: templates.alterSequence },
			{ key: 'sequenceType', value: sequenceType, template: templates.setSequenceType },
			{ key: 'newName', value: newName, template: templates.renameSequence }
		];

		return configs.filter(config => config.value).map(config => assignTemplates(config.template, { [config.key]: config.value, name })).join('\n');
	};

	/**
	 * @param {string} schemaName 
	 * @param {Sequence} sequence
	 * @returns {string}
	 */
	const dropSequenceScript = (schemaName, sequence) => {
		const sequenceSchemaName = sequence.temporary ? '' : schemaName;
		const name = getNamePrefixedWithSchemaName(
			sequence.sequenceName,
			sequenceSchemaName
		);

		return assignTemplates(templates.dropSequence, {
			name,
		});
	};

	/**
	 * @param {Sequence} sequence 
	 * @returns {string}
	 */
	const getSequenceOptions = (sequence) => {
		/**
		 * @type {Array<OptionConfig>}
		 */
		const optionConfigs = [
			{ getOption, key: 'dataType', clause: 'AS', },
			{ getOption, key: 'increment', clause: 'INCREMENT BY', },
			{ getOption, key: 'start', clause: 'START WITH', },
			{ getOption, key: 'minValue', clause: 'MINVALUE', },
			{ getOption, key: 'maxValue', clause: 'MAXVALUE', },
			{ getOption, key: 'cache', clause: 'CACHE', },
			{ getOption: getCycle, key: 'cycle' },
			{ getOption: getOwnedBy, key: 'ownedByColumn' },
		];

		const options = optionConfigs
			.map((config) => wrapOption(config.getOption({ sequence, config })))
			.filter(Boolean)
			.join('');

		return options ? wrapOptionsBlock(options) : options;
	};

	/**
	 * @param {{ sequence: Sequence; config: OptionConfig }} param0 
	 * @returns {string}
	 */
	const getOption = ({ sequence, config }) => {
		const value = sequence[config.key];
		return value || value === 0 ? `${config.clause} ${value}` : '';
	};

	/**
	 * @param {string} option 
	 * @returns {string}
	 */
	const wrapOption = (option) => {
		return option ? `\t${option}\n` : '';
	};

	/**
	 * @param {string} option 
	 * @returns {string}
	 */
	const wrapOptionsBlock = (option) => {
		return '\n' + option.replace(/\n$/, '');
	};

	/**
	 * @param {Sequence} sequence 
	 * @returns {string}
	 */
	const getIfNotExists = (sequence) => {
		return sequence.ifNotExist ? ' IF NOT EXISTS' : '';
	};

	/**
	 * @param {Sequence} sequence 
	 * @returns {string}
	 */
	const getSequenceType = (sequence) => {
		if (sequence.temporary) {
			return ' TEMPORARY';
		}

		if (sequence.unlogged) {
			return ' UNLOGGED';
		}

		return '';
	};

	/**
	 * @param {Sequence} sequence 
	 * @returns {string}
	 */
	const getAlterSequenceType = (sequence) => {
		if (sequence.temporary) {
			return '';
		}

		if (sequence.unlogged === true) {
			return 'UNLOGGED';
		}

		if (sequence.unlogged === false) {
			return 'LOGGED';
		}

		return '';
	};

	/**
	 * @param {{ sequence: Sequence }} param0
	 * @returns {string}
	 */
	const getCycle = ({ sequence }) => {
		if (sequence.cycle === true) {
			return 'CYCLE';
		}

		if (sequence.cycle === false) {
			return 'NO CYCLE';
		}

		return '';
	};

	/**
	 * @param {{ sequence: Sequence }} param0 
	 * @returns {string}
	 */
	const getOwnedBy = ({ sequence }) => {
		if (sequence.ownedByNone) {
			return 'OWNED BY NONE';
		}

		const ownedColumn = sequence.ownedByColumn?.[0];

		if (ownedColumn) {
			const [tableName, columnName] = ownedColumn.name?.split('.') || [];
			const ownedColumnName = getNamePrefixedWithSchemaName(
				columnName,
				tableName
			);
			return `OWNED BY ${ownedColumnName}`;
		}

		return '';
	};

	return {
		getSequencesScript,
		createSequenceScript,
		dropSequenceScript,
		alterSequenceScript,
	};
};
