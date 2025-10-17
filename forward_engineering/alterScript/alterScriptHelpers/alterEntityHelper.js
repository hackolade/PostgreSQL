const _ = require('lodash');
const { getModifyCheckConstraintScriptDtos } = require('./entityHelpers/checkConstraintHelper');
const { getModifyEntityCommentsScriptDtos } = require('./entityHelpers/commentsHelper');
const { getUpdateTypesScriptDtos } = require('./columnHelpers/alterTypeHelper');
const { getModifyNonNullColumnsScriptDtos } = require('./columnHelpers/nonNullConstraintHelper');
const { getModifiedCommentOnColumnScriptDtos } = require('./columnHelpers/commentsHelper');
const { getRenameColumnScriptDtos } = require('./columnHelpers/renameColumnHelper');
const { getModifyColumnCheckConstraintScriptDtos } = require('./columnHelpers/checkConstraintHelper');
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
const {
	getEntityName,
	getFullTableName,
	getNamePrefixedWithSchemaName,
	wrapInQuotes,
	isParentContainerActivated,
	isObjectInDeltaModelActivated,
} = require('../../utils/general');
const { getRelationshipName } = require('./alterRelationshipsHelper');

/**
 * @return {(collection: AlterCollectionDto) => AlterScriptDto | undefined}
 * */
const getAddCollectionScriptDto =
	({ app, dbVersion, modelDefinitions, internalDefinitions, externalDefinitions, inlineDeltaRelationships = [] }) =>
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
		const foreignKeyConstraints = inlineDeltaRelationships
			.filter(relationship => relationship.role.childCollection === collection.role.id)
			.map(relationship => {
				const compMod = relationship.role.compMod;
				const relationshipName =
					compMod.code?.new || compMod.name?.new || getRelationshipName(relationship) || '';
				return ddlProvider.createForeignKeyConstraint({
					name: relationshipName,
					foreignKey: compMod.child.collection.fkFields,
					primaryKey: compMod.parent.collection.fkFields,
					customProperties: compMod.customProperties?.new,
					foreignTable: compMod.child.collection.name,
					foreignSchemaName: compMod.child.bucket.name,
					foreignTableActivated: compMod.child.collection.isActivated,
					primaryTable: compMod.parent.collection.name,
					primarySchemaName: compMod.parent.bucket.name,
					primaryTableActivated: compMod.parent.collection.isActivated,
					isActivated: Boolean(relationship.role?.compMod?.isActivated?.new),
				});
			});
		const tableData = {
			name: getEntityName(jsonSchema),
			columns: columnDefinitions.map(def => ddlProvider.convertColumnDefinition(def)),
			checkConstraints: checkConstraints,
			foreignKeyConstraints,
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
		return [...modifyCheckConstraintScriptDtos, ...modifyCommentScriptDtos].filter(Boolean);
	};

/**
 * @return {(collection: AlterCollectionDto) => AlterScriptDto[]}
 * */
const getModifyCollectionKeysScriptDtos =
	({ dbVersion }) =>
	collection => {
		const modifyPKConstraintDtos = getModifyPkConstraintsScriptDtos(collection);
		const modifyUniqueKeyConstraintDtos = getModifyUniqueKeyConstraintsScriptDtos({
			collection,
			dbVersion,
		});
		const modifyIndexesScriptDtos = getModifyIndexesScriptDtos({ collection, dbVersion });
		return [...modifyPKConstraintDtos, ...modifyUniqueKeyConstraintDtos, ...modifyIndexesScriptDtos].filter(
			Boolean,
		);
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

		const isContainerActivated = isParentContainerActivated(collection);
		const isCollectionActivated = isObjectInDeltaModelActivated(collection);

		const scripts = _.toPairs(collection.properties)
			.filter(([name, jsonSchema]) => predicate([name, jsonSchema]))
			.map(([name, jsonSchema]) => {
				const definitionJsonSchema = getDefinitionByReference({
					propertySchema: jsonSchema,
					modelDefinitions,
					internalDefinitions,
					externalDefinitions,
				});

				const columnDefinition = createColumnDefinitionBySchema({
					name,
					jsonSchema,
					parentJsonSchema: collectionSchema,
					ddlProvider,
					schemaData,
					definitionJsonSchema,
				});
				const isActivated = isContainerActivated && isCollectionActivated && jsonSchema.isActivated;
				return { columnDefinition, isActivated };
			})
			.map(({ columnDefinition, isActivated }) => ({
				script: ddlProvider.addColumn(fullName, ddlProvider.convertColumnDefinition(columnDefinition)),
				isActivated,
			}))
			.map(({ script, isActivated }) => AlterScriptDto.getInstance([script], isActivated, false));

		return scripts.filter(Boolean);
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

	const isContainerActivated = isParentContainerActivated(collection);
	const isCollectionActivated = isObjectInDeltaModelActivated(collection);

	return _.toPairs(collection.properties)
		.filter(([name, jsonSchema]) => predicate([name, jsonSchema]))
		.map(([name, jsonSchema]) => {
			const columnNameForDDL = wrapInQuotes(name);
			const isActivated = isContainerActivated && isCollectionActivated && jsonSchema.isActivated;
			return { script: ddlProvider.dropColumn(fullTableName, columnNameForDDL), isActivated };
		})
		.map(({ script, isActivated }) => AlterScriptDto.getInstance([script], isActivated, true))
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
		const modifyColumnCheckConstraintScriptDtos = getModifyColumnCheckConstraintScriptDtos(collection);

		return [
			...renameColumnScriptDtos,
			...updateTypeScriptDtos,
			...modifyNotNullScriptDtos,
			...modifyDefaultColumnValueScriptDtos,
			...modifyColumnCheckConstraintScriptDtos,
			...modifyCommentScriptDtos,
		].filter(Boolean);
	};

module.exports = {
	getAddCollectionScriptDto,
	getDeleteCollectionScriptDto,
	getModifyCollectionScriptDtos,
	getAddColumnScriptDtos,
	getDeleteColumnScriptDtos,
	getModifyColumnScriptDtos,
	getModifyCollectionKeysScriptDtos,
};
