const _ = require('lodash');
const { AlterScriptDto, SCRIPT_TYPE } = require('../types/AlterScriptDto');
const {
	getUdtName,
	wrapInQuotes,
	checkFieldPropertiesChanged,
	isObjectInDeltaModelActivated,
} = require('../../utils/general');

/**
 * @return {(jsonSchema: Object) => AlterScriptDto |  undefined}
 * */
const getCreateUdtScriptDto =
	({ app, dbVersion, modelDefinitions, internalDefinitions, externalDefinitions }) =>
	jsonSchema => {
		const { createColumnDefinitionBySchema } = require('./createColumnDefinition')(app);
		const ddlProvider = require('../../ddlProvider/ddlProvider')(null, null, app);
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

		const script = ddlProvider.createUdt(udt);
		return AlterScriptDto.getInstance(script, jsonSchema.isActivated, false, SCRIPT_TYPE.createUDT);
	};

/**
 * @return {(udt: Object) => AlterScriptDto | undefined}
 * */
const getDeleteUdtScriptDto = app => udt => {
	const ddlProvider = require('../../ddlProvider/ddlProvider')(null, null, app);

	const ddlUdtName = wrapInQuotes(getUdtName(udt));
	if (udt.type === 'domain') {
		const script = ddlProvider.dropDomain(ddlUdtName);
		return AlterScriptDto.getInstance(script, udt.isActivated, true, SCRIPT_TYPE.dropUDT);
	} else {
		const script = ddlProvider.dropType(ddlUdtName);
		return AlterScriptDto.getInstance(script, udt.isActivated, true, SCRIPT_TYPE.dropUDT);
	}
};

/**
 * @return {(udt: Object) => AlterScriptDto[]}
 * */
const getAddColumnToTypeScriptDtos =
	({ app, dbVersion, modelDefinitions, internalDefinitions, externalDefinitions }) =>
	udt => {
		const { createColumnDefinitionBySchema } = require('./createColumnDefinition')(app);
		const ddlProvider = require('../../ddlProvider/ddlProvider')(null, null, app);
		const { getDefinitionByReference } = app.require('@hackolade/ddl-fe-utils');

		const fullName = wrapInQuotes(getUdtName(udt));
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

				const def = createColumnDefinitionBySchema({
					name,
					jsonSchema,
					parentJsonSchema: { required: [] },
					ddlProvider,
					schemaData,
					definitionJsonSchema,
				});
				const columnDefinition = ddlProvider.convertColumnDefinition(def);
				const script = ddlProvider.alterTypeAddAttribute(fullName, columnDefinition);
				return AlterScriptDto.getInstance(script, udt.isActivated, false, SCRIPT_TYPE.alterUDT);
			})
			.filter(Boolean);
	};

/**
 * @return {(udt: Object) => AlterScriptDto[]}
 * */
const getDeleteColumnFromTypeScriptDtos = app => udt => {
	const ddlProvider = require('../../ddlProvider/ddlProvider')(null, null, app);

	const fullName = wrapInQuotes(udt.code || udt.name);
	const isActivated = isObjectInDeltaModelActivated(udt);

	return _.toPairs(udt.properties)
		.filter(([name, jsonSchema]) => !jsonSchema.compMod)
		.map(([name]) => {
			const script = ddlProvider.alterTypeDropAttribute(fullName, wrapInQuotes(name));
			return AlterScriptDto.getInstance(script, isActivated, true, SCRIPT_TYPE.alterUDT);
		})
		.filter(Boolean);
};

/**
 * @return {(udt: Object) => AlterScriptDto[]}
 * */
const getModifyColumnOfTypeScriptDtos = app => udt => {
	const ddlProvider = require('../../ddlProvider/ddlProvider')(null, null, app);

	const fullName = wrapInQuotes(udt.code || udt.name);
	const isActivated = isObjectInDeltaModelActivated(udt);

	const renameColumnScripts = _.values(udt.properties)
		.filter(jsonSchema => checkFieldPropertiesChanged(jsonSchema.compMod, ['name']))
		.map(jsonSchema => {
			const oldAttributeDDLName = wrapInQuotes(jsonSchema.compMod.oldField.name);
			const newAttributeDDLName = wrapInQuotes(jsonSchema.compMod.newField.name);
			const script = ddlProvider.alterTypeRenameAttribute(fullName, oldAttributeDDLName, newAttributeDDLName);
			return AlterScriptDto.getInstance(script, isActivated, false, SCRIPT_TYPE.alterUDT);
		});

	const changeTypeScripts = _.toPairs(udt.properties)
		.filter(([name, jsonSchema]) => checkFieldPropertiesChanged(jsonSchema.compMod, ['type', 'mode']))
		.map(([name, jsonSchema]) => {
			const attributeDDLName = wrapInQuotes(name);
			const newDataType = jsonSchema.compMod.newField.mode || jsonSchema.compMod.newField.type;
			const script = ddlProvider.alterTypeChangeAttributeType(fullName, attributeDDLName, newDataType);
			return AlterScriptDto.getInstance(script, isActivated, false, SCRIPT_TYPE.alterUDT);
		});

	return [...renameColumnScripts, ...changeTypeScripts].filter(Boolean);
};

module.exports = {
	getCreateUdtScriptDto,
	getDeleteUdtScriptDto,
	getAddColumnToTypeScriptDtos,
	getDeleteColumnFromTypeScriptDtos,
	getModifyColumnOfTypeScriptDtos,
};
