/**
 * @typedef {{
 * key: keyof Sequence;
 * clause: string;
 * getOption: ({ sequence, config } : { sequence: Sequence, config: OptionConfig }) => string
 * }} OptionConfig
 */

const { Sequence } = require('../../types/schemaSequenceTypes');

module.exports = ({
	_,
	templates,
	assignTemplates,
	getNamePrefixedWithSchemaName,
	wrapInQuotes,
}) => {

	/**
	 * @param {{ schemaName: string, sequences: Sequence[] }} 
	 * @returns {string}
	 */
	const getSequencesScript = ({ schemaName, sequences }) => {
		return _.map(sequences, (sequence) => createSequenceScript({ schemaName, sequence })).join('\n');
	};

	/**
	 * @param {{ schemaName: string, sequence: Sequence }} 
	 * @returns {string}
	 */
	const createSequenceScript = ({ schemaName, sequence }) => {
		const sequenceSchemaName = sequence.temporary ? '' : schemaName;
		const name = getNamePrefixedWithSchemaName(
			sequence.sequenceName,
			sequenceSchemaName
		);
		const ifNotExists = getIfNotExists({ sequence });
		const sequenceType = getSequenceType({ sequence });
		const options = getSequenceOptions({ sequence, schemaName });

		return assignTemplates(templates.createSequence, {
			name,
			ifNotExists,
			sequenceType,
			options,
		});
	};

	/**
	 * 
	 * @param {{ schemaName: string, sequence: Sequence, oldSequence: Sequence }} 
	 * @returns {string}
	 */
	const alterSequenceScript = ({ schemaName, sequence, oldSequence }) => {
		const sequenceSchemaName = sequence.temporary ? '' : schemaName;
		const sequenceName = oldSequence.sequenceName || sequence.sequenceName;
		const name = getNamePrefixedWithSchemaName(
			sequenceName,
			sequenceSchemaName
		);
		const modifiedSequence = _.omitBy(sequence, (value, key) => _.isEqual(value, oldSequence[key]));
		const options = getSequenceOptions({ schemaName, sequence: modifiedSequence });
		const sequenceType = getAlterSequenceType({ sequence: modifiedSequence });
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
	 * @param {{ schemaName: string, sequence: Sequence }} 
	 * @returns {string}
	 */
	const dropSequenceScript = ({ schemaName, sequence }) => {
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
	 * @param {{ schemaName: string, sequence: Sequence }} 
	 * @returns {string}
	 */
	const getSequenceOptions = ({ schemaName, sequence }) => {
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
			.map((config) => {
				const option = config.getOption({ sequence, schemaName, config });
				return wrapOption({ option });
			})
			.filter(Boolean)
			.join('');

		return options ? wrapOptionsBlock({ options }) : options;
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
	 * @param {{ option: string }} 
	 * @returns {string}
	 */
	const wrapOption = ({ option }) => {
		return option ? `\t${option}\n` : '';
	};

	/**
	 * @param {{ options: string }} 
	 * @returns {string}
	 */
	const wrapOptionsBlock = ({ options }) => {
		return '\n' + options.replace(/\n$/, '');
	};

	/**
	 * @param {{ sequence: Sequence }} 
	 * @returns {string}
	 */
	const getIfNotExists = ({ sequence }) => {
		return sequence.ifNotExist ? ' IF NOT EXISTS' : '';
	};

	/**
	 * @param {{ sequence: Sequence }} 
	 * @returns {string}
	 */
	const getSequenceType = ({ sequence }) => {
		if (sequence.temporary) {
			return ' TEMPORARY';
		}

		if (sequence.unlogged) {
			return ' UNLOGGED';
		}

		return '';
	};

	/**
	 * @param {{ sequence: Sequence }} 
	 * @returns {string}
	 */
	const getAlterSequenceType = ({ sequence }) => {
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
	 * @param {{ sequence: Sequence, schemaName: string }} param0 
	 * @returns {string}
	 */
	const getOwnedBy = ({ sequence, schemaName }) => {
		if (sequence.ownedByNone) {
			return 'OWNED BY NONE';
		}

		const ownedColumn = sequence.ownedByColumn?.[0];

		if (ownedColumn) {
			const [tableName, columnName] = ownedColumn.name?.split('.') || [];
			const ownedColumnName = [schemaName, tableName, columnName].filter(Boolean).map(wrapInQuotes).join('.');
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
