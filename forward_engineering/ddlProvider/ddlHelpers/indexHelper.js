const _ = require('lodash');
const {
	wrapInQuotes,
	checkAllKeysDeactivated,
	getColumnsList,
	getNamePrefixedWithSchemaName,
	getDbVersion,
	commentIfDeactivated,
} = require('../../utils/general');
const assignTemplates = require('../../utils/assignTemplates');
const templates = require('../templates');

const mapIndexKey = ({ name, sortOrder, nullsOrder, collation, opclass }) => {
	const sortOrderStr = sortOrder ? ` ${sortOrder}` : '';
	const nullsOrderStr = nullsOrder ? ` ${nullsOrder}` : '';
	const collate = _.includes(collation, '"') ? collation : `"${collation}"`;
	const collationStr = collation ? ` COLLATE ${collate}` : '';
	const opclassStr = opclass ? ` ${opclass}` : '';

	return `${wrapInQuotes(name)}${collationStr}${opclassStr}${sortOrderStr}${nullsOrderStr}`;
};

const getIndexKeys = ({ columns = [], isParentActivated }) => {
	const isAllColumnsDeactivated = checkAllKeysDeactivated(columns);

	return getColumnsList(columns, isAllColumnsDeactivated, isParentActivated, mapIndexKey);
};

const getIndexOptions = (index, isParentActivated) => {
	const includeKeys = getColumnsList(
		index.include || [],
		checkAllKeysDeactivated(index.include || []),
		isParentActivated,
	);
	const include = index.include?.length ? ` INCLUDE ${_.trim(includeKeys)}` : '';
	const withOptionsString = getWithOptions(index);
	const withOptions = withOptionsString ? ` WITH (\n\t${withOptionsString})` : '';
	const tableSpace = index.index_tablespace_name ? ` TABLESPACE ${index.index_tablespace_name}` : '';
	const whereExpression = index.where ? ` WHERE ${index.where}` : '';

	return _.compact([' ', include, withOptions, tableSpace, whereExpression]).join('\n');
};

const INDEX_STORAGE_OPTIONS_BY_METHOD = {
	btree: {
		index_fillfactor: 'fillfactor',
		deduplicate_items: 'deduplicate_items',
	},
	hash: {
		index_fillfactor: 'fillfactor',
	},
	spgist: {
		index_fillfactor: 'fillfactor',
	},
	gist: {
		index_fillfactor: 'fillfactor',
		index_buffering: 'buffering',
	},
	gin: {
		fastupdate: 'fastupdate',
		gin_pending_list_limit: 'gin_pending_list_limit',
	},
	brin: {
		pages_per_range: 'pages_per_range',
		autosummarize: 'autosummarize',
	},
};

const getWithOptions = index => {
	const config = INDEX_STORAGE_OPTIONS_BY_METHOD[index.index_method];

	return _.chain(config)
		.toPairs()
		.map(([keyInModel, postgresKey]) => {
			const value = index.index_storage_parameter?.[keyInModel];

			if (_.isNil(value) || value === '') {
				return;
			}

			return `${postgresKey}=${getValue(value)}`;
		})
		.compact()
		.join(',\n\t')
		.value();
};

const getValue = value => {
	if (_.isBoolean(value)) {
		return value ? 'ON' : 'OFF';
	}

	return value;
};

const createIndex = (tableName, index, dbData, isParentActivated = true) => {
	const isNameEmpty = !index.indxName && index.ifNotExist;

	if (!index.columns.length || isNameEmpty) {
		return '';
	}

	const isUnique = index.unique && index.index_method === 'btree';
	const name = wrapInQuotes(index.indxName);
	const unique = isUnique ? ' UNIQUE' : '';
	const concurrently = index.concurrently ? ' CONCURRENTLY' : '';
	const ifNotExist = index.ifNotExist ? ' IF NOT EXISTS' : '';
	const only = index.only ? ' ONLY' : '';
	const using = index.index_method ? ` USING ${_.toUpper(index.index_method)}` : '';
	const dbVersion = getDbVersion(_.get(dbData, 'dbVersion', ''));
	const nullsDistinct = isUnique && index.nullsDistinct && dbVersion >= 15 ? `\n ${index.nullsDistinct}` : '';
	const indexColumns =
		index.index_method === 'btree'
			? index.columns
			: _.map(index.columns, column => _.omit(column, 'sortOrder', 'nullsOrder'));

	const keys = getIndexKeys({
		columns: indexColumns,
		isParentActivated,
	});
	const options = getIndexOptions(index, isParentActivated);

	return commentIfDeactivated(
		assignTemplates(templates.index, {
			unique,
			concurrently,
			ifNotExist,
			name,
			only,
			using,
			keys,
			options,
			nullsDistinct,
			tableName: getNamePrefixedWithSchemaName(tableName, index.schemaName),
		}),
		{
			isActivated: index.isActivated,
		},
	);
};

/**
 * @param indexName {string}
 * @return {string}
 * */
const dropIndex = ({ indexName }) => {
	const templatesConfig = {
		indexName,
	};
	return assignTemplates(templates.dropIndex, templatesConfig);
};

module.exports = {
	createIndex,
	dropIndex,
	getIndexKeys,
	getIndexOptions,
	getWithOptions,
};
