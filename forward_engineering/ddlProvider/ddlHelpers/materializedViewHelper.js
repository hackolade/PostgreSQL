/**
 * @typedef {Record<string, unknown>} ViewData
 */
const { trim } = require('lodash');
const { getStorageParameters, getBasicValue } = require('./tableHelper');

/**
 * @param {{ viewData: ViewData }}
 * @returns {string}
 */
const getOptions = ({ viewData }) => {
	const configs = [
		{ key: 'usingMethod', getValue: getBasicValue('USING') },
		{ key: 'storage_parameter', getValue: getStorageParameters },
		{ key: 'tablespace_name', getValue: getBasicValue('TABLESPACE') },
	];

	const statements = configs
		.map(config => config.getValue(viewData[config.key], viewData))
		.filter(Boolean)
		.join('\n');

	return trim(statements) ? ` ${trim(statements)}` : '';
};

/**
 * @param {{ viewData: ViewData }}
 * @returns {string}
 */
const getWithDataClause = ({ viewData }) => {
	if (viewData.withDataOption) {
		return '\nWITH DATA';
	}

	return '\nWITH NO DATA';
};

module.exports = {
	getOptions,
	getWithDataClause,
};
