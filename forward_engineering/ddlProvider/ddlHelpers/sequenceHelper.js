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
 * getOption: (sequence: Sequence, config: OptionConfig)=> {}
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
		return _.map(sequences, (sequence) => {
			const name = getNamePrefixedWithSchemaName(
				sequence.sequenceName,
				schemaName
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
		}).join('\n');
	};

	/**
	 * @param {Sequence} sequence 
	 * @returns {string}
	 */
	const getSequenceOptions = (sequence) => {
		const optionConfigs = [
			[{ key: 'dataType', clause: 'AS', getOption }],
			[{ key: 'increment', clause: 'INCREMENT', getOption }],
			[
				{ key: 'minValue', clause: 'MINVALUE', getOption },
				{ key: 'maxValue', clause: 'MAXVALUE', getOption },
			],
			[
				{ key: 'start', clause: 'START WITH', getOption },
				{ key: 'cache', clause: 'CACHE', getOption },
				{ key: 'cycle', clause: 'CYCLE', getOption: getCycle },
			],
			[{ key: 'ownedByNone', clause: 'OWNED BY', getOption: getOwnedBy }],
		];

		const options = optionConfigs
			.map((configs) => getOptions(sequence, configs))
			.map(wrapOption)
			.join('');

		return options ? '\n' + options.replace(/\n$/, '') : options;
	};

	/**
	 * @param {Sequence} sequence 
	 * @param {OptionConfig[]} configs 
	 * @returns {string}
	 */
	const getOptions = (sequence, configs) => {
		return configs
			.map((config) => config.getOption(sequence, config))
			.filter(Boolean)
			.join(' ');
	};

	/**
	 * @param {string} value 
	 * @returns {string}
	 */
	const wrapOption = (value) => {
		return value ? `\t${value}\n` : '';
	};

	/**
	 * @param {Sequence} sequence 
	 * @param {OptionConfig} config 
	 * @returns {string}
	 */
	const getOption = (sequence, config) => {
		const value = sequence[config.key];
		return value || value === 0 ? `${config.clause} ${value}` : '';
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
	const getCycle = (sequence) => {
		if (sequence.cycle === true) {
			return 'CYCLE';
		}

		if (sequence.cycle === false) {
			return 'NO CYCLE';
		}

		return '';
	};

	/**
	 * @param {Sequence} sequence 
	 * @returns {string}
	 */
	const getOwnedBy = (sequence) => {
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
	};
};
