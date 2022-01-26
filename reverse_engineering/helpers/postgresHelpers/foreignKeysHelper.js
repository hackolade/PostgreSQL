const { getColumnNameByPosition } = require('./common');

let _ = null;

const setDependencies = app => {
	_ = app.require('lodash');
};

const prepareForeignKeys = (tableForeignKeys, tableName, schemaName, columns) => {
	return _.map(tableForeignKeys, foreignKeyData => {
		return {
			relationshipName: foreignKeyData.relationship_name,
			dbName: foreignKeyData.foreign_table_schema,
			parentCollection: foreignKeyData.foreign_table_name,
			parentField: foreignKeyData.foreign_columns,
			childDbName: schemaName,
			childCollection: tableName,
			childField: _.map(foreignKeyData.table_columns_positions, getColumnNameByPosition(columns)),
			relationshipType: 'Foreign Key',
		};
	});
};

module.exports = {
	setDependencies,
	prepareForeignKeys,
};
