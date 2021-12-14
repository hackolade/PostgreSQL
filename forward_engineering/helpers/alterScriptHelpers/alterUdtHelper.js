const getCreateUdtScript = (app, dbVersion) => jsonSchema => {
	const _ = app.require('lodash');
	const { createColumnDefinitionBySchema } = require('./createColumnDefinition')(_);
	const ddlProvider = require('../../ddlProvider')(null, null, app);

	const schemaData = { dbVersion };

	const columnDefinitions = _.toPairs(jsonSchema.properties || {}).map(([name, column]) =>
		createColumnDefinitionBySchema({
			name,
			jsonSchema: column,
			parentJsonSchema: jsonSchema,
			ddlProvider,
			schemaData,
		}),
	);

	const updatedUdt = createColumnDefinitionBySchema({
		name: jsonSchema.code || jsonSchema.name,
		jsonSchema: jsonSchema,
		parentJsonSchema: { required: [] },
		ddlProvider,
		schemaData,
	});

	const udt = { ...updatedUdt, properties: columnDefinitions };

	return ddlProvider.createUdt(udt);
};

const getDeleteUdtScript = app => udt => {
	const _ = app.require('lodash');
	const { wrapInQuotes } = require('../general')({ _ });

	if (udt.type === 'domain') {
		return `DROP DOMAIN IF EXISTS ${wrapInQuotes(udt.code || udt.name)}`;
	} else {
		return `DROP TYPE IF EXISTS ${wrapInQuotes(udt.code || udt.name)}`;
	}
};

const getAddColumnToTypeScript = (app, dbVersion) => udt => {
	const _ = app.require('lodash');
	const { createColumnDefinitionBySchema } = require('./createColumnDefinition')(_);
	const { wrapInQuotes } = require('../general')({ _ });
	const ddlProvider = require('../../ddlProvider')(null, null, app);

	const fullName = wrapInQuotes(udt.code || udt.name);
	const schemaData = { dbVersion };

	return _.toPairs(udt.properties)
		.filter(([name, jsonSchema]) => !jsonSchema.compMod)
		.map(([name, jsonSchema]) =>
			createColumnDefinitionBySchema({
				name,
				jsonSchema,
				parentJsonSchema: { required: [] },
				ddlProvider,
				schemaData,
			}),
		)
		.map(ddlProvider.convertColumnDefinition)
		.map(script => `ALTER TYPE ${fullName} ADD ATTRIBUTE ${script};`);
};

const getDeleteColumnFromTypeScript = app => udt => {
	const _ = app.require('lodash');
	const { wrapInQuotes } = require('../general')({ _ });

	const fullName = wrapInQuotes(udt.code || udt.name);

	return _.toPairs(udt.properties)
		.filter(([name, jsonSchema]) => !jsonSchema.compMod)
		.map(([name]) => `ALTER TYPE ${fullName} DROP ATTRIBUTE IF EXISTS ${wrapInQuotes(name)};`);
};

module.exports = {
	getCreateUdtScript,
	getDeleteUdtScript,
	getAddColumnToTypeScript,
	getDeleteColumnFromTypeScript,
};
