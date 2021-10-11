module.exports = {
    createSchema: 'CREATE SCHEMA${ifNotExist} ${name};\nSET search_path TO ${name};\n${comment}\n',

    comment: "COMMENT ON ${object} ${objectName} IS '${comment}';\n",

    createTable:
        'CREATE${temporary} TABLE${ifNotExist} ${name} (\n' +
        '${columnDefinitions}${keyConstraints}${checkConstraints}${foreignKeyConstraints}\n' +
        ')${options};\n${comment}\n',

    columnDefinition: '${name} ${type}${collation}${primaryKey}${uniqueKey}${defaultValue}${notNull}',

    checkConstraint: '${name} CHECK (${expression})${noInherit}',

    createForeignKeyConstraint: '${name} FOREIGN KEY (${foreignKey}) REFERENCES ${primaryTable} (${primaryKey})',

    createKeyConstraint: '${constraintName}${keyType}${columns}${includeNonKey}${storageParameters}${tablespace}',

    createForeignKey:
        'ALTER TABLE IF EXISTS ${foreignTable} ADD CONSTRAINT ${name} FOREIGN KEY (${foreignKey}) REFERENCES ${primaryTable}(${primaryKey});',

    index:
        'CREATE ${indexType}INDEX ${ifNotExist}${name}${indexCategory}\n' +
        '\tON ${table} ( ${keys} )${indexOptions};\n',

    createView:
        'CREATE ${orReplace}${algorithm}${sqlSecurity}VIEW ${ifNotExist}${name} AS ${selectStatement}${checkOption};\n',

    viewSelectStatement: 'SELECT ${keys}\n\tFROM ${tableName}',

    createFunction:
        'CREATE${orReplace} FUNCTION ${name}\n' +
        '\t(${parameters})\n' +
        '\tRETURNS ${returnType}\n' +
        '\tLANGUAGE ${language}\n' +
        '${properties}' +
        'AS ${definition};\n',

    createProcedure:
        'CREATE${orReplace} PROCEDURE ${name} (${parameters})\n' + '\tLANGUAGE ${language}\n' + 'AS ${body};\n',

    createCompositeType: 'CREATE TYPE ${name} AS (\n\t${columnDefinitions}\n);\n${comment}\n',
    createEnumType: 'CREATE TYPE ${name} AS ENUM (${values});\n${comment}\n',
    createRangeType: 'CREATE TYPE ${name} AS RANGE (\n\tSUBTYPE=${subtype}${options}\n);\n${comment}\n',
};
