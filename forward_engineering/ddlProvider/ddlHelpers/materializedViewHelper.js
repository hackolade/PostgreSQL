/**
 * @typedef {Record<string, unknown>} ViewData
 */
const { getStorageParameters, getBasicValue } = require('./tableHelper');

/**
 * @param {{ viewData: ViewData }}
 * @returns {string}
 */
const getOptions = ({ viewData }) => {
	const configs = [
		{ key: 'usingMethod', getValue: getBasicValue('USING') },
		{ key: 'storage_parameter', getValue: getStorageParameters },
		{ key: 'view_tablespace_name', getValue: getBasicValue('TABLESPACE') },
	];

	const statements = configs
		.map(config => config.getValue(viewData[config.key], viewData))
		.filter(Boolean)
		.join('\n')
		.trim();

	return statements ? ` ${statements}` : '';
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
