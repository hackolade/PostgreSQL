const defaultTypes = require('../configs/defaultTypes');
const descriptors = require('../configs/descriptors');
const templates = require('./templates');
const { Sequence } =require('../types/schemaSequenceTypes');


module.exports = (baseProvider, options, app) => {
	const _ = app.require('lodash');
	const {
		tab,
		commentIfDeactivated,
		checkAllKeysDeactivated,
		divideIntoActivatedAndDeactivated,
		hasType,
		wrap,
		clean,
		wrapComment,
		getFunctionArguments,
		wrapInQuotes,
		getNamePrefixedWithSchemaName,
		getColumnsList,
		getViewData,
	} = require('../utils/general')(_);
	const assignTemplates = require('../utils/assignTemplates');

	const {
		generateConstraintsString,
		foreignKeysToString,
		foreignActiveKeysToString,
		createKeyConstraint,
		getConstraintsWarnings,
		additionalPropertiesForForeignKey,
	} = require('./ddlHelpers/constraintsHelper')({
		_,
		commentIfDeactivated,
		checkAllKeysDeactivated,
		assignTemplates,
		getColumnsList,
		wrapInQuotes,
	});
	const keyHelper = require('./ddlHelpers/keyHelper')(_, clean);

	const { getFunctionsScript } = require('./ddlHelpers/functionHelper')({
		_,
		templates,
		assignTemplates,
		getFunctionArguments,
		getNamePrefixedWithSchemaName,
		wrapComment,
	});

	const { getProceduresScript } = require('./ddlHelpers/procedureHelper')({
		_,
		templates,
		assignTemplates,
		getFunctionArguments,
		getNamePrefixedWithSchemaName,
	});

	const { getSequencesScript, createSequenceScript, dropSequenceScript, alterSequenceScript } = require('./ddlHelpers/sequenceHelper')({
		_,
		templates,
		assignTemplates,
		getNamePrefixedWithSchemaName,
		wrapInQuotes,
	});

	const { getTableTemporaryValue, getTableOptions } = require('./ddlHelpers/tableHelper')({
		_,
		checkAllKeysDeactivated,
		getColumnsList,
	});

	const { getUserDefinedType, isNotPlainType } = require('./ddlHelpers/udtHelper')({
		_,
		commentIfDeactivated,
		assignTemplates,
		templates,
		getNamePrefixedWithSchemaName,
		wrapComment,
	});

	const { getIndexKeys, getIndexOptions } = require('./ddlHelpers/indexHelper')({
		_,
		wrapInQuotes,
		checkAllKeysDeactivated,
		getColumnsList,
	});

	const { decorateType, decorateDefault, getColumnComments, replaceTypeByVersion } =
		require('./ddlHelpers/columnDefinitionHelper')({
			_,
			wrap,
			assignTemplates,
			templates,
			commentIfDeactivated,
			wrapInQuotes,
			wrapComment,
		});

	const { getTriggersScript, hydrateTriggers } = require('./ddlHelpers/triggerHelper')({
		_,
		wrap,
		assignTemplates,
		templates,
		getNamePrefixedWithSchemaName,
		commentIfDeactivated,
	});

	const { getLocaleProperties } = require('./ddlHelpers/databaseHelper')();

	return {
		createDatabase(modelData) {
			if (!modelData.databaseName) {
				return '';
			}

			const { locale, collate, characterClassification } = getLocaleProperties(modelData);

			return assignTemplates(templates.createDatabase, {
				name: wrapInQuotes(modelData.databaseName),
				template: modelData.template ? `\n\tTEMPLATE ${modelData.template}` : '',
				encoding: modelData.encoding ? `\n\tENCODING ${modelData.encoding}` : '',
				locale: locale ? `\n\tLOCALE '${modelData.locale}'` : '',
				collate: collate ? `\n\tLC_COLLATE '${modelData.collate}'` : '',
				characterClassification: characterClassification ? `\n\tLC_CTYPE '${characterClassification}'` : '',
				tablespace: modelData.tablespace ? `\n\tTABLESPACE '${modelData.tablespace}'` : '',
			});
		},

		createSchema({ schemaName, ifNotExist, comments, udfs, procedures, sequences }) {
			const comment = assignTemplates(templates.comment, {
				object: 'SCHEMA',
				objectName: wrapInQuotes(schemaName),
				comment: wrapComment(comments),
			});

			const schemaStatement = assignTemplates(templates.createSchema, {
				name: wrapInQuotes(schemaName),
				ifNotExist: ifNotExist ? ' IF NOT EXISTS' : '',
				comment: comments ? comment : '',
			});

			const createFunctionStatement = getFunctionsScript(schemaName, udfs);
			const createProceduresStatement = getProceduresScript(schemaName, procedures);

			return _.chain([schemaStatement, createFunctionStatement, createProceduresStatement])
				.compact()
				.map(_.trim)
				.join('\n\n')
				.trim()
				.value();
		},

		createTable(
			{
				name,
				columns,
				checkConstraints,
				foreignKeyConstraints,
				schemaData,
				columnDefinitions,
				keyConstraints,
				inherits,
				description,
				ifNotExist,
				usingMethod,
				on_commit,
				partitioning,
				storage_parameter,
				table_tablespace_name,
				temporary,
				unlogged,
				selectStatement,
				triggers,
				partitionOf,
				partitionBounds,
			},
			isActivated,
		) {
			const ifNotExistStr = ifNotExist ? ' IF NOT EXISTS' : '';
			const tableName = getNamePrefixedWithSchemaName(name, schemaData.schemaName);
			const comment = assignTemplates(templates.comment, {
				object: 'TABLE',
				objectName: tableName,
				comment: wrapComment(description),
			});

			const dividedKeysConstraints = divideIntoActivatedAndDeactivated(
				keyConstraints
					.filter(({ errorMessage }) => !errorMessage)
					.map(createKeyConstraint(templates, isActivated)),
				key => key.statement,
			);
			const constraintWarnings = getConstraintsWarnings(
				keyConstraints.filter(({ errorMessage }) => errorMessage),
			);
			const keyConstraintsString = `${generateConstraintsString(
				dividedKeysConstraints,
				isActivated,
			)}${constraintWarnings}`;
			const keyConstraintsValue = partitionOf ? keyConstraintsString?.slice(1) : keyConstraintsString;

			const dividedForeignKeys = divideIntoActivatedAndDeactivated(foreignKeyConstraints, key => key.statement);
			const foreignKeyConstraintsString = generateConstraintsString(dividedForeignKeys, isActivated);

			const columnDescriptions = '\n' + getColumnComments(tableName, columnDefinitions);
			const template = partitionOf ? templates.createTablePartitionOf : templates.createTable;

			const checkConstraintPrefix = partitionOf && !keyConstraintsString ? '\n\t' : ',\n\t';
			const checkConstraintsValue = !_.isEmpty(checkConstraints)
				? wrap(_.join(checkConstraints, ',\n\t'), checkConstraintPrefix, '')
				: '';

			const isEmptyPartitionBody =
				partitionOf && !keyConstraintsValue && !checkConstraintsValue && !foreignKeyConstraintsString;
			const openParenthesis = isEmptyPartitionBody ? '' : '(';
			const closeParenthesis = isEmptyPartitionBody ? '' : ')';

			const tableStatement = assignTemplates(template, {
				temporary: getTableTemporaryValue(temporary, unlogged),
				ifNotExist: ifNotExistStr,
				name: tableName,
				columnDefinitions: !partitionOf ? '\t' + _.join(columns, ',\n\t') : '',
				keyConstraints: keyConstraintsValue,
				checkConstraints: checkConstraintsValue,
				foreignKeyConstraints: foreignKeyConstraintsString,
				options: getTableOptions({
					inherits,
					partitioning,
					usingMethod,
					on_commit,
					storage_parameter,
					table_tablespace_name,
					selectStatement,
					partitionBounds,
				}),
				comment: description ? comment : '',
				partitionOf: partitionOf ? ` PARTITION OF ${partitionOf} ` : '',
				columnDescriptions,
				openParenthesis,
				closeParenthesis,
			});

			const createTriggerStatements = getTriggersScript({
				dbVersion: schemaData.dbVersion,
				tableName,
				triggers,
			});

			return commentIfDeactivated(
				[tableStatement, createTriggerStatements].map(_.trim).join('\n\n').trim() + '\n',
				{ isActivated },
			);
		},

		convertColumnDefinition(columnDefinition) {
			const type = replaceTypeByVersion(columnDefinition.type, columnDefinition.dbVersion);
			const notNull = columnDefinition.nullable ? '' : ' NOT NULL';
			const primaryKey = columnDefinition.primaryKey
				? ' ' + createKeyConstraint(templates, true)(columnDefinition.primaryKeyOptions).statement
				: '';
			const uniqueKey = columnDefinition.unique
				? ' ' + createKeyConstraint(templates, true)(columnDefinition.uniqueKeyOptions).statement
				: '';
			const collation = columnDefinition.collationRule ? ` COLLATE "${columnDefinition.collationRule}"` : '';
			const isArrayType = Array.isArray(columnDefinition.array_type) && columnDefinition.array_type.length > 0;
			const defaultValue = !_.isUndefined(columnDefinition.default)
				? ' DEFAULT ' + decorateDefault(type, columnDefinition.default, isArrayType)
				: '';
			const generatedColumnClause = columnDefinition.dbVersion >= 12 && columnDefinition.generatedColumn && columnDefinition.columnGenerationExpression
				? assignTemplates(templates.generatedColumnClause, {
					generationExpression: columnDefinition.columnGenerationExpression,
				})
				: '';

			return commentIfDeactivated(
				assignTemplates(templates.columnDefinition, {
					name: wrapInQuotes(columnDefinition.name),
					type: decorateType(type, columnDefinition),
					generatedColumnClause,
					notNull,
					primaryKey,
					uniqueKey,
					collation,
					defaultValue,
				}),
				{
					isActivated: columnDefinition.isActivated,
				},
			);
		},

		createIndex(tableName, index, dbData, isParentActivated = true) {
			const isUnique = index.unique && index.index_method === 'btree';
			const name = wrapInQuotes(index.indxName);
			const unique = isUnique ? ' UNIQUE' : '';
			const concurrently = index.concurrently ? ' CONCURRENTLY' : '';
			const ifNotExist = index.ifNotExist ? ' IF NOT EXISTS' : '';
			const only = index.only ? ' ONLY' : '';
			const using = index.index_method ? ` USING ${_.toUpper(index.index_method)}` : '';
			const { getDbVersion } = require('../utils/general')(_);
			const dbVersion = getDbVersion(_.get(dbData, 'dbVersion', ''));
			const nullsDistinct = isUnique && index.nullsDistinct && dbVersion >= 15 ? `\n ${index.nullsDistinct}` : '';

			const keys = getIndexKeys(
				index.index_method === 'btree'
					? index.columns
					: _.map(index.columns, column => _.omit(column, 'sortOrder', 'nullsOrder')),
				isParentActivated,
			);
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
		},

		createCheckConstraint(checkConstraint) {
			return assignTemplates(templates.checkConstraint, {
				name: checkConstraint.name ? `CONSTRAINT ${wrapInQuotes(checkConstraint.name)}` : '',
				expression: _.trim(checkConstraint.expression).replace(/^\(([\s\S]*)\)$/, '$1'),
				noInherit: checkConstraint.noInherit ? ' NO INHERIT' : '',
			});
		},

		/**
		 * @param name {string}
		 * @param isActivated {boolean}
		 * @param customProperties {{
		 *     relationshipOnDelete?: string,
		 *     relationshipOnUpdate?: string,
		 *     relationshipMatch?: string,
		 *     deferrable?: "" | "DEFERRABLE" | "NOT DEFERRABLE",
		 *     deferrableConstraintCheckTime?: "" | "INITIALLY IMMEDIATE" | "INITIALLY DEFERRED",
		 * }}
		 * @param primaryTableActivated {boolean}
		 * @param foreignTableActivated {boolean}
		 * @param foreignSchemaName {string}
		 * @param primarySchemaName {string}
		 * @param primaryTable {string}
		 * @param primaryKey {Array<{
		 *     isActivated: boolean,
		 *     name: string,
		 * }>}
		 * @param foreignKey {Array<{
		 *     isActivated: boolean,
		 *     name: string,
		 * }>}
		 * @param schemaData {{
		 *     schemaName: string
		 * }}
		 * @param dbData {any}
		 * @return {{
		 *     statement: string,
		 *     isActivated: boolean,
		 * }}
		 * */
		createForeignKeyConstraint(
			{
				name,
				foreignKey,
				primaryTable,
				primaryKey,
				primaryTableActivated,
				foreignTableActivated,
				foreignSchemaName,
				primarySchemaName,
				customProperties,
				isActivated
			},
			dbData,
			schemaData,
		) {
			const isAllPrimaryKeysDeactivated = checkAllKeysDeactivated(primaryKey);
			const isAllForeignKeysDeactivated = checkAllKeysDeactivated(foreignKey);
			const areKeysActivated =
				!isAllPrimaryKeysDeactivated &&
				!isAllForeignKeysDeactivated &&
				primaryTableActivated &&
				foreignTableActivated;

			const { foreignOnDelete, foreignOnUpdate, foreignMatch, deferrable, deferrableConstraintCheckTime } =
				additionalPropertiesForForeignKey(customProperties);

			const foreignKeyStatement = assignTemplates(templates.createForeignKeyConstraint, {
				primaryTable: getNamePrefixedWithSchemaName(primaryTable, primarySchemaName || schemaData.schemaName),
				name: name ? `CONSTRAINT ${wrapInQuotes(name)}` : '',
				foreignKey: areKeysActivated ? foreignKeysToString(foreignKey) : foreignActiveKeysToString(foreignKey),
				primaryKey: areKeysActivated ? foreignKeysToString(primaryKey) : foreignActiveKeysToString(primaryKey),
				onDelete: foreignOnDelete ? ` ON DELETE ${foreignOnDelete}` : '',
				onUpdate: foreignOnUpdate ? ` ON UPDATE ${foreignOnUpdate}` : '',
				match: foreignMatch ? ` MATCH ${foreignMatch}` : '',
				deferrable: deferrable ? ` ${deferrable}` : '',
				deferrableConstraintCheckTime: deferrable === 'DEFERRABLE' && deferrableConstraintCheckTime
					? ` ${deferrableConstraintCheckTime}` : '',
			});

			return {
				statement: _.trim(foreignKeyStatement),
				isActivated: areKeysActivated && isActivated,
			};
		},

		/**
		 * @param name {string}
		 * @param isActivated {boolean}
		 * @param customProperties {{
		 *     relationshipOnDelete?: string,
		 *     relationshipOnUpdate?: string,
		 *     relationshipMatch?: string,
		 * }}
		 * @param primaryTableActivated {boolean}
		 * @param foreignTableActivated {boolean}
		 * @param foreignSchemaName {string}
		 * @param foreignTable {string}
		 * @param primarySchemaName {string}
		 * @param primaryTable {string}
		 * @param primaryKey {Array<{
		 *     isActivated: boolean,
		 *     name: string,
		 * }>}
		 * @param foreignKey {Array<{
		 *     isActivated: boolean,
		 *     name: string,
		 * }>}
		 * @param schemaData {{
		 *     schemaName: string
		 * }}
		 * @param dbData {any}
		 * @return {{
		 *     statement: string,
		 *     isActivated: boolean,
		 * }}
		 * */
		createForeignKey(
			{
				name,
				foreignTable,
				foreignKey,
				primaryTable,
				primaryKey,
				primaryTableActivated,
				foreignTableActivated,
				foreignSchemaName,
				primarySchemaName,
				customProperties,
				isActivated
			},
			dbData,
			schemaData,
		) {
			const isAllPrimaryKeysDeactivated = checkAllKeysDeactivated(primaryKey);
			const isAllForeignKeysDeactivated = checkAllKeysDeactivated(foreignKey);
			const areKeysActivated =
				!isAllPrimaryKeysDeactivated &&
				!isAllForeignKeysDeactivated &&
				primaryTableActivated &&
				foreignTableActivated;

			const { foreignOnDelete, foreignOnUpdate, foreignMatch, deferrable, deferrableConstraintCheckTime } =
				additionalPropertiesForForeignKey(customProperties);

			const foreignKeyStatement = assignTemplates(templates.createForeignKey, {
				primaryTable: getNamePrefixedWithSchemaName(primaryTable, primarySchemaName || schemaData.schemaName),
				foreignTable: getNamePrefixedWithSchemaName(foreignTable, foreignSchemaName || schemaData.schemaName),
				name: name ? wrapInQuotes(name) : '',
				foreignKey: areKeysActivated ? foreignKeysToString(foreignKey) : foreignActiveKeysToString(foreignKey),
				primaryKey: areKeysActivated ? foreignKeysToString(primaryKey) : foreignActiveKeysToString(primaryKey),
				onDelete: foreignOnDelete ? ` ON DELETE ${foreignOnDelete}` : '',
				onUpdate: foreignOnUpdate ? ` ON UPDATE ${foreignOnUpdate}` : '',
				match: foreignMatch ? ` MATCH ${foreignMatch}` : '',
				deferrable: deferrable ? ` ${deferrable}` : '',
				deferrableConstraintCheckTime: deferrable === 'DEFERRABLE' && deferrableConstraintCheckTime
					? ` ${deferrableConstraintCheckTime}` : '',
			});

			return {
				statement: _.trim(foreignKeyStatement),
				isActivated: areKeysActivated && isActivated,
			};
		},

		createView(viewData, dbData, isActivated) {
			const viewName = getNamePrefixedWithSchemaName(viewData.name, viewData.schemaName);

			const comment = assignTemplates(templates.comment, {
				object: 'VIEW',
				objectName: viewName,
				comment: wrapComment(viewData.comment),
			});

			const allDeactivated = checkAllKeysDeactivated(viewData.keys || []);
			const deactivatedWholeStatement = allDeactivated || !isActivated;
			const { columns, tables } = getViewData(viewData.keys);
			let columnsAsString = columns.map(column => column.statement).join(',\n\t\t');

			if (!deactivatedWholeStatement) {
				const dividedColumns = divideIntoActivatedAndDeactivated(columns, column => column.statement);
				const deactivatedColumnsString = dividedColumns.deactivatedItems.length
					? commentIfDeactivated(dividedColumns.deactivatedItems.join(',\n\t\t'), {
							isActivated: false,
							isPartOfLine: true,
					  })
					: '';
				columnsAsString = dividedColumns.activatedItems.join(',\n\t\t') + deactivatedColumnsString;
			}

			const selectStatement = _.trim(viewData.selectStatement)
				? _.trim(tab(viewData.selectStatement))
				: assignTemplates(templates.viewSelectStatement, {
						tableName: tables.join(', '),
						keys: columnsAsString,
				  });

			const check_option = viewData.viewOptions?.check_option
				? `check_option=${viewData.viewOptions?.check_option}`
				: '';
			const security_barrier = viewData.viewOptions?.security_barrier ? `security_barrier` : '';
			const dbVersionWhereSecurityInvokerAppeared = 15;
			const { getDbVersion } = require('../utils/general')(_);
			const security_invoker =
				viewData.viewOptions?.security_invoker &&
				getDbVersion(dbData.dbVersion) >= dbVersionWhereSecurityInvokerAppeared
					? 'security_invoker'
					: '';
			const withOptions =
				check_option || security_barrier || security_invoker
					? `\n\tWITH (${_.compact([check_option, security_barrier, security_invoker]).join(',')})`
					: '';

			const getCheckOption = viewData => {
				if (viewData.withCheckOption && viewData.checkTestingScope) {
					return `\n\tWITH ${viewData.checkTestingScope} CHECK OPTION`;
				} else if (viewData.withCheckOption) {
					return '\n\tWITH CHECK OPTION';
				} else {
					return '';
				}
			};

			const createViewScript = commentIfDeactivated(
				assignTemplates(templates.createView, {
					name: viewName,
					orReplace: viewData.orReplace ? ' OR REPLACE' : '',
					temporary: viewData.temporary ? ' TEMPORARY' : '',
					checkOption: getCheckOption(viewData),
					comment: viewData.comment ? comment : '',
					withOptions,
					selectStatement,
				}),
				{ isActivated: !deactivatedWholeStatement },
			);

			const createTriggersStatements = getTriggersScript({
				dbVersion: viewData.dbVersion,
				tableName: viewName,
				triggers: viewData.triggers,
			});

			return [createViewScript, createTriggersStatements].map(_.trim).join('\n\n').trim() + '\n';
		},

		/**
		 * @param viewName {string}
		 * @return string
		 * */
		dropView(viewName) {
			const templatesConfig = {
				viewName,
			}
			return assignTemplates(templates.dropView, templatesConfig);
		},

		createViewIndex() {
			return '';
		},

		createUdt(udt) {
			const columns = _.map(udt.properties, this.convertColumnDefinition);

			return getUserDefinedType(udt, columns);
		},

		getDefaultType(type) {
			return defaultTypes[type];
		},

		getTypesDescriptors() {
			return descriptors;
		},

		hasType(type) {
			return hasType(descriptors, type);
		},

		hydrateDatabase({ modelData }) {
			modelData = _.get(modelData, '0', {});

			return {
				databaseName: modelData.database_name,
				tablespace: modelData.tablespace_name,
				encoding: modelData.encoding,
				template: modelData.template,
				collate: modelData.LC_COLLATE,
				characterClassification: modelData.LC_CTYPE,
				dbVersion: modelData.dbVersion,
				locale: modelData.locale,
			};
		},

		hydrateColumn({ columnDefinition, jsonSchema, schemaData, definitionJsonSchema = {}, parentJsonSchema }) {
			const collationRule = _.includes(['char', 'varchar', 'text'], columnDefinition.type)
				? jsonSchema.collationRule
				: '';
			const timeTypes = ['time', 'timestamp'];
			const timePrecision = _.includes(timeTypes, columnDefinition.type) ? jsonSchema.timePrecision : '';
			const timezone = _.includes(timeTypes, columnDefinition.type) ? jsonSchema.timezone : '';
			const intervalOptions = columnDefinition.type === 'interval' ? jsonSchema.intervalOptions : '';
			const { getDbVersion } = require('../utils/general')(_);
			const dbVersion = getDbVersion(schemaData.dbVersion)
			const primaryKeyOptions = _.omit(
				keyHelper.hydratePrimaryKeyOptions(
					_.first(jsonSchema.primaryKeyOptions) || {},
					columnDefinition.name,
					columnDefinition.isActivated,
					parentJsonSchema,
				),
				'columns',
			);
			const uniqueKeyOptions = _.omit(
				keyHelper.hydrateUniqueOptions({
					options: _.first(jsonSchema.uniqueKeyOptions) || {},
					columnName: columnDefinition.name,
					isActivated: columnDefinition.isActivated,
					jsonSchema: parentJsonSchema,
					dbVersion,
				}),
				'columns',
			);

			return {
				name: columnDefinition.name,
				type: columnDefinition.type,
				primaryKey: keyHelper.isInlinePrimaryKey(jsonSchema),
				primaryKeyOptions,
				unique: keyHelper.isInlineUnique(jsonSchema),
				uniqueKeyOptions,
				nullable: columnDefinition.nullable,
				default: columnDefinition.default,
				comment: jsonSchema.refDescription || jsonSchema.description || definitionJsonSchema.description,
				isActivated: columnDefinition.isActivated,
				scale: columnDefinition.scale,
				precision: columnDefinition.precision,
				length: columnDefinition.length,
				enum: jsonSchema.enum,
				array_type: jsonSchema.array_type,
				unit: jsonSchema.unit,
				rangeSubtype: jsonSchema.rangeSubtype,
				operatorClass: jsonSchema.operatorClass,
				collation: jsonSchema.collation,
				canonicalFunction: jsonSchema.canonicalFunction,
				subtypeDiffFunction: jsonSchema.subtypeDiffFunction,
				multiRangeType: jsonSchema.multiRangeType,
				schemaName: schemaData.schemaName,
				underlyingType: jsonSchema.underlyingType,
				checkConstraints: jsonSchema.checkConstraints,
				typeModifier: jsonSchema.typeModifier,
				srid: jsonSchema.srid,
				collationRule,
				timePrecision,
				timezone,
				intervalOptions,
				dbVersion,
				generatedColumn: Boolean(jsonSchema.generatedColumn),
				columnGenerationExpression: jsonSchema.columnGenerationExpression,
			};
		},

		hydrateJsonSchemaColumn(jsonSchema, definitionJsonSchema) {
			if (!jsonSchema.$ref || _.isEmpty(definitionJsonSchema) || isNotPlainType(definitionJsonSchema)) {
				return jsonSchema;
			}

			jsonSchema = _.omit(jsonSchema, '$ref');
			return { ...definitionJsonSchema, ...jsonSchema };
		},

		hydrateIndex(indexData, tableData, schemaData) {
			return { ...indexData, schemaName: schemaData.schemaName };
		},

		hydrateViewIndex(indexData) {
			return {};
		},

		hydrateCheckConstraint(checkConstraint) {
			return {
				name: checkConstraint.chkConstrName,
				expression: checkConstraint.constrExpression,
				noInherit: checkConstraint.noInherit,
			};
		},

		hydrateSchema(containerData, data) {
			const dbVersion = _.get(data, 'modelData.0.dbVersion');

			return {
				schemaName: containerData.name,
				ifNotExist: containerData.ifNotExist,
				comments: containerData.description,
				udfs: data?.udfs || [],
				procedures: data?.procedures || [],
				sequences: data?.sequences || [],
				dbVersion,
			};
		},

		hydrateTable({ tableData, entityData, jsonSchema }) {
			const detailsTab = entityData[0];
			const parentTables = _.chain(detailsTab.inherits)
				.map(({ parentTable }) => _.get(tableData, `relatedSchemas[${parentTable}]`, ''))
				.compact()
				.map(table => table.code || table.collectionName)
				.join(', ')
				.thru(value => (value ? `(${value})` : ''))
				.value();

			const partitioning = _.first(detailsTab.partitioning) || {};
			const compositePartitionKey = keyHelper.getKeys(partitioning.compositePartitionKey, jsonSchema);
			const partitionParent = _.get(tableData, `relatedSchemas[${detailsTab.partitionOf}]`);
			const partitionOf = partitionParent
				? getNamePrefixedWithSchemaName(partitionParent.collectionName, partitionParent.bucketName)
				: '';
			const triggers = hydrateTriggers(entityData, tableData.relatedSchemas);
			const { getDbVersion } = require('../utils/general')(_);
			const dbVersion = getDbVersion(_.get(tableData, 'dbData.dbVersion', ''));

			return {
				...tableData,
				triggers,
				partitionOf,
				keyConstraints: keyHelper.getTableKeyConstraints(jsonSchema, dbVersion),
				inherits: parentTables,
				selectStatement: _.trim(detailsTab.selectStatement),
				partitioning: _.assign({}, partitioning, { compositePartitionKey }),
				..._.pick(
					detailsTab,
					'temporary',
					'unlogged',
					'description',
					'ifNotExist',
					'usingMethod',
					'on_commit',
					'storage_parameter',
					'table_tablespace_name',
					'partitionBounds',
				),
			};
		},

		hydrateViewColumn(data) {
			return {
				name: data.name,
				tableName: data.entityName,
				alias: data.alias,
				isActivated: data.isActivated,
				dbName: data.dbName,
			};
		},

		hydrateView({ viewData, entityData, relatedSchemas }) {
			const detailsTab = entityData[0];
			const triggers = hydrateTriggers(entityData, relatedSchemas);

			return {
				name: viewData.name,
				keys: viewData.keys,
				comment: detailsTab.description,
				orReplace: detailsTab.orReplace,
				temporary: detailsTab.temporary,
				recursive: detailsTab.recursive,
				viewOptions: detailsTab.viewOptions,
				selectStatement: detailsTab.selectStatement,
				withCheckOption: detailsTab.withCheckOption,
				checkTestingScope: detailsTab.withCheckOption ? detailsTab.checkTestingScope : '',
				schemaName: viewData.schemaData.schemaName,
				triggers,
			};
		},

		commentIfDeactivated(statement, data, isPartOfLine) {
			return statement;
		},

		/**
		 * @param tableName {string}
		 * @param columnName {string}
		 * @param dataType {string}
		 * @param dataTypeProperties {{
		 *     length?: number,
		 *     scale?: number,
		 *     precision?: number
		 * }}
		 * @return string
		 * */
		alterColumnType(tableName, columnName, dataType, dataTypeProperties) {
			let dataTypeString = dataType;
			if (dataTypeProperties.length) {
				dataTypeString += `(${dataTypeProperties.length})`;
			} else if (dataTypeProperties.precision && dataTypeProperties.scale) {
				dataTypeString += `(${dataTypeProperties.precision},${dataTypeProperties.scale})`;
			} else if (dataTypeProperties.precision) {
				dataTypeString += `(${dataTypeProperties.precision})`;
			}

			return assignTemplates(templates.alterColumnType, {
				tableName,
				columnName,
				dataType: dataTypeString,
			})
		},

		/**
		 * @param tableName {string}
		 * @param columnName {string}
		 * @return string
		 * */
		setNotNullConstraint(tableName, columnName) {
			return assignTemplates(templates.addNotNullConstraint, {
				tableName,
				columnName
			});
		},

		/**
		 * @param tableName {string}
		 * @param columnName {string}
		 * @return string
		 * */
		dropNotNullConstraint(tableName, columnName) {
			return assignTemplates(templates.dropNotNullConstraint, {
				tableName,
				columnName
			});
		},

		/**
		 * @param tableName {string}
		 * @param oldColumnName {string}
		 * @param newColumnName {string}
		 * @return string
		 * */
		renameColumn(tableName, oldColumnName, newColumnName) {
			return assignTemplates(templates.renameColumn, {
				tableName,
				oldColumnName,
				newColumnName
			});
		},

		/**
		 * @param tableName {string}
		 * @param constraintName {string}
		 * @param expression {expression}
		 * @return string
		 * */
		addCheckConstraint(tableName, constraintName, expression) {
			const templateConfig = {
				tableName,
				constraintName,
				expression
			};
			return assignTemplates(templates.addCheckConstraint, templateConfig);
		},

		/**
		 * @param tableName {string}
		 * @param constraintName {string}
		 * @return string
		 * */
		dropConstraint(tableName, constraintName) {
			const templateConfig = {
				tableName,
				constraintName,
			};
			return assignTemplates(templates.dropConstraint, templateConfig);
		},

		/**
		 * @param tableName {string}
		 * @param comment {string}
		 * @return string
		 * */
		updateTableComment(tableName, comment) {
			const templateConfig = {
				tableName,
				comment
			}
			return assignTemplates(templates.updateCommentOnTable, templateConfig);
		},

		/**
		 * @param tableName {string}
		 * @return string
		 * */
		dropTableComment(tableName) {
			const templateConfig = {
				tableName,
				comment: 'NULL'
			}
			return assignTemplates(templates.updateCommentOnTable, templateConfig);
		},

		/**
		 * @param columnName {string}
		 * @param comment {string}
		 * @return string
		 * */
		updateColumnComment(columnName, comment) {
			const templateConfig = {
				columnName,
				comment
			}
			return assignTemplates(templates.updateCommentOnColumn, templateConfig);
		},

		/**
		 * @param columnName {string}
		 * @return string
		 * */
		dropColumnComment(columnName) {
			const templateConfig = {
				columnName,
				comment: 'NULL'
			}
			return assignTemplates(templates.updateCommentOnColumn, templateConfig);
		},

		/**
		 * @param schemaName {string}
		 * @param comment {string}
		 * @return string
		 * */
		updateSchemaComment(schemaName, comment) {
			const templateConfig = {
				schemaName,
				comment
			}
			return assignTemplates(templates.updateCommentOnSchema, templateConfig);
		},

		/**
		 * @param schemaName {string}
		 * @return string
		 * */
		dropSchemaComment(schemaName) {
			const templateConfig = {
				schemaName,
				comment: 'NULL'
			}
			return assignTemplates(templates.updateCommentOnSchema, templateConfig);
		},

		/**
		 * @param viewName {string}
		 * @param comment {string}
		 * @return string
		 * */
		updateViewComment(viewName, comment) {
			const templateConfig = {
				viewName,
				comment
			}
			return assignTemplates(templates.updateCommentOnView, templateConfig);
		},

		/**
		 * @param viewName {string}
		 * @return string
		 * */
		dropViewComment(viewName) {
			const templateConfig = {
				viewName,
				comment: 'NULL'
			}
			return assignTemplates(templates.updateCommentOnView, templateConfig);
		},

		/**
		 * @param schemaName {string}
		 * @return string
		 * */
		createSchemaOnly(schemaName) {
			const templateConfig = {
				schemaName,
			}
			return assignTemplates(templates.createSchemaOnly, templateConfig);
		},

		/**
		 * @param schemaName {string}
		 * @return string
		 * */
		dropSchema(schemaName) {
			const templateConfig = {
				schemaName,
			}
			return assignTemplates(templates.dropSchema, templateConfig);
		},

		/**
		 * @param tableName {string}
		 * @return string
		 * */
		dropTable(tableName) {
			const templateConfig = {
				tableName,
			}
			return assignTemplates(templates.dropTable, templateConfig);
		},

		/**
		 * @param tableName {string}
		 * @param columnDefinition {string}
		 * @return string
		 * */
		addColumn(tableName, columnDefinition) {
			const templateConfig = {
				tableName,
				columnDefinition,
			}
			return assignTemplates(templates.addColumn, templateConfig);
		},

		/**
		 * @param tableName {string}
		 * @param columnName {string}
		 * @return string
		 * */
		dropColumn(tableName, columnName) {
			const templateConfig = {
				tableName,
				columnName,
			}
			return assignTemplates(templates.dropColumn, templateConfig);
		},

		/**
		 * @param udtName {string}
		 * @return string
		 * */
		dropDomain(udtName,) {
			const templateConfig = {
				udtName,
			}
			return assignTemplates(templates.dropDomain, templateConfig);
		},

		/**
		 * @param udtName {string}
		 * @return string
		 * */
		dropType(udtName,) {
			const templateConfig = {
				udtName,
			}
			return assignTemplates(templates.dropType, templateConfig);
		},

		/**
		 * @param udtName {string}
		 * @param columnDefinition {string}
		 * @return string
		 * */
		alterTypeAddAttribute(udtName, columnDefinition) {
			const templateConfig = {
				udtName,
				columnDefinition,
			}
			return assignTemplates(templates.alterTypeAddAttribute, templateConfig);
		},

		/**
		 * @param udtName {string}
		 * @param attributeName {string}
		 * @return string
		 * */
		alterTypeDropAttribute(udtName, attributeName) {
			const templateConfig = {
				udtName,
				attributeName,
			}
			return assignTemplates(templates.alterTypeDropAttribute, templateConfig);
		},

		/**
		 * @param udtName {string}
		 * @param oldAttributeName {string}
		 * @param newAttributeName {string}
		 * @return string
		 * */
		alterTypeRenameAttribute(udtName, oldAttributeName, newAttributeName) {
			const templateConfig = {
				udtName,
				oldAttributeName,
				newAttributeName,
			}
			return assignTemplates(templates.alterTypeRenameAttribute, templateConfig);
		},

		/**
		 * @param udtName {string}
		 * @param attributeName {string}
		 * @param newDataType {string}
		 * @return string
		 * */
		alterTypeChangeAttributeType(udtName, attributeName, newDataType) {
			const templateConfig = {
				udtName,
				attributeName,
				newDataType,
			}
			return assignTemplates(templates.alterTypeChangeAttributeType, templateConfig);
		},

		/**
		 * @param tableName {string}
		 * @param fkConstraintName {string}
		 * @return string
		 * */
		dropForeignKey(tableName, fkConstraintName) {
			const templateConfig = {
				tableName,
				fkConstraintName,
			}
			return assignTemplates(templates.dropForeignKey, templateConfig);
		},

		/**
		 * @param tableName {string}
		 * @param isParentActivated {boolean}
		 * @param keyData {{
		 *         name: string,
		 *         keyType: string,
		 *         columns: Array<{
		 *      		isActivated: boolean,
		 *      		name: string,
		 *  	   }>,
		 *         include: Array<{
		 *              isActivated: boolean,
		 *              name: string,
		 *         }>,
		 *         storageParameters: string,
		 *         tablespace: string,
		 * }}
		 * @return {{
		 *     statement: string,
		 *     isActivated: boolean,
		 * }}
		 * */
		createKeyConstraint(tableName, isParentActivated, keyData) {
			const constraintStatementDto = createKeyConstraint(templates, isParentActivated)(keyData);
			return {
				statement: assignTemplates(templates.addPkConstraint, {
					constraintStatement: (constraintStatementDto.statement || '').trim(),
					tableName,
				}),
				isActivated: constraintStatementDto.isActivated,
			}
		},

		/**
		 * @param tableName {string}
		 * @param constraintName {string}
		 * */
		dropPkConstraint(tableName, constraintName) {
			const templatesConfig = {
				tableName,
				constraintName,
			}
			return assignTemplates(templates.dropConstraint, templatesConfig);
		},

		/**
		 * @param {{ schemaName: string, sequences: Sequence[] }} 
		 * @returns {string}
		 */
		createSchemaSequences({ schemaName, sequences }) {
			return getSequencesScript({ schemaName, sequences });
		},

		/**
		 * @param {{ schemaName: string, sequence: Sequence }} 
		 * @returns {string}
		 */
		createSchemaSequence({ schemaName, sequence }) {
			return createSequenceScript({ schemaName, sequence });
		},

		/**
		 * @param {{ schemaName: string, sequence: Sequence }} 
		 * @returns {string}
		 */
		dropSchemaSequence({ schemaName, sequence }) {
			return dropSequenceScript({ schemaName, sequence });
	},

	/**
	 * @param {{ schemaName: string, sequence: Sequence, oldSequence: Sequence }} 
	 * @returns {string}
	 */
	alterSchemaSequence({ schemaName, sequence, oldSequence }) {
		return alterSequenceScript({ schemaName, sequence, oldSequence });
	}
};
};
