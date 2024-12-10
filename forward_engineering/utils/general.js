/*
 * Copyright © 2016-2021 by IntegrIT S.A. dba Hackolade.  All rights reserved.
 *
 * The copyright to the computer software herein is the property of IntegrIT S.A.
 * The software may be used and/or copied only with the written permission of
 * IntegrIT S.A. or in accordance with the terms and conditions stipulated in
 * the agreement/contract under which the software has been supplied.
 */

const _ = require('lodash');
const { AlterCollectionDto, AlterCollectionRoleDto } = require('../alterScript/types/AlterCollectionDto');
const { ReservedWordsAsArray } = require('../enums/reservedWords');

const MUST_BE_ESCAPED = /[\t\n'\f\r]/gm;

const getDbName = containerData => {
	return _.get(containerData, '[0].code') || _.get(containerData, '[0].name', '');
};

const getEntityName = entityData => {
	return (entityData && (entityData.code || entityData.collectionName)) || '';
};

const getViewName = view => {
	return (view && (view.code || view.name)) || '';
};

const getDbData = containerData => {
	return { ..._.get(containerData, '[0]', {}), name: getDbName(containerData) };
};

const getViewOn = viewData => _.get(viewData, '[0].viewOn');

const tab = (text, tab = '\t') => {
	return text
		.split('\n')
		.map(line => tab + line)
		.join('\n');
};

const hasType = (types, type) => {
	return Object.keys(types).map(_.toLower).includes(_.toLower(type));
};

/**
 * @param collection {AlterCollectionDto}
 * @return {AlterCollectionDto & AlterCollectionRoleDto}
 * */
const getSchemaOfAlterCollection = collection => {
	return { ...collection, ...(_.omit(collection?.role, 'properties') || {}) };
};

/**
 * @param collectionSchema {AlterCollectionDto & AlterCollectionRoleDto}
 * @return {string}
 * */
const getFullCollectionName = collectionSchema => {
	const collectionName = getEntityName(collectionSchema);
	const bucketName = collectionSchema.compMod?.keyspaceName;
	return getNamePrefixedWithSchemaName(collectionName, bucketName);
};

const clean = obj =>
	Object.entries(obj)
		.filter(([name, value]) => !_.isNil(value))
		.reduce(
			(result, [name, value]) => ({
				...result,
				[name]: value,
			}),
			{},
		);

const checkAllKeysActivated = keys => {
	return keys.every(key => _.get(key, 'isActivated', true));
};

/**
 * @param keys {Array<{
 *     isActivated: boolean,
 * }>}
 * */
const checkAllKeysDeactivated = keys => {
	return keys.length ? keys.every(key => !_.get(key, 'isActivated', true)) : false;
};

const divideIntoActivatedAndDeactivated = (items, mapFunction) => {
	const activatedItems = items.filter(item => _.get(item, 'isActivated', true)).map(mapFunction);
	const deactivatedItems = items.filter(item => !_.get(item, 'isActivated', true)).map(mapFunction);

	return { activatedItems, deactivatedItems };
};

const commentIfDeactivated = (statement, { isActivated, isPartOfLine, inlineComment = '--' }) => {
	if (!statement) {
		return '';
	}
	if (isActivated !== false) {
		return statement;
	}
	if (isPartOfLine) {
		return '/* ' + statement + ' */';
	} else if (statement.includes('\n')) {
		return '/*\n' + statement + ' */\n';
	} else {
		return inlineComment + ' ' + statement;
	}
};

const wrap = (str, start = "'", end = "'") => {
	const firstChar = str[0];
	const lastChar = str[str.length - 1];

	if (lastChar === start && firstChar === end) {
		return str;
	} else {
		return `${start}${str}${end}`;
	}
};

const checkFieldPropertiesChanged = (compMod, propertiesToCheck) => {
	return propertiesToCheck.some(prop => compMod?.oldField[prop] !== compMod?.newField[prop]);
};

const getFullTableName = collection => {
	const collectionSchema = { ...collection, ...(_.omit(collection?.role, 'properties') || {}) };
	const tableName = getEntityName(collectionSchema);
	const schemaName = getSchemaNameFromCollection({ collection: collectionSchema });
	return getNamePrefixedWithSchemaName(tableName, schemaName);
};

const getSchemaNameFromCollection = ({ collection }) => {
	return collection.compMod?.keyspaceName;
};

const getFullColumnName = (collection, columnName) => {
	const fullTableName = getFullTableName(collection);
	return `${fullTableName}.${wrapInQuotes(columnName)}`;
};

const getFullViewName = view => {
	const viewSchema = { ...view, ...(_.omit(view?.role, 'properties') || {}) };
	const viewName = getViewName(viewSchema);
	const schemaName = viewSchema.compMod?.keyspaceName;
	return getNamePrefixedWithSchemaName(viewName, schemaName);
};

/**
 * @param udt {Object}
 * @return {string}
 * */
const getUdtName = udt => {
	return udt.code || udt.name;
};

const getDbVersion = (dbVersion = '') => {
	const version = dbVersion.match(/\d+/);

	return Number(_.get(version, [0], 0));
};

const prepareComment = (comment = '') => comment.replace(MUST_BE_ESCAPED, character => `\\${character}`);

const wrapComment = comment => `E'${prepareComment(JSON.stringify(comment)).slice(1, -1)}'`;

const getFunctionArguments = functionArguments => {
	return _.map(functionArguments, arg => {
		const defaultExpression = arg.defaultExpression ? `DEFAULT ${arg.defaultExpression}` : '';

		return _.trim(`${arg.argumentMode} ${arg.argumentName || ''} ${arg.argumentType} ${defaultExpression}`);
	}).join(', ');
};

const getNamePrefixedWithSchemaName = (name, schemaName) => {
	if (schemaName) {
		return `${wrapInQuotes(schemaName)}.${wrapInQuotes(name)}`;
	}

	return wrapInQuotes(name);
};

const shouldNameBeEscaped = ({ name }) => /\s|\W/.test(name) || _.includes(ReservedWordsAsArray, _.toUpper(name));

const wrapInQuotes = name => (shouldNameBeEscaped({ name }) ? `"${name}"` : name);

const wrapInSingleQuotes = ({ name }) => (shouldNameBeEscaped({ name }) ? `'${name}'` : name);

const columnMapToString = ({ name }) => wrapInQuotes(name);

const getColumnsList = (columns, isAllColumnsDeactivated, isParentActivated, mapColumn = columnMapToString) => {
	const dividedColumns = divideIntoActivatedAndDeactivated(columns, mapColumn);
	const deactivatedColumnsAsString = dividedColumns?.deactivatedItems?.length
		? commentIfDeactivated(dividedColumns.deactivatedItems.join(', '), {
				isActivated: false,
				isPartOfLine: true,
			})
		: '';

	return !isAllColumnsDeactivated && isParentActivated
		? ' (' + dividedColumns.activatedItems.join(', ') + deactivatedColumnsAsString + ')'
		: ' (' + columns.map(mapColumn).join(', ') + ')';
};

const getKeyWithAlias = key => {
	if (!key) {
		return '';
	}

	if (key.alias) {
		return `${wrapInQuotes(key.name)} as ${wrapInQuotes(key.alias)}`;
	} else {
		return wrapInQuotes(key.name);
	}
};

const getViewData = keys => {
	if (!Array.isArray(keys)) {
		return { tables: [], columns: [] };
	}

	return keys.reduce(
		(result, key) => {
			if (!key.tableName) {
				result.columns.push(getKeyWithAlias(key));

				return result;
			}

			const tableName = `${wrapInQuotes(key.dbName)}.${wrapInQuotes(key.tableName)}`;

			if (!result.tables.includes(tableName)) {
				result.tables.push(tableName);
			}

			result.columns.push({
				statement: `${tableName}.${getKeyWithAlias(key)}`,
				isActivated: key.isActivated,
			});

			return result;
		},
		{
			tables: [],
			columns: [],
		},
	);
};

const getGroupItemsByCompMode = ({ newItems = [], oldItems = [] }) => {
	const addedItems = newItems.filter(newItem => !oldItems.some(item => item.id === newItem.id));
	const removedItems = [];
	const modifiedItems = [];

	oldItems.forEach(oldItem => {
		const newItem = newItems.find(item => item.id === oldItem.id);
		if (!newItem) {
			removedItems.push(oldItem);
		} else if (!_.isEqual(newItem, oldItem)) {
			modifiedItems.push(newItem);
		}
	});

	return {
		added: addedItems,
		removed: removedItems,
		modified: modifiedItems,
	};
};

module.exports = {
	getDbName,
	getDbData,
	getEntityName,
	getViewName,
	getViewOn,
	tab,
	hasType,
	clean,
	checkAllKeysActivated,
	checkAllKeysDeactivated,
	divideIntoActivatedAndDeactivated,
	commentIfDeactivated,
	wrap,
	checkFieldPropertiesChanged,
	getFullTableName,
	getFullColumnName,
	getFullViewName,
	getUdtName,
	getDbVersion,
	wrapComment,
	getFunctionArguments,
	getNamePrefixedWithSchemaName,
	wrapInQuotes,
	getColumnsList,
	getViewData,
	getSchemaOfAlterCollection,
	getFullCollectionName,
	getSchemaNameFromCollection,
	getGroupItemsByCompMode,
	wrapInSingleQuotes,
};
