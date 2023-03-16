const POSTGRES_RESERVED_WORDS = [
	'ALL',
	'ANALYSE',
	'ANALYZE',
	'AND',
	'ANY',
	'ARRAY',
	'ASC',
	'ASYMMETRIC',
	'AUTHORIZATION',
	'BINARY',
	'BOTH',
	'CASE',
	'CAST',
	'CHECK',
	'COLLATE',
	'COLUMN',
	'CONCURRENTLY',
	'CONSTRAINT',
	'CREATE',
	'CROSS',
	'CURRENT_CATALOG',
	'CURRENT_DATE',
	'CURRENT_ROLE',
	'CURRENT_SCHEMA',
	'CURRENT_TIME',
	'CURRENT_TIMESTAMP',
	'CURRENT_USER',
	'DEFAULT',
	'DEFERRABLE',
	'DESC',
	'DISTINCT',
	'DO',
	'ELSE',
	'END',
	'EXCEPT',
	'FALSE',
	'FOR',
	'FOREIGN',
	'FREEZE',
	'FROM',
	'FULL',
	'GRANT',
	'GROUP',
	'HAVING',
	'ILIKE',
	'IN',
	'INITIALLY',
	'INTERSECT',
	'INTO',
	'IS',
	'ISNULL',
	'JOIN',
	'LATERAL',
	'LEADING',
	'LEFT',
	'LIKE',
	'LIMIT',
	'LOCALTIME',
	'LOCALTIMESTAMP',
	'NATURAL',
	'NOT',
	'NULL',
	'OFFSET',
	'ON',
	'ONLY',
	'OR',
	'ORDER',
	'OUTER',
	'OVERLAPS',
	'PLACING',
	'PRIMARY',
	'REFERENCES',
	'RETURNING',
	'RIGHT',
	'SELECT',
	'SESSION_USER',
	'SIMILAR',
	'SOME',
	'SYMMETRIC',
	'TABLE',
	'TABLESAMPLE',
	'THEN',
	'TO',
	'TRAILING',
	'TRUE',
	'UNION',
	'UNIQUE',
	'USER',
	'USING',
	'VARIADIC',
	'VERBOSE',
	'WHEN',
	'WHERE',
	'WINDOW',
	'WITH',
];

const MUST_BE_ESCAPED = /\t|\n|'|\f|\r/gm;

module.exports = ({ _, divideIntoActivatedAndDeactivated, commentIfDeactivated }) => {
	const getFunctionArguments = functionArguments => {
		return _.map(functionArguments, arg => {
			const defaultExpression = arg.defaultExpression ? `DEFAULT ${arg.defaultExpression}` : '';

			return _.trim(`${arg.argumentMode} ${arg.argumentName || ''} ${arg.argumentType} ${defaultExpression}`);
		}).join(', ');
	};

	const getNamePrefixedWithSchemaName = (name, schemaName) => {
		if (schemaName) {
			return `${wrapInQuotes(schemaName)}.${wrapInQuotes(name)}`;
		}

		return wrapInQuotes(name);
	};

	const wrapInQuotes = name =>
		/\s|\W/.test(name) || _.includes(POSTGRES_RESERVED_WORDS, _.toUpper(name)) ? `"${name}"` : name;

	const columnMapToString = ({ name }) => wrapInQuotes(name);

	const getColumnsList = (columns, isAllColumnsDeactivated, isParentActivated, mapColumn = columnMapToString) => {
		const dividedColumns = divideIntoActivatedAndDeactivated(columns, mapColumn);
		const deactivatedColumnsAsString = dividedColumns?.deactivatedItems?.length
			? commentIfDeactivated(dividedColumns.deactivatedItems.join(', '), {
					isActivated: false,
					isPartOfLine: true,
			  })
			: '';

		return !isAllColumnsDeactivated && isParentActivated
			? ' (' + dividedColumns.activatedItems.join(', ') + deactivatedColumnsAsString + ')'
			: ' (' + columns.map(mapColumn).join(', ') + ')';
	};

	const getKeyWithAlias = key => {
		if (!key) {
			return '';
		}

		if (key.alias) {
			return `${wrapInQuotes(key.name)} as ${wrapInQuotes(key.alias)}`;
		} else {
			return wrapInQuotes(key.name);
		}
	};

	const getViewData = keys => {
		if (!Array.isArray(keys)) {
			return { tables: [], columns: [] };
		}

		return keys.reduce(
			(result, key) => {
				if (!key.tableName) {
					result.columns.push(getKeyWithAlias(key));

					return result;
				}

				let tableName = wrapInQuotes(key.tableName);

				if (!result.tables.includes(tableName)) {
					result.tables.push(tableName);
				}

				result.columns.push({
					statement: `${tableName}.${getKeyWithAlias(key)}`,
					isActivated: key.isActivated,
				});

				return result;
			},
			{
				tables: [],
				columns: [],
			},
		);
	};

	const prepareComment = (comment = '') => 
		comment.replace(MUST_BE_ESCAPED, character => `${'\\'}${character}`);


	const wrapComment = comment => `E'${prepareComment(JSON.stringify(comment)).slice(1, -1)}'`;

	const getDbVersion = (dbVersion = '') => {
		const version = dbVersion.match(/\d+/);

		return Number(_.get(version, [0], 0));
	};

	return {
		getFunctionArguments,
		getNamePrefixedWithSchemaName,
		wrapInQuotes,
		getColumnsList,
		getViewData,
		wrapComment,
		getDbVersion,
	};
};
