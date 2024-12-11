const _ = require('lodash');
const { getModifyCheckConstraintScriptDtos } = require('./entityHelpers/checkConstraintHelper');
const { getModifyEntityCommentsScriptDtos } = require('./entityHelpers/commentsHelper');
const { getUpdateTypesScriptDtos } = require('./columnHelpers/alterTypeHelper');
const { getModifyNonNullColumnsScriptDtos } = require('./columnHelpers/nonNullConstraintHelper');
const { getModifiedCommentOnColumnScriptDtos } = require('./columnHelpers/commentsHelper');
const { getRenameColumnScriptDtos } = require('./columnHelpers/renameColumnHelper');
const { AlterScriptDto } = require('../types/AlterScriptDto');
const { AlterCollectionDto } = require('../types/AlterCollectionDto');
const { getModifyPkConstraintsScriptDtos } = require('./entityHelpers/primaryKeyHelper');
const { getModifyUniqueKeyConstraintsScriptDtos } = require('./entityHelpers/uniqueKeyHelper');
const {
	getModifyIndexesScriptDtos,
	getAddedIndexesScriptDtos,
	getAdditionalDataForDdlProvider,
} = require('./entityHelpers/indexesHelper');
const { getModifiedDefaultColumnValueScriptDtos } = require('./columnHelpers/defaultValueHelper');
const { getEntityName, getFullTableName, getNamePrefixedWithSchemaName, wrapInQuotes } = require('../../utils/general');

/**
 * @return {(collection: AlterCollectionDto) => AlterScriptDto | undefined}
 * */
const getAddCollectionScriptDto =
	({ app, dbVersion, modelDefinitions, internalDefinitions, externalDefinitions }) =>
	collection => {
		const ddlProvider = require('../../ddlProvider/ddlProvider')(null, null, app);
		const { createColumnDefinitionBySchema } = require('./createColumnDefinition')(app);
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

		const indexesOnNewlyCreatedColumnsScripts = getNewlyCreatedIndexesScripts({
			ddlProvider,
			collection,
			dbVersion,
		}).flatMap(({ scripts }) => scripts.map(({ script }) => script));
		const script = ddlProvider.createTable(hydratedTable, jsonSchema.isActivated);
		return AlterScriptDto.getInstance([script, ...indexesOnNewlyCreatedColumnsScripts], true, false);
	};

/**
 * @return {(collection: AlterCollectionDto) => AlterScriptDto | undefined}
 * */
const getDeleteCollectionScriptDto = app => collection => {
	const ddlProvider = require('../../ddlProvider/ddlProvider')(null, null, app);
	const fullName = getFullTableName(collection);
	const script = ddlProvider.dropTable(fullName);
	return AlterScriptDto.getInstance([script], true, true);
};

/**
 * @return {(collection: AlterCollectionDto) => AlterScriptDto[]}
 * */
const getModifyCollectionScriptDtos =
	({ dbVersion }) =>
	collection => {
		const modifyCheckConstraintScriptDtos = getModifyCheckConstraintScriptDtos(collection);
		const modifyCommentScriptDtos = getModifyEntityCommentsScriptDtos(collection);
		const modifyPKConstraintDtos = getModifyPkConstraintsScriptDtos(collection);
		const modifyUniqueKeyConstraintDtos = getModifyUniqueKeyConstraintsScriptDtos({
			collection,
			dbVersion,
		});
		const modifyIndexesScriptDtos = getModifyIndexesScriptDtos({ collection, dbVersion });
		return [
			...modifyCheckConstraintScriptDtos,
			...modifyCommentScriptDtos,
			...modifyPKConstraintDtos,
			...modifyUniqueKeyConstraintDtos,
			...modifyIndexesScriptDtos,
		].filter(Boolean);
	};

/**
 * @return {(collection: Object, predicate: ([name: string, jsonSchema: Object]) => boolean) => AlterScriptDto[]}
 * */
const getAddColumnsByConditionScriptDtos =
	({ app, dbVersion, modelDefinitions, internalDefinitions, externalDefinitions }) =>
	(collection, predicate) => {
		const { createColumnDefinitionBySchema } = require('./createColumnDefinition')(app);
		const ddlProvider = require('../../ddlProvider/ddlProvider')(null, null, app);
		const { getDefinitionByReference } = app.require('@hackolade/ddl-fe-utils');

		const collectionSchema = { ...collection, ...(_.omit(collection?.role, 'properties') || {}) };
		const tableName = getEntityName(collectionSchema);
		const schemaName = collectionSchema.compMod?.keyspaceName;
		const fullName = getNamePrefixedWithSchemaName(tableName, schemaName);
		const schemaData = { schemaName, dbVersion };

		const scripts = _.toPairs(collection.properties)
			.filter(([name, jsonSchema]) => predicate([name, jsonSchema]))
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
			.map(columnDefinition => ddlProvider.addColumn(fullName, columnDefinition))
			.map(addColumnScript => AlterScriptDto.getInstance([addColumnScript], true, false));

		const indexesOnNewlyCreatedColumns = getNewlyCreatedIndexesScripts({ dbVersion, collection });
		return scripts.concat(indexesOnNewlyCreatedColumns).filter(Boolean);
	};

/**
 *
 * @return {AlterScriptDto[]}
 * */
