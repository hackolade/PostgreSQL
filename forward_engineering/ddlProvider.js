const defaultTypes = require('./configs/defaultTypes');
const types = require('./configs/types');
const templates = require('./configs/templates');

module.exports = (baseProvider, options, app) => {
	const {
		tab,
		commentIfDeactivated,
		checkAllKeysDeactivated,
		divideIntoActivatedAndDeactivated,
		hasType,
		wrap,
		clean,
	} = app.utils.general;
	const assignTemplates = app.utils.assignTemplates;
	const _ = app.require('lodash');
	const { decorateDefault, decorateType, canBeNational, getSign } = require('./helpers/columnDefinitionHelper')(_, wrap);
	const { getTableName, getTableOptions, getPartitions, getViewData, getCharacteristics } = require('./helpers/general')(_, wrap);
	const {
		generateConstraintsString,
		foreignKeysToString,
		foreignActiveKeysToString,
		createKeyConstraint,
	} = require('./helpers/constraintsHelper')({
		_,
		commentIfDeactivated,
		checkAllKeysDeactivated,
		divideIntoActivatedAndDeactivated,
		assignTemplates,
	});
	const keyHelper = require('./helpers/keyHelper')(_, clean);

	return {
		createDatabase({ databaseName, orReplace, ifNotExist, collation, characterSet, comments, udfs, procedures }) {
			let dbOptions = '';
			dbOptions += characterSet ? tab(`\nCHARACTER SET = '${characterSet}'`) : '';
			dbOptions += collation ? tab(`\nCOLLATE = '${collation}'`) : '';
			dbOptions += comments ? tab(`\nCOMMENT = '${comments}'`) : '';

			const databaseStatement = assignTemplates(templates.createDatabase, {
				name: databaseName,
				orReplace: orReplace && !ifNotExist ? ' OR REPLACE' : '',
				ifNotExist: ifNotExist ? ' IF NOT EXISTS' : '',
				dbOptions: dbOptions,
			});
			const udfStatements = udfs.map(udf => {
				const characteristics = getCharacteristics(udf.characteristics);
				let startDelimiter = udf.delimiter ? `DELIMITER ${udf.delimiter}\n` : '';
				let endDelimiter = udf.delimiter ? `DELIMITER ;\n` : '';

				return (
					startDelimiter +
					assignTemplates(templates.createFunction, {
						name: getTableName(udf.name, databaseName),
						orReplace: udf.orReplace ? 'OR REPLACE ' : '',
						ifNotExist: udf.ifNotExist ? 'IF NOT EXISTS ' : '',
						aggregate: udf.aggregate ? 'AGGREGATE ' : '',
						characteristics: characteristics.join('\n\t'),
						type: udf.type,
						parameters: udf.parameters,
						body: udf.body,
						delimiter: udf.delimiter || ';',
					}) +
					endDelimiter
				);
			});
			const procStatements = procedures.map(procedure => {
				const characteristics = getCharacteristics(procedure.characteristics);
				let startDelimiter = procedure.delimiter ? `DELIMITER ${procedure.delimiter}\n` : '';
				let endDelimiter = procedure.delimiter ? `DELIMITER ;\n` : '';

				return (
					startDelimiter +
					assignTemplates(templates.createProcedure, {
						name: getTableName(procedure.name, databaseName),
						orReplace: procedure.orReplace ? 'OR REPLACE ' : '',
						parameters: procedure.parameters,
						characteristics: characteristics.join('\n\t'),
						body: procedure.body,
						delimiter: procedure.delimiter || ';',
					}) +
					endDelimiter
				);
			});

			return [databaseStatement, ...udfStatements, ...procStatements].join('\n');
		},

		createTable(
			{
				name,
				columns,
				dbData,
				temporary,
				orReplace,
				ifNotExist,
				likeTableName,
				selectStatement,
				options,
				partitioning,
				checkConstraints,
				foreignKeyConstraints,
				keyConstraints,
			},
			isActivated,
		) {
			const tableName = getTableName(name, dbData.databaseName);
			const orReplaceTable = orReplace ? 'OR REPLACE ' : '';
			const temporaryTable = temporary ? 'TEMPORARY ' : '';
			const ifNotExistTable = ifNotExist ? 'IF NOT EXISTS ' : '';

			if (likeTableName) {
				return assignTemplates(templates.createLikeTable, {
					name: tableName,
					likeTableName: getTableName(likeTableName, dbData.databaseName),
					orReplace: orReplaceTable,
					temporary: temporaryTable,
					ifNotExist: ifNotExistTable,
				});
			}

			const dividedKeysConstraints = divideIntoActivatedAndDeactivated(
				keyConstraints.map(createKeyConstraint(templates, isActivated)),
				key => key.statement,
			);
			const keyConstraintsString = generateConstraintsString(dividedKeysConstraints, isActivated);

			const dividedForeignKeys = divideIntoActivatedAndDeactivated(foreignKeyConstraints, key => key.statement);
			const foreignKeyConstraintsString = generateConstraintsString(dividedForeignKeys, isActivated);

			const tableStatement = assignTemplates(templates.createTable, {
				name: tableName,
				column_definitions: columns.join(',\n\t'),
				selectStatement: selectStatement ? ` ${selectStatement}` : '',
				orReplace: orReplaceTable,
				temporary: temporaryTable,
				ifNotExist: ifNotExistTable,
				options: getTableOptions(options),
				partitions: getPartitions(partitioning),
				checkConstraints: checkConstraints.length ? ',\n\t' + checkConstraints.join(',\n\t') : '',
				foreignKeyConstraints: foreignKeyConstraintsString,
				keyConstraints: keyConstraintsString,
			});

			return tableStatement;
		},

		convertColumnDefinition(columnDefinition) {
			const type = _.toUpper(columnDefinition.type);
			const notNull = columnDefinition.nullable ? '' : ' NOT NULL';
			const primaryKey = columnDefinition.primaryKey ? ' PRIMARY KEY' : '';
			const unique = columnDefinition.unique ? ' UNIQUE' : '';
			const zeroFill = columnDefinition.zerofill ? ' ZEROFILL' : '';
			const autoIncrement = columnDefinition.autoIncrement ? ' AUTO_INCREMENT' : '';
			const invisible = columnDefinition.invisible ? ' INVISIBLE' : '';
			const national = columnDefinition.national && canBeNational(type) ? 'NATIONAL ' : '';
			const comment = columnDefinition.comment ? ` COMMENT='${columnDefinition.comment}'` : '';
			const charset = type !== 'JSON' && columnDefinition.charset ? ` CHARSET ${columnDefinition.charset}` : '';
			const collate = type !== 'JSON' && columnDefinition.charset && columnDefinition.collation ? ` COLLATE ${columnDefinition.collation}` : '';
			const defaultValue = !_.isUndefined(columnDefinition.default)
				? ' DEFAULT ' + decorateDefault(type, columnDefinition.default)
				: '';
			const compressed = columnDefinition.compressionMethod
				? ` COMPRESSED=${columnDefinition.compressionMethod}`
				: '';
			const signed = getSign(type, columnDefinition.signed);

			return commentIfDeactivated(
				assignTemplates(templates.columnDefinition, {
					name: columnDefinition.name,
					type: decorateType(type, columnDefinition),
					not_null: notNull,
					primary_key: primaryKey,
					unique_key: unique,
					default: defaultValue,
					autoIncrement,
					compressed,
					signed,
					zeroFill,
					invisible,
					comment,
					national,
					charset,
					collate,
				}),
				{
					isActivated: columnDefinition.isActivated,
				},
			);
		},

		createIndex(tableName, index, dbData, isParentActivated = true) {
			if (_.isEmpty(index.indxKey) || !index.indxName) {
				return '';
			}

			const allDeactivated = checkAllKeysDeactivated(index.indxKey || []);
			const wholeStatementCommented = index.isActivated === false || !isParentActivated || allDeactivated;
			const indexType = index.indexType ? `${_.toUpper(index.indexType)} ` : '';
			const ifNotExist = index.ifNotExist ? 'IF NOT EXISTS ' : '';
			const name = wrap(index.indxName || '', '`', '`');
			const table = getTableName(tableName, dbData.databaseName);
			const indexCategory = index.indexCategory ? ` USING ${index.indexCategory}` : '';
			let indexOptions = [];

			const dividedKeys = divideIntoActivatedAndDeactivated(
				index.indxKey || [],
				key => `\`${key.name}\`${key.type === 'DESC' ? ' DESC' : ''}`,
			);
			const commentedKeys = dividedKeys.deactivatedItems.length
				? commentIfDeactivated(dividedKeys.deactivatedItems.join(', '), {
						isActivated: wholeStatementCommented,
						isPartOfLine: true,
				  })
				: '';

			if (_.toLower(index.waitNoWait) === 'wait' && index.waitValue) {
				indexOptions.push(`WAIT ${index.waitValue}`);
			}

			if (_.toLower(index.waitNoWait) === 'nowait') {
				indexOptions.push(`NOWAIT`);
			}

			if (index.indexComment) {
				indexOptions.push(`COMMENT '${index.indexComment}'`);
			}

			if (index.indexLock) {
				indexOptions.push(`LOCK ${index.indexLock}`);
			} else if (index.indexAlgorithm) {
				indexOptions.push(`ALGORITHM ${index.indexAlgorithm}`);
			}

			const indexStatement = assignTemplates(templates.index, {
				keys:
					dividedKeys.activatedItems.join(', ') +
					(wholeStatementCommented && commentedKeys && dividedKeys.activatedItems.length
						? ', ' + commentedKeys
						: commentedKeys),
				indexOptions: indexOptions.length ? '\n\t' + indexOptions.join('\n\t') : '',
				name,
				table,
				indexType,
				ifNotExist,
				indexCategory,
			});

			if (wholeStatementCommented) {
				return commentIfDeactivated(indexStatement, { isActivated: false });
			} else {
				return indexStatement;
			}
		},

		createCheckConstraint(checkConstraint) {
			return assignTemplates(templates.checkConstraint, {
				name: checkConstraint.name ? `${wrap(checkConstraint.name, '`', '`')} ` : '',
				expression: _.trim(checkConstraint.expression).replace(/^\(([\s\S]*)\)$/, '$1'),
			});
		},

		createForeignKeyConstraint(
			{ name, foreignKey, primaryTable, primaryKey, primaryTableActivated, foreignTableActivated },
			dbData,
		) {
			const isAllPrimaryKeysDeactivated = checkAllKeysDeactivated(primaryKey);
			const isAllForeignKeysDeactivated = checkAllKeysDeactivated(foreignKey);
			const isActivated =
				!isAllPrimaryKeysDeactivated &&
				!isAllForeignKeysDeactivated &&
				primaryTableActivated &&
				foreignTableActivated;

			return {
				statement: assignTemplates(templates.createForeignKeyConstraint, {
					primaryTable: getTableName(primaryTable, dbData.databaseName),
					name,
					foreignKey: isActivated ? foreignKeysToString(foreignKey) : foreignActiveKeysToString(foreignKey),
					primaryKey: isActivated ? foreignKeysToString(primaryKey) : foreignActiveKeysToString(primaryKey),
				}),
				isActivated,
			};
		},

		createForeignKey(
			{ name, foreignTable, foreignKey, primaryTable, primaryKey, primaryTableActivated, foreignTableActivated },
			dbData,
		) {
			const isAllPrimaryKeysDeactivated = checkAllKeysDeactivated(primaryKey);
			const isAllForeignKeysDeactivated = checkAllKeysDeactivated(foreignKey);

			return {
				statement: assignTemplates(templates.createForeignKey, {
					primaryTable: getTableName(primaryTable, dbData.databaseName),
					foreignTable: getTableName(foreignTable, dbData.databaseName),
					name,
					foreignKey: foreignKeysToString(foreignKey),
					primaryKey: foreignKeysToString(primaryKey),
				}),
				isActivated:
					!isAllPrimaryKeysDeactivated &&
					!isAllForeignKeysDeactivated &&
					primaryTableActivated &&
					foreignTableActivated,
			};
		},

		createView(viewData, dbData, isActivated) {
			const allDeactivated = checkAllKeysDeactivated(viewData.keys || []);
			const deactivatedWholeStatement = allDeactivated || !isActivated;
			const { columns, tables } = getViewData(viewData.keys, dbData);
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

			const algorithm = viewData.algorithm && viewData.algorithm !== 'UNDEFINED' ? `ALGORITHM ${viewData.algorithm} ` : '';

			return commentIfDeactivated(
				assignTemplates(templates.createView, {
					name: getTableName(viewData.name, dbData.databaseName),
					orReplace: viewData.orReplace ? 'OR REPLACE ' : '',
					ifNotExist: viewData.ifNotExist ? 'IF NOT EXISTS ' : '',
					sqlSecurity: viewData.sqlSecurity ? `SQL SECURITY ${viewData.sqlSecurity} ` : '',
					checkOption: viewData.checkOption ? `\nWITH ${viewData.checkOption} CHECK OPTION` : '',
					selectStatement,
					algorithm,
				}),
				{ isActivated: !deactivatedWholeStatement },
			);
		},

		createViewIndex(viewName, index, dbData, isParentActivated) {
			return '';
		},

		createUdt(udt, dbData) {
			return '';
		},

		getDefaultType(type) {
			return defaultTypes[type];
		},

		getTypesDescriptors() {
			return types;
		},

		hasType(type) {
			return hasType(types, type);
		},

		hydrateColumn({ columnDefinition, jsonSchema, dbData }) {
			return {
				name: columnDefinition.name,
				type: columnDefinition.type,
				primaryKey: keyHelper.isInlinePrimaryKey(jsonSchema),
				unique: keyHelper.isInlineUnique(jsonSchema),
				nullable: columnDefinition.nullable,
				default: columnDefinition.default,
				comment: columnDefinition.description,
				isActivated: columnDefinition.isActivated,
				length: columnDefinition.enum,
				scale: columnDefinition.scale,
				precision: columnDefinition.precision,
				length: columnDefinition.length,
				national: jsonSchema.national,
				autoIncrement: jsonSchema.autoincrement,
				zerofill: jsonSchema.zerofill,
				invisible: jsonSchema.invisible,
				compressionMethod: jsonSchema.compressed ? jsonSchema.compression_method : '',
				enum: jsonSchema.enum,
				synonym: jsonSchema.synonym,
				signed: jsonSchema.zerofill || jsonSchema.signed,
				microSecPrecision: jsonSchema.microSecPrecision,
				charset: jsonSchema.characterSet,
				collation: jsonSchema.collation,
			};
		},

		hydrateIndex(indexData, tableData) {
			return indexData;
		},

		hydrateViewIndex(indexData) {
			return {};
		},

		hydrateCheckConstraint(checkConstraint) {
			return {
				name: checkConstraint.chkConstrName,
				expression: checkConstraint.constrExpression,
			};
		},

		hydrateDatabase(containerData, data) {
			return {
				databaseName: containerData.name,
				orReplace: containerData.orReplace,
				ifNotExist: containerData.ifNotExist,
				characterSet: containerData.characterSet,
				collation: containerData.collation,
				comments: containerData.description,
				udfs: (data?.udfs || []).map(udf => ({
					name: udf.name,
					delimiter: udf.functionDelimiter,
					orReplace: udf.functionOrReplace,
					aggregate: udf.functionAggregate,
					ifNotExist: udf.functionIfNotExist,
					parameters: udf.functionArguments,
					type: udf.functionReturnType,
					characteristics: {
						sqlSecurity: udf.functionSqlSecurity,
						language: udf.functionLanguage,
						contains: udf.functionContains,
						deterministic: udf.functionDeterministic,
						comment: udf.functionDescription,
					},
					body: udf.functionBody,
				})),
				procedures: (data?.procedures || []).map(procedure => ({
					orReplace: procedure.orReplace,
					delimiter: procedure.delimiter,
					name: procedure.name,
					parameters: procedure.inputArgs,
					body: procedure.body,
					characteristics: {
						comment: procedure.comments,
						contains: procedure.contains,
						language: procedure.language,
						deterministic: procedure.deterministic,
						sqlSecurity: procedure.securityMode,
					},
				})),
			};
		},

		hydrateTable({ tableData, entityData, jsonSchema }) {
			const detailsTab = entityData[0];
			const likeTable = _.get(tableData, `relatedSchemas[${detailsTab.like}]`, '');

			return {
				...tableData,
				keyConstraints: keyHelper.getTableKeyConstraints({ jsonSchema }),
				temporary: detailsTab.temporary,
				orReplace: detailsTab.orReplace,
				ifNotExist: !detailsTab.orReplace && detailsTab.ifNotExist,
				likeTableName: likeTable?.code || likeTable?.collectionName,
				selectStatement: _.trim(detailsTab.selectStatement),
				options: detailsTab.tableOptions,
				partitioning: detailsTab.partitioning,
			};
		},

		hydrateViewColumn(data) {
			return {
				name: data.name,
				tableName: data.entityName,
				alias: data.alias,
				isActivated: data.isActivated,
			};
		},

		hydrateView({ viewData, entityData, relatedSchemas, relatedContainers }) {
			const detailsTab = entityData[0];

			return {
				name: viewData.name,
				tableName: viewData.tableName,
				keys: viewData.keys,
				orReplace: detailsTab.orReplace,
				ifNotExist: detailsTab.ifNotExist,
				selectStatement: detailsTab.selectStatement,
				sqlSecurity: detailsTab.SQL_SECURITY,
				algorithm: detailsTab.algorithm,
				checkOption: detailsTab.withCheckOption ? detailsTab.checkTestingScope : '',
			};
		},

		commentIfDeactivated(statement, data, isPartOfLine) {
			return statement;
		},
	};
};
