module.exports = {
	createDatabase: 'CREATE${orReplace} DATABASE${ifNotExist} `${name}`${dbOptions};\n\nUSE `${name}`;\n',

	createTable:
		'CREATE ${orReplace}${temporary}TABLE ${ifNotExist}${name} (\n' +
		'\t${column_definitions}${keyConstraints}${checkConstraints}${foreignKeyConstraints}\n' +
		')${options}${partitions}${selectStatement};\n',

	createLikeTable: 'CREATE ${orReplace}${temporary}TABLE ${ifNotExist}${name} LIKE ${likeTableName};\n',

	columnDefinition:
		'`${name}` ${national}${type}${signed}${primary_key}${unique_key}${default}${autoIncrement}${zeroFill}${not_null}${invisible}${compressed}${charset}${collate}${comment}',

	checkConstraint: 'CONSTRAINT ${name}CHECK (${expression})',

	createForeignKeyConstraint:
		'CONSTRAINT `${name}` FOREIGN KEY (${foreignKey}) REFERENCES ${primaryTable}(${primaryKey})',

	createKeyConstraint: '${constraintName}${keyType}${columns}${using}${blockSize}${comment}${ignore}',

	createForeignKey:
		'ALTER TABLE ${foreignTable} ADD CONSTRAINT `${name}` FOREIGN KEY (${foreignKey}) REFERENCES ${primaryTable}(${primaryKey});',

	index:
		'CREATE ${indexType}INDEX ${ifNotExist}${name}${indexCategory}\n' +
		'\tON ${table} ( ${keys} )${indexOptions};\n',

	createView:
		'CREATE ${orReplace}${algorithm}${sqlSecurity}VIEW ${ifNotExist}${name} AS ${selectStatement}${checkOption};\n',

	viewSelectStatement: 'SELECT ${keys}\n\tFROM ${tableName}',

	createFunction:
		'CREATE ${orReplace}${aggregate}FUNCTION ${ifNotExist}${name}\n' +
		'\t(${parameters})\n' +
		'\tRETURNS ${type}\n' +
		'\t${characteristics}\n' +
		'${body}${delimiter}\n',

	createProcedure:
		'CREATE ${orReplace}PROCEDURE ${name} (${parameters})\n' + '\t${characteristics}\n' + '${body}${delimiter}\n',
};
