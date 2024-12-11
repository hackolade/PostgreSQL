const _ = require('lodash');
const { getColumnNameByPosition } = require('./common');

const prepareDeleteAndUpdate = value => {
	switch (value) {
		case 'a':
			return 'NO ACTION';
		case 'r':
			return 'RESTRICT';
		case 'c':
			return 'CASCADE';
		case 'n':
			return 'SET NULL';
		case 'd':
			return 'SET DEFAULT';
		default:
			return '';
	}
};

const prepareMatch = value => {
	switch (value) {
		case 'f':
			return 'FULL';
		case 's':
			return 'SIMPLE';
		case 'p':
			return 'PARTIAL';
		default:
			return '';
	}
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
			relationshipInfo: {
				relationshipOnDelete: prepareDeleteAndUpdate(foreignKeyData.relationship_on_delete),
				relationshipOnUpdate: prepareDeleteAndUpdate(foreignKeyData.relationship_on_update),
				relationshipMatch: prepareMatch(foreignKeyData.relationship_match),
			},
		};
	});
};

module.exports = {
	prepareForeignKeys,
};
