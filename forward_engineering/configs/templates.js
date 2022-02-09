module.exports = {
    createDatabase: 'CREATE DATABASE ${name}${template}${encoding}${locale}${collate}${characterClassification}${tablespace};\n',

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

    columnDefinition: '${name} ${type}${collation}${primaryKey}${uniqueKey}${defaultValue}${notNull}',

    checkConstraint: '${name} CHECK (${expression})${noInherit}',

    createForeignKeyConstraint: '${name} FOREIGN KEY (${foreignKey}) REFERENCES ${primaryTable} (${primaryKey})',

    createKeyConstraint: '${constraintName}${keyType}${columns}${includeNonKey}${storageParameters}${tablespace}',

    createForeignKey:
        'ALTER TABLE IF EXISTS ${foreignTable} ADD CONSTRAINT ${name} FOREIGN KEY (${foreignKey}) REFERENCES ${primaryTable}(${primaryKey});',

    index:
        'CREATE${unique} INDEX${concurrently}${ifNotExist} ${name}\n' +
        ' ON${only} ${tableName}${using}${keys}${options};\n\n',

    createView:
        'CREATE${orReplace}${temporary} VIEW ${name}${withOptions}\nAS ${selectStatement}${checkOption};\n\n${comment}\n',

    viewSelectStatement: 'SELECT ${keys}\n\tFROM ${tableName}',

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
    createDomainType: 'CREATE DOMAIN ${name} AS ${underlyingType}${notNull}${collate}${default}${constraints};\n\n${comment}'
};
