const { checkFieldPropertiesChanged } = require('./common');

const getCreateUdtScript =
	({ app, dbVersion, modelDefinitions, internalDefinitions, externalDefinitions }) =>
	jsonSchema => {
		const _ = app.require('lodash');
		const { createColumnDefinitionBySchema } = require('./createColumnDefinition')(app);
		const ddlProvider = require('../../ddlProvider')(null, null, app);
		const { getDefinitionByReference } = app.require('@hackolade/ddl-fe-utils');

		const schemaData = { dbVersion };

		const columnDefinitions = _.toPairs(jsonSchema.properties || {}).map(([name, column]) => {
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

		const updatedUdt = createColumnDefinitionBySchema({
			name: jsonSchema.code || jsonSchema.name,
			jsonSchema: jsonSchema,
			parentJsonSchema: { required: [] },
			definitionJsonSchema: {},
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
		return `DROP DOMAIN IF EXISTS ${wrapInQuotes(udt.code || udt.name)};`;
	} else {
		return `DROP TYPE IF EXISTS ${wrapInQuotes(udt.code || udt.name)};`;
	}
};

const getAddColumnToTypeScript =
	({ app, dbVersion, modelDefinitions, internalDefinitions, externalDefinitions }) =>
	udt => {
		const _ = app.require('lodash');
		const { createColumnDefinitionBySchema } = require('./createColumnDefinition')(app);
		const { wrapInQuotes } = require('../general')({ _ });
		const ddlProvider = require('../../ddlProvider')(null, null, app);
		const { getDefinitionByReference } = app.require('@hackolade/ddl-fe-utils');

		const fullName = wrapInQuotes(udt.code || udt.name);
		const schemaData = { dbVersion };

		return _.toPairs(udt.properties)
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
					parentJsonSchema: { required: [] },
					ddlProvider,
					schemaData,
					definitionJsonSchema,
				});
			})
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

const getModifyColumnOfTypeScript = app => udt => {
	const _ = app.require('lodash');
	const { wrapInQuotes } = require('../general')({ _ });

	const fullName = wrapInQuotes(udt.code || udt.name);

	const renameColumnScripts = _.values(udt.properties)
		.filter(jsonSchema => checkFieldPropertiesChanged(jsonSchema.compMod, ['name']))
		.map(
			jsonSchema =>
				`ALTER TYPE ${fullName} RENAME ATTRIBUTE ${wrapInQuotes(
					jsonSchema.compMod.oldField.name,
				)} TO ${wrapInQuotes(jsonSchema.compMod.newField.name)};`,
		);

	const changeTypeScripts = _.toPairs(udt.properties)
		.filter(([name, jsonSchema]) => checkFieldPropertiesChanged(jsonSchema.compMod, ['type', 'mode']))
		.map(
			([name, jsonSchema]) =>
				`ALTER TYPE ${fullName} ALTER ATTRIBUTE ${wrapInQuotes(name)} SET DATA TYPE ${
					jsonSchema.compMod.newField.mode || jsonSchema.compMod.newField.type
				};`,
		);

	return [...renameColumnScripts, ...changeTypeScripts];
};

module.exports = {
	getCreateUdtScript,
	getDeleteUdtScript,
	getAddColumnToTypeScript,
	getDeleteColumnFromTypeScript,
	getModifyColumnOfTypeScript,
};