const getNewlyCreatedIndexesScripts = ({ dbVersion, collection }) => {
	const newIndexes = collection?.role?.Indxs || [];
	const properties = { ...collection?.properties, ...collection?.role?.properties };
	const propertiesIds = Object.values(properties).map(({ GUID }) => GUID);

	if (newIndexes.length === 0 || propertiesIds.length === 0) {
		return [];
	}

	const doAnyIndexUseNewlyCreatedColumn = newIndexes.some(({ columns = [] }) =>
		columns.find(({ keyId }) => propertiesIds.includes(keyId)),
	);

	if (!doAnyIndexUseNewlyCreatedColumn) {
		return [];
	}

	const additionalDataForDdlProvider = getAdditionalDataForDdlProvider({ dbVersion, collection });

	return getAddedIndexesScriptDtos({
		collection,
		additionalDataForDdlProvider,
	});
};

/**
 * @return {(collection: Object) => AlterScriptDto[]}
 * */
const getAddColumnScriptDtos =
	({ app, dbVersion, modelDefinitions, internalDefinitions, externalDefinitions }) =>
	collection => {
		return getAddColumnsByConditionScriptDtos({
			app,
			dbVersion,
			modelDefinitions,
			internalDefinitions,
			externalDefinitions,
		})(collection, ([name, jsonSchema]) => !jsonSchema.compMod);
	};

/**
 * @return {(collection: Object, predicate: ([name: string, jsonSchema: Object]) => boolean) => AlterScriptDto[]}
 * */
const getDeleteColumnsByConditionScriptDtos = app => (collection, predicate) => {
	const ddlProvider = require('../../ddlProvider/ddlProvider')(null, null, app);
	const collectionSchema = { ...collection, ...(_.omit(collection?.role, 'properties') || {}) };
	const tableName = getEntityName(collectionSchema);
	const schemaName = collectionSchema.compMod?.keyspaceName;
	const fullTableName = getNamePrefixedWithSchemaName(tableName, schemaName);

	return _.toPairs(collection.properties)
		.filter(([name, jsonSchema]) => predicate([name, jsonSchema]))
		.map(([name]) => {
			const columnNameForDDL = wrapInQuotes(name);
			return ddlProvider.dropColumn(fullTableName, columnNameForDDL);
		})
		.map(dropColumnScript => AlterScriptDto.getInstance([dropColumnScript], true, true))
		.filter(Boolean);
};

/**
 * @return {(collection: Object) => AlterScriptDto[]}
 * */
const getDeleteColumnScriptDtos = app => collection => {
	return getDeleteColumnsByConditionScriptDtos(app)(collection, ([name, jsonSchema]) => !jsonSchema.compMod);
};

/**
 * @return {(collection: Object) => Array<AlterScriptDto>}
 * */
const getDropAndRecreateColumnsScriptDtos =
	({ app, dbVersion, modelDefinitions, internalDefinitions, externalDefinitions }) =>
	collection => {
		return _.toPairs(collection.properties)
			.filter(([name, jsonSchema]) => {
				const oldName = jsonSchema.compMod.oldField.name;
				const oldProperty = collection.role.properties[oldName];

				const didGeneratedColumnChange =
					oldProperty.generatedColumn !== jsonSchema.generatedColumn ||
					oldProperty.columnGenerationExpression !== jsonSchema.columnGenerationExpression;
				// all conditions that require drop-and-recreate go here
				return didGeneratedColumnChange;
			})
			.flatMap(([name, jsonSchema]) => {
				const collectionWithJustThisProperty = {
					...collection,
					properties: _.fromPairs([[name, jsonSchema]]),
				};
				const deleteColumnsScriptDtos = getDeleteColumnsByConditionScriptDtos(app)(
					collectionWithJustThisProperty,
					() => true,
				);
				const addColumnsScriptDtos = getAddColumnsByConditionScriptDtos({
					app,
					dbVersion,
					modelDefinitions,
					internalDefinitions,
					externalDefinitions,
				})(collectionWithJustThisProperty, () => true);

				return [...deleteColumnsScriptDtos, ...addColumnsScriptDtos];
			})
			.filter(Boolean);
	};

/**
 * @return {(collection: Object) => AlterScriptDto[]}
 * */
const getModifyColumnScriptDtos =
	({ app, dbVersion, modelDefinitions, internalDefinitions, externalDefinitions }) =>
	collection => {
		const renameColumnScriptDtos = getRenameColumnScriptDtos(collection);

		const dropAndRecreateScriptDtos = getDropAndRecreateColumnsScriptDtos({
			app,
			dbVersion,
			modelDefinitions,
			internalDefinitions,
			externalDefinitions,
		})(collection);
		if (dropAndRecreateScriptDtos.length) {
			return [...renameColumnScriptDtos, ...dropAndRecreateScriptDtos].filter(Boolean);
		}

		const updateTypeScriptDtos = getUpdateTypesScriptDtos(collection);
		const modifyNotNullScriptDtos = getModifyNonNullColumnsScriptDtos(collection);
		const modifyCommentScriptDtos = getModifiedCommentOnColumnScriptDtos(collection);
		const modifyDefaultColumnValueScriptDtos = getModifiedDefaultColumnValueScriptDtos({
			collection,
		});

		return [
			...renameColumnScriptDtos,
			...updateTypeScriptDtos,
			...modifyNotNullScriptDtos,
			...modifyCommentScriptDtos,
			...modifyDefaultColumnValueScriptDtos,
		].filter(Boolean);
	};

module.exports = {
	getAddCollectionScriptDto,
	getDeleteCollectionScriptDto,
	getModifyCollectionScriptDtos,
	getAddColumnScriptDtos,
	getDeleteColumnScriptDtos,
	getModifyColumnScriptDtos,
};
