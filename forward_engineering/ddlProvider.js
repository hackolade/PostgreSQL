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
    const {
        getFunctionArguments,
        wrapInQuotes,
        getNamePrefixedWithSchemaName,
        getColumnsList,
        getViewData,
        wrapComment,
    } = require('./helpers/general')({
        _,
        divideIntoActivatedAndDeactivated,
        commentIfDeactivated,
    });
    const { generateConstraintsString, foreignKeysToString, foreignActiveKeysToString, createKeyConstraint } =
        require('./helpers/constraintsHelper')({
            _,
            commentIfDeactivated,
            checkAllKeysDeactivated,
            assignTemplates,
            getColumnsList,
            wrapInQuotes,
        });
    const keyHelper = require('./helpers/keyHelper')(_, clean);

    const { getFunctionsScript } = require('./helpers/functionHelper')({
        _,
        templates,
        assignTemplates,
        getFunctionArguments,
        getNamePrefixedWithSchemaName,
    });

    const { getProceduresScript } = require('./helpers/procedureHelper')({
        _,
        templates,
        assignTemplates,
        getFunctionArguments,
        getNamePrefixedWithSchemaName,
    });

    const { getTableTemporaryValue, getTableOptions } = require('./helpers/tableHelper')({
        _,
        checkAllKeysDeactivated,
        getColumnsList,
    });

    const { getUserDefinedType } = require('./helpers/udtHelper')({
        _,
        commentIfDeactivated,
        assignTemplates,
        templates,
        getNamePrefixedWithSchemaName,
        wrapComment,
    });

    const { getIndexKeys, getIndexOptions } = require('./helpers/indexHelper')({
        _,
        wrapInQuotes,
        checkAllKeysDeactivated,
        getColumnsList,
    });

    const { decorateType, decorateDefault, getColumnComments } = require('./helpers/columnDefinitionHelper')({
        _,
        wrap,
        assignTemplates,
        templates,
        commentIfDeactivated,
        getNamePrefixedWithSchemaName,
        wrapComment,
    });

    return {
        createDatabase({ databaseName, ifNotExist, comments, udfs, procedures }) {
            const comment = assignTemplates(templates.comment, {
                object: 'SCHEMA',
                objectName: wrapInQuotes(databaseName),
                comment: wrapComment(comments),
            });

            const schemaStatement = assignTemplates(templates.createSchema, {
                name: wrapInQuotes(databaseName),
                ifNotExist: ifNotExist ? ' IF NOT EXISTS' : '',
                comment: comments ? comment : '',
            });

            return schemaStatement;
        },

        createTable(
            {
                name,
                columns,
                checkConstraints,
                foreignKeyConstraints,
                dbData,
                columnDefinitions,
                relatedSchemas,
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
            },
            isActivated
        ) {
            const ifNotExistStr = ifNotExist ? ' IF NOT EXISTS' : '';
            const tableName = getNamePrefixedWithSchemaName(name, dbData.databaseName);
            const comment = assignTemplates(templates.comment, {
                object: 'TABLE',
                objectName: tableName,
                comment: wrapComment(description),
            });

            const dividedKeysConstraints = divideIntoActivatedAndDeactivated(
                keyConstraints.map(createKeyConstraint(templates, isActivated)),
                key => key.statement
            );
            const keyConstraintsString = generateConstraintsString(dividedKeysConstraints, isActivated);

            const dividedForeignKeys = divideIntoActivatedAndDeactivated(foreignKeyConstraints, key => key.statement);
            const foreignKeyConstraintsString = generateConstraintsString(dividedForeignKeys, isActivated);

            const columnDescriptions = '\n' + getColumnComments(tableName, columnDefinitions);

            const tableStatement = assignTemplates(templates.createTable, {
                temporary: getTableTemporaryValue(temporary, unlogged),
                ifNotExist: ifNotExistStr,
                name: tableName,
                columnDefinitions: '\t' + _.join(columns, ',\n\t'),
                keyConstraints: keyConstraintsString,
                checkConstraints: !_.isEmpty(checkConstraints) ? ',\n\t' + _.join(checkConstraints, ',\n\t') : '',
                foreignKeyConstraints: foreignKeyConstraintsString,
                options: getTableOptions({
                    inherits,
                    partitioning,
                    usingMethod,
                    on_commit,
                    storage_parameter,
                    table_tablespace_name,
                    selectStatement,
                }),
                comment: description ? comment : '',
                columnDescriptions,
            });

            return tableStatement;
        },

        convertColumnDefinition(columnDefinition) {
            const notNull = columnDefinition.nullable ? '' : ' NOT NULL';
            const primaryKey = columnDefinition.primaryKey ? ' PRIMARY KEY' : '';
            const uniqueKey = columnDefinition.unique ? ' UNIQUE' : '';
            const collation = columnDefinition.collationRule ? ` COLLATE "${columnDefinition.collationRule}"` : '';
            const defaultValue = !_.isUndefined(columnDefinition.default)
                ? ' DEFAULT ' + decorateDefault(columnDefinition.type, columnDefinition.default)
                : '';

            return commentIfDeactivated(
                assignTemplates(templates.columnDefinition, {
                    name: wrapInQuotes(columnDefinition.name),
                    type: decorateType(columnDefinition.type, columnDefinition),
                    notNull,
                    primaryKey,
                    uniqueKey,
                    collation,
                    defaultValue,
                }),
                {
                    isActivated: columnDefinition.isActivated,
                }
            );
        },

        createIndex(tableName, index, dbData, isParentActivated = true) {
            const name = wrapInQuotes(index.indxName);
            const unique = index.unique && index.index_method === 'btree' ? ' UNIQUE' : '';
            const concurrently = index.concurrently ? ' CONCURRENTLY' : '';
            const ifNotExist = index.ifNotExist ? ' IF NOT EXISTS' : '';
            const only = index.only ? ' ONLY' : '';
            const using = index.index_method ? ` USING ${_.toUpper(index.index_method)}` : '';

            const keys = getIndexKeys(
                index.index_method === 'btree'
                    ? index.columns
                    : _.map(index.columns, column => _.omit(column, 'sortOrder', 'nullsOrder')),
                isParentActivated
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
                    tableName: getNamePrefixedWithSchemaName(tableName, dbData.databaseName),
                }),
                {
                    isActivated: index.isActivated,
                }
            );
        },

        createCheckConstraint(checkConstraint) {
            return assignTemplates(templates.checkConstraint, {
                name: checkConstraint.name ? `CONSTRAINT ${wrapInQuotes(checkConstraint.name)}` : '',
                expression: _.trim(checkConstraint.expression).replace(/^\(([\s\S]*)\)$/, '$1'),
                noInherit: checkConstraint.noInherit ? ' NO INHERIT' : '',
            });
        },

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
            },
            dbData
        ) {
            const isAllPrimaryKeysDeactivated = checkAllKeysDeactivated(primaryKey);
            const isAllForeignKeysDeactivated = checkAllKeysDeactivated(foreignKey);
            const isActivated =
                !isAllPrimaryKeysDeactivated &&
                !isAllForeignKeysDeactivated &&
                primaryTableActivated &&
                foreignTableActivated;

            const foreignKeyStatement = assignTemplates(templates.createForeignKeyConstraint, {
                primaryTable: getNamePrefixedWithSchemaName(primaryTable, primarySchemaName || dbData.databaseName),
                name: name ? `CONSTRAINT ${wrapInQuotes(name)}` : '',
                foreignKey: isActivated ? foreignKeysToString(foreignKey) : foreignActiveKeysToString(foreignKey),
                primaryKey: isActivated ? foreignKeysToString(primaryKey) : foreignActiveKeysToString(primaryKey),
            });

            return {
                statement: _.trim(foreignKeyStatement),
                isActivated,
            };
        },

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
            },
            dbData
        ) {
            const isAllPrimaryKeysDeactivated = checkAllKeysDeactivated(primaryKey);
            const isAllForeignKeysDeactivated = checkAllKeysDeactivated(foreignKey);
            const isActivated =
                !isAllPrimaryKeysDeactivated &&
                !isAllForeignKeysDeactivated &&
                primaryTableActivated &&
                foreignTableActivated;

            const foreignKeyStatement = assignTemplates(templates.createForeignKey, {
                primaryTable: getNamePrefixedWithSchemaName(primaryTable, primarySchemaName || dbData.databaseName),
                foreignTable: getNamePrefixedWithSchemaName(foreignTable, foreignSchemaName || dbData.databaseName),
                name: name ? wrapInQuotes(name) : '',
                foreignKey: isActivated ? foreignKeysToString(foreignKey) : foreignActiveKeysToString(foreignKey),
                primaryKey: isActivated ? foreignKeysToString(primaryKey) : foreignActiveKeysToString(primaryKey),
            });

            return {
                statement: _.trim(foreignKeyStatement),
                isActivated,
            };
        },

        createView(viewData, dbData, isActivated) {
            const viewName = getNamePrefixedWithSchemaName(viewData.name, dbData.databaseName);

            const comment = assignTemplates(templates.comment, {
                object: 'VIEW',
                objectName: viewName,
                comment: wrapComment(viewData.comment),
            });

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

            const check_option = viewData.viewOptions?.check_option
                ? `check_option=${viewData.viewOptions?.check_option}`
                : '';
            const security_barrier = viewData.viewOptions?.security_barrier ? `security_barrier` : '';
            const withOptions =
                check_option || security_barrier
                    ? `\n\tWITH (${_.compact([check_option, security_barrier]).join(',')})`
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

            return commentIfDeactivated(
                assignTemplates(templates.createView, {
                    name: viewName,
                    orReplace: viewData.orReplace ? ' OR REPLACE' : '',
                    temporary: viewData.temporary ? ' TEMPORARY' : '',
                    checkOption: getCheckOption(viewData),
                    comment: viewData.comment ? comment : '',
                    withOptions,
                    selectStatement,
                }),
                { isActivated: !deactivatedWholeStatement }
            );
        },

        createViewIndex(viewName, index, dbData, isParentActivated) {
            return '';
        },

        createUdt(udt, dbData) {
            const columns = _.map(udt.properties, this.convertColumnDefinition);

            return getUserDefinedType(udt, columns);
        },

        createFunctions({ databaseName, udfs }) {
            return getFunctionsScript(databaseName, udfs);
        },

        createProcedures({ databaseName, procedures }) {
            return getProceduresScript(databaseName, procedures);
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
            const collationRule = _.includes(['char', 'varchar', 'text'], columnDefinition.type)
                ? jsonSchema.collationRule
                : '';
            const timeTypes = ['time', 'timestamp'];
            const timePrecision = _.includes(timeTypes, columnDefinition.type) ? jsonSchema.timePrecision : '';
            const with_timezone = _.includes(timeTypes, columnDefinition.type) ? jsonSchema.with_timezone : '';
            const intervalOptions = columnDefinition.type === 'interval' ? jsonSchema.intervalOptions : '';

            return {
                name: columnDefinition.name,
                type: columnDefinition.type,
                primaryKey: keyHelper.isInlinePrimaryKey(jsonSchema),
                unique: keyHelper.isInlineUnique(jsonSchema),
                nullable: columnDefinition.nullable,
                default: columnDefinition.default,
                comment: jsonSchema.description,
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
                databaseName: dbData.databaseName,
                collationRule,
                timePrecision,
                with_timezone,
                intervalOptions,
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
                noInherit: checkConstraint.noInherit,
            };
        },

        hydrateDatabase(containerData, data) {
            return {
                databaseName: containerData.name,
                ifNotExist: containerData.ifNotExist,
                comments: containerData.description,
                udfs: data?.udfs || [],
                procedures: data?.procedures || [],
            };
        },

        hydrateTable({ tableData, entityData, jsonSchema }) {
            const detailsTab = entityData[0];
            const inheritsTable = _.get(tableData, `relatedSchemas[${detailsTab.inherits}]`, '');
            const partitioning = _.first(detailsTab.partitioning) || {};
            const compositePartitionKey = keyHelper.getKeys(partitioning.compositePartitionKey, jsonSchema);

            return {
                ...tableData,
                keyConstraints: keyHelper.getTableKeyConstraints(jsonSchema),
                inherits: inheritsTable?.code || inheritsTable?.collectionName,
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
                    'table_tablespace_name'
                ),
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
                keys: viewData.keys,
                comment: detailsTab.description,
                orReplace: detailsTab.orReplace,
                temporary: detailsTab.temporary,
                recursive: detailsTab.recursive,
                viewOptions: detailsTab.viewOptions,
                selectStatement: detailsTab.selectStatement,
                withCheckOption: detailsTab.withCheckOption,
                checkTestingScope: detailsTab.withCheckOption ? detailsTab.checkTestingScope : '',
            };
        },

        commentIfDeactivated(statement, data, isPartOfLine) {
            return statement;
        },
    };
};
