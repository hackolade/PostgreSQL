const { checkFieldPropertiesChanged } = require('./common');

const getAddCollectionScript =
	({ app, dbVersion, modelDefinitions, internalDefinitions, externalDefinitions }) =>
	collection => {
		const _ = app.require('lodash');
		const { getEntityName } = require('../../utils/general')(_);
		const { createColumnDefinitionBySchema } = require('./createColumnDefinition')(app);
		const ddlProvider = require('../../ddlProvider')(null, null, app);
		const { getDefinitionByReference } = app.require('@hackolade/ddl-fe-utils');

		const schemaName = collection.compMod.keyspaceName;
		const schemaData = { schemaName, dbVersion };
		const jsonSchema = { ...collection, ...(_.omit(collection?.role, 'properties') || {}) };
		const columnDefinitions = _.toPairs(jsonSchema.properties).map(([name, column]) => {
			const definitionJsonSchema = getDefinitionByReference({
				propertySchema: column,
				modelDefinitions,
				internalDefinitions,
				externalDefinitions,
			});

			return createColumnDefinitionBySchema({
				name,
				jsonSchema: column,
				parentJsonSchema: jsonSchema,
				ddlProvider,
				schemaData,
				definitionJsonSchema,
			});
		});
		const checkConstraints = (jsonSchema.chkConstr || []).map(check =>
			ddlProvider.createCheckConstraint(ddlProvider.hydrateCheckConstraint(check)),
		);
		const tableData = {
			name: getEntityName(jsonSchema),
			columns: columnDefinitions.map(ddlProvider.convertColumnDefinition),
			checkConstraints: checkConstraints,
			foreignKeyConstraints: [],
			schemaData,
			columnDefinitions,
			dbData: { dbVersion },
		};
		const hydratedTable = ddlProvider.hydrateTable({ tableData, entityData: [jsonSchema], jsonSchema });

		return ddlProvider.createTable(hydratedTable, jsonSchema.isActivated);
	};

const getDeleteCollectionScript = app => collection => {
	const _ = app.require('lodash');
	const { getEntityName } = require('../../utils/general')(_);
	const { getNamePrefixedWithSchemaName } = require('../general')({ _ });

	const jsonData = { ...collection, ...(_.omit(collection?.role, 'properties') || {}) };
	const tableName = getEntityName(jsonData);
	const schemaName = collection.compMod.keyspaceName;
	const fullName = getNamePrefixedWithSchemaName(tableName, schemaName);

	return `DROP TABLE IF EXISTS ${fullName};`;
};

const getAddColumnScript =
	({ app, dbVersion, modelDefinitions, internalDefinitions, externalDefinitions }) =>
	collection => {
		const _ = app.require('lodash');
		const { getEntityName } = require('../../utils/general')(_);
		const { getNamePrefixedWithSchemaName } = require('../general')({ _ });
		const { createColumnDefinitionBySchema } = require('./createColumnDefinition')(app);
		const ddlProvider = require('../../ddlProvider')(null, null, app);
		const { getDefinitionByReference } = app.require('@hackolade/ddl-fe-utils');

		const collectionSchema = { ...collection, ...(_.omit(collection?.role, 'properties') || {}) };
		const tableName = getEntityName(collectionSchema);
		const schemaName = collectionSchema.compMod?.keyspaceName;
		const fullName = getNamePrefixedWithSchemaName(tableName, schemaName);
		const schemaData = { schemaName, dbVersion };

		return _.toPairs(collection.properties)
			.filter(([name, jsonSchema]) => !jsonSchema.compMod)
			.map(([name, jsonSchema]) => {
				const definitionJsonSchema = getDefinitionByReference({
					propertySchema: jsonSchema,
					modelDefinitions,
					internalDefinitions,
					externalDefinitions,
				});

				return createColumnDefinitionBySchema({
					name,
					jsonSchema,
					parentJsonSchema: collectionSchema,
					ddlProvider,
					schemaData,
					definitionJsonSchema,
				});
			})
			.map(ddlProvider.convertColumnDefinition)
			.map(script => `ALTER TABLE IF EXISTS ${fullName} ADD COLUMN IF NOT EXISTS ${script};`);
	};

const getDeleteColumnScript = app => collection => {
	const _ = app.require('lodash');
	const { getEntityName } = require('../../utils/general')(_);
	const { getNamePrefixedWithSchemaName, wrapInQuotes } = require('../general')({ _ });

	const collectionSchema = { ...collection, ...(_.omit(collection?.role, 'properties') || {}) };
	const tableName = getEntityName(collectionSchema);
	const schemaName = collectionSchema.compMod?.keyspaceName;
	const fullName = getNamePrefixedWithSchemaName(tableName, schemaName);

	return _.toPairs(collection.properties)
		.filter(([name, jsonSchema]) => !jsonSchema.compMod)
		.map(([name]) => `ALTER TABLE IF EXISTS ${fullName} DROP COLUMN IF EXISTS ${wrapInQuotes(name)};`);
};

const getFullTableName = (_) => (collection) => {
	const { getEntityName } = require('../../utils/general')(_);
	const { getNamePrefixedWithSchemaName } = require('../general')({ _ });

	const collectionSchema = { ...collection, ...(_.omit(collection?.role, 'properties') || {}) };
	const tableName = getEntityName(collectionSchema);
	const schemaName = collectionSchema.compMod?.keyspaceName;
	return getNamePrefixedWithSchemaName(tableName, schemaName);
}

const hasLengthChanged = (collection, fieldName) => {
	const previousLength = collection.role.properties[fieldName]?.length;
	const newLength = collection.role.compMod?.newProperties?.find(newProperty => newProperty.name === fieldName)?.length;
	const missingValue = [previousLength, newLength].find(e => e === null || e === undefined);
	return !missingValue && previousLength !== newLength;
}

const getUpdateTypesScripts = (_) => (collection) => {
	const fullTableName = getFullTableName(_)(collection);
	const { wrapInQuotes } = require('../general')({ _ });

	const changeTypeScripts = _.toPairs(collection.properties)
		.filter(([name, jsonSchema]) => {
			const hasTypeChanged = checkFieldPropertiesChanged(jsonSchema.compMod, ['type', 'mode']);
			if (!hasTypeChanged) {
				const isNewLength = hasLengthChanged(collection, name);
				return isNewLength;
			}
			return hasTypeChanged;
		})
		.map(
			([name, jsonSchema]) =>
				`ALTER TABLE IF EXISTS ${fullTableName} ALTER COLUMN ${wrapInQuotes(name)} SET DATA TYPE ${
					jsonSchema.compMod.newField.mode || jsonSchema.compMod.newField.type
				};`,
		);
	return [...changeTypeScripts];
}

const getModifyColumnScript = app => collection => {
	const _ = app.require('lodash');

	const fullTableName = getFullTableName(_)(collection);

	const renameColumnScripts = _.values(collection.properties)
		.filter(jsonSchema => checkFieldPropertiesChanged(jsonSchema.compMod, ['name']))
		.map(
			jsonSchema =>
				`ALTER TABLE IF EXISTS ${fullTableName} RENAME COLUMN ${wrapInQuotes(
					jsonSchema.compMod.oldField.name,
				)} TO ${wrapInQuotes(jsonSchema.compMod.newField.name)};`,
		);

	const updateTypeScripts = getUpdateTypesScripts(_)(collection);

	return [...renameColumnScripts, ...updateTypeScripts];
};

module.exports = {
	getAddCollectionScript,
	getDeleteCollectionScript,
	getAddColumnScript,
	getDeleteColumnScript,
	getModifyColumnScript,
};
