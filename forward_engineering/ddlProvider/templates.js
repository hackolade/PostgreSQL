module.exports = {
	createDatabase:
		'CREATE DATABASE ${name}${template}${encoding}${locale}${collate}${characterClassification}${tablespace};\n',

	createSchema: 'CREATE SCHEMA${ifNotExist} ${name};\nSET search_path TO ${name};\n\n${comment}\n',

	comment: 'COMMENT ON ${object} ${objectName} IS ${comment};\n',

	createTable:
		'CREATE${temporary} TABLE${ifNotExist} ${name} (\n' +
		'${columnDefinitions}${keyConstraints}${checkConstraints}${foreignKeyConstraints}\n' +
		')${options};\n\n${comment}${columnDescriptions}',

	createTablePartitionOf:
		'CREATE${temporary} TABLE${ifNotExist} ${name}\n' +
		'${partitionOf} ${openParenthesis}${keyConstraints}${checkConstraints}${foreignKeyConstraints}\n' +
		'${closeParenthesis}${options};\n\n${comment}${columnDescriptions}',

	generatedColumnClause: ' GENERATED ALWAYS AS (${generationExpression}) STORED',

	columnDefinition: '${name} ${type}${collation}${generatedColumnClause}${primaryKey}${uniqueKey}${defaultValue}${notNull}',

	checkConstraint: '${name} CHECK (${expression})${noInherit}',

	createForeignKeyConstraint: '${name} FOREIGN KEY (${foreignKey}) REFERENCES ${primaryTable} (${primaryKey})${match}${onDelete}${onUpdate}${deferrable}${deferrableConstraintCheckTime}',

	createKeyConstraint: '${constraintName}${keyType}${columns}${includeNonKey}${storageParameters}${tablespace}${deferrable}${deferrableConstraintCheckTime}',

	alterColumnType: 'ALTER TABLE IF EXISTS ${tableName} ALTER COLUMN ${columnName} SET DATA TYPE ${dataType};',

	addNotNullConstraint: 'ALTER TABLE IF EXISTS ${tableName} ALTER COLUMN ${columnName} SET NOT NULL;',

	dropNotNullConstraint: 'ALTER TABLE IF EXISTS ${tableName} ALTER COLUMN ${columnName} DROP NOT NULL;',

	renameColumn: 'ALTER TABLE IF EXISTS ${tableName} RENAME COLUMN ${oldColumnName} TO ${newColumnName};',

	addCheckConstraint: 'ALTER TABLE IF EXISTS ${tableName} ADD CONSTRAINT ${constraintName} CHECK (${expression});',

	dropConstraint: 'ALTER TABLE IF EXISTS ${tableName} DROP CONSTRAINT IF EXISTS ${constraintName};',

	createForeignKey:
		'ALTER TABLE IF EXISTS ${foreignTable} ADD CONSTRAINT ${name} FOREIGN KEY (${foreignKey}) REFERENCES ${primaryTable}(${primaryKey})${match}${onDelete}${onUpdate}${deferrable}${deferrableConstraintCheckTime};',

	dropForeignKey: 'ALTER TABLE ${tableName} DROP CONSTRAINT ${fkConstraintName};',

	addPkConstraint: 'ALTER TABLE IF EXISTS ${tableName} ADD ${constraintStatement};',

	dropTable: 'DROP TABLE IF EXISTS ${tableName};',

	addColumn: 'ALTER TABLE IF EXISTS ${tableName} ADD COLUMN IF NOT EXISTS ${columnDefinition};',

	dropColumn: 'ALTER TABLE IF EXISTS ${tableName} DROP COLUMN IF EXISTS ${columnName};',

	dropDomain: 'DROP DOMAIN IF EXISTS ${udtName};',

	dropType: 'DROP TYPE IF EXISTS ${udtName};',

	alterTypeAddAttribute: 'ALTER TYPE ${udtName} ADD ATTRIBUTE ${columnDefinition};',

	alterTypeDropAttribute: 'ALTER TYPE ${udtName} DROP ATTRIBUTE IF EXISTS ${attributeName};',

	alterTypeRenameAttribute: 'ALTER TYPE ${udtName} RENAME ATTRIBUTE ${oldAttributeName} TO ${newAttributeName};',

	alterTypeChangeAttributeType: 'ALTER TYPE ${udtName} ALTER ATTRIBUTE ${attributeName} SET DATA TYPE ${newDataType};',

	updateCommentOnTable: 'COMMENT ON TABLE ${tableName} IS ${comment};',

	updateCommentOnColumn: 'COMMENT ON COLUMN ${columnName} IS ${comment};',

	updateCommentOnSchema: 'COMMENT ON SCHEMA ${schemaName} IS ${comment};',

	updateCommentOnView: 'COMMENT ON VIEW ${viewName} IS ${comment};',

	createSchemaOnly: 'CREATE SCHEMA IF NOT EXISTS ${schemaName};',

	dropSchema: 'DROP SCHEMA IF EXISTS ${schemaName};',

	index:
		'CREATE${unique} INDEX${concurrently}${ifNotExist} ${name}\n' +
		' ON${only} ${tableName}${using}${keys}${nullsDistinct}${options};\n',

	createView:
		'CREATE${orReplace}${temporary} VIEW ${name}${withOptions}\nAS ${selectStatement}${checkOption};\n\n${comment}\n',

	viewSelectStatement: 'SELECT ${keys}\n\tFROM ${tableName}',

	dropView: 'DROP VIEW IF EXISTS ${viewName};',

	createFunction:
		'CREATE${orReplace} FUNCTION ${name}\n' +
		'\t(${parameters})\n' +
		'\tRETURNS ${returnType}\n' +
		'\tLANGUAGE ${language}\n' +
		'${properties}' +
		'AS $BODY$\n${definition}\n$BODY$;\n',

	createProcedure:
		'CREATE${orReplace} PROCEDURE ${name} (${parameters})\n' +
		'\tLANGUAGE ${language}\n' +
		'AS $BODY$\n${body}\n$BODY$;\n',

	createCompositeType: 'CREATE TYPE ${name} AS (\n\t${columnDefinitions}\n);\n\n${comment}',
	createEnumType: 'CREATE TYPE ${name} AS ENUM (${values});\n\n${comment}',
	createRangeType: 'CREATE TYPE ${name} AS RANGE (\n\tSUBTYPE=${subtype}${options}\n);\n\n${comment}',
	createDomainType:
		'CREATE DOMAIN ${name} AS ${underlyingType}${notNull}${collate}${default}${constraints};\n\n${comment}',

	createTrigger:
		'CREATE${orReplace}${constraint} TRIGGER ${name} ${actionTiming} ${events}\n' +
		'\tON ${tableName}\n' +
		'${options}' +
		'\tEXECUTE ${functionKey} ${functionName};\n',
};
