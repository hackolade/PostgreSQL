const getAddCollectionScript = (app, dbVersion) => collection => {
	const _ = app.require('lodash');
	const { getEntityName } = require('../../utils/general')(_);
	const { createColumnDefinitionBySchema } = require('./createColumnDefinition')(_);
	const ddlProvider = require('../../ddlProvider')(null, null, app);

	const schemaName = collection.compMod.keyspaceName;
	const schemaData = { schemaName, dbVersion };
	const jsonSchema = { ...collection, ...(_.omit(collection?.role, 'properties') || {}) };
	const columnDefinitions = _.toPairs(jsonSchema.properties).map(([name, column]) =>
		createColumnDefinitionBySchema({
			name,
			jsonSchema: column,
			parentJsonSchema: jsonSchema,
			ddlProvider,
			schemaData,
		}),
	);
	const checkConstraints = jsonSchema.chkConstr.map(check =>
		ddlProvider.createCheckConstraint(ddlProvider.hydrateCheckConstraint(check)),
	);
	const tableData = {
		name: getEntityName(jsonSchema),
		columns: columnDefinitions.map(ddlProvider.convertColumnDefinition),
		checkConstraints: checkConstraints,
		foreignKeyConstraints: [],
		schemaData,
		columnDefinitions,
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

const getAddColumnScript = (app, dbVersion) => collection => {
	const _ = app.require('lodash');
	const { getEntityName } = require('../../utils/general')(_);
	const { getNamePrefixedWithSchemaName } = require('../general')({ _ });
	const { createColumnDefinitionBySchema } = require('./createColumnDefinition')(_);
	const ddlProvider = require('../../ddlProvider')(null, null, app);

	const collectionSchema = { ...collection, ...(_.omit(collection?.role, 'properties') || {}) };
	const tableName = getEntityName(collectionSchema);
	const schemaName = collectionSchema.compMod?.keyspaceName;
	const fullName = getNamePrefixedWithSchemaName(tableName, schemaName);
	const schemaData = { schemaName, dbVersion };

	return _.toPairs(collection.properties)
		.filter(([name, jsonSchema]) => !jsonSchema.compMod)
		.map(([name, jsonSchema]) =>
			createColumnDefinitionBySchema({
				name,
				jsonSchema,
				parentJsonSchema: collectionSchema,
				ddlProvider,
				schemaData,
			}),
		)
		.map(ddlProvider.convertColumnDefinition)
		.map(script => `ALTER TABLE ${fullName} ADD COLUMN IF NOT EXISTS ${script};`);
};

const getDeleteColumnScript = (app, dbVersion) => collection => {
	const _ = app.require('lodash');
	const { getEntityName } = require('../../utils/general')(_);
	const { getNamePrefixedWithSchemaName, wrapInQuotes } = require('../general')({ _ });

	const collectionSchema = { ...collection, ...(_.omit(collection?.role, 'properties') || {}) };
	const tableName = getEntityName(collectionSchema);
	const schemaName = collectionSchema.compMod?.keyspaceName;
	const fullName = getNamePrefixedWithSchemaName(tableName, schemaName);

	return _.toPairs(collection.properties)
		.filter(([name, jsonSchema]) => !jsonSchema.compMod)
		.map(([name]) => `ALTER TABLE ${fullName} DROP COLUMN IF EXISTS ${wrapInQuotes(name)};`);
};

module.exports = {
	getAddCollectionScript,
	getDeleteCollectionScript,
	getAddColumnScript,
	getDeleteColumnScript,
};
