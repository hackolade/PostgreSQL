let _ = null;

const setDependencies = app => {
	_ = app.require('lodash');
};

const clearEmptyPropertiesInObject = obj =>
	_.chain(obj)
		.toPairs()
		.reject(([key, value]) => _.isNil(value))
		.fromPairs()
		.value();

const getColumnNameByPosition = columns => position => _.find(columns, { ordinal_position: position })?.column_name;

module.exports = {
	clearEmptyPropertiesInObject,
	setDependencies,
	getColumnNameByPosition,
};
