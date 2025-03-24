const _ = require('lodash');
const { clearEmptyPropertiesInObject, wrapInQuotes } = require('./common');
const { prepareStorageParameters } = require('./tableHelper');
const { TABLE_TYPE } = require('../../constants/tableType');

const VIEW_SUFFIX = ' (v)';

const isViewByTableType = table_type => [TABLE_TYPE.view, TABLE_TYPE.materializedView].includes(table_type);
const isViewByName = name => _.endsWith(name, VIEW_SUFFIX);
const removeViewNameSuffix = name => name.slice(0, -VIEW_SUFFIX.length);
const setViewSuffix = name => `${name}${VIEW_SUFFIX}`;

const generateCreateViewScript = (viewName, viewData, viewDefinitionFallback = {}) => {
	const selectStatement = _.trim(viewData.view_definition || viewDefinitionFallback.definition || '');

	if (!selectStatement) {
		return '';
	}

	return `CREATE VIEW ${wrapInQuotes(viewName)} AS ${selectStatement}`;
};

const prepareViewData = (viewData, viewOptions, triggers, tableToastOptions) => {
	const data = {
		withCheckOption: viewData.check_option !== 'NONE' || _.isNil(viewData.check_option),
		checkTestingScope: getCheckTestingScope(viewData.check_option),
		viewOptions: _.fromPairs(_.map(viewOptions?.view_options, splitByEqualitySymbol)),
		temporary: viewOptions?.persistence === 't',
		recursive: isViewRecursive(viewData),
		description: viewOptions?.description,
		triggers,
		...prepareMaterializedViewData({ viewData, viewOptions, tableToastOptions }),
	};
	return clearEmptyPropertiesInObject(data);
};

const prepareMaterializedViewData = ({ viewData, viewOptions, tableToastOptions }) => {
	return {
		...(viewData.table_type && { materialized: viewData.table_type === TABLE_TYPE.materializedView }),
		...(viewData.view_tablespace_name && { view_tablespace_name: viewData.view_tablespace_name }),
		...(viewData.is_populated && { withDataOption: viewData.is_populated }),
		...(viewOptions?.view_options && {
			storage_parameter: prepareStorageParameters(viewOptions.view_options, tableToastOptions),
		}),
	};
};

const getCheckTestingScope = check_option => {
	if (check_option === 'NONE') {
		return '';
	}

	return check_option;
};

const isViewRecursive = viewData => {
	return _.startsWith(_.trim(viewData.view_definition), 'WITH RECURSIVE');
};

const splitByEqualitySymbol = item => _.split(item, '=');

module.exports = {
	isViewByTableType,
	isViewByName,
	removeViewNameSuffix,
	generateCreateViewScript,
	setViewSuffix,
	prepareViewData,
};
