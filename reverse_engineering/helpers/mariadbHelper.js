const functionHelper = require("./parsers/functionHelper");
const procedureHelper = require("./parsers/procedureHelper");

const parseDatabaseStatement = (statement) => {
	const characterSetRegExp = /CHARACTER\ SET\ (.+?)\ /i;
	const collationRegExp = /COLLATE\ (.+?)\ /i;
	const commentRegExp = /COMMENT\ \'([\s\S]*?)\'/i;
	const data = {};

	if (characterSetRegExp.test(statement)) {
		data.characterSet = statement.match(characterSetRegExp)[1];
	}

	if (collationRegExp.test(statement)) {
		data.collation = statement.match(collationRegExp)[1];
	}

	if (commentRegExp.test(statement)) {
		data.description = statement.match(commentRegExp)[1];
	}

	return data;
};

const parseFunctions = (functions) => {
	return functions.map(f => {
		const query = f.data[0]['Create Function'];

		try {
			const func = functionHelper.parseFunctionQuery(String(query));
	
			return {
				name: f.meta['Name'],
				functionDelimiter: (func.body || '').includes(';') ? '$$' : '',
				functionOrReplace: func.orReplace,
				functionAggregate: func.isAggregate,
				functionIfNotExist: func.ifNotExists,
				functionArguments: func.parameters,
				functionDataType: func.returnType,
				functionBody: func.body,
				functionLanguage: 'SQL',
				functionDeterministic: functionHelper.getDeterministic(func.characteristics),
				functionContains: functionHelper.getContains(func.characteristics),
				functionSqlSecurity: f.meta['Security_type'],
				functionDescription: f.meta['Comment'],
			};
		} catch (error) {
			throw {
				message: error.message + '.\nError parsing function: ' + query,
				stack: error.stack,
			};
		}
	});
};

const parseProcedures = (procedures) => {
	return procedures.map(procedure => {
		try {
			const meta = procedure.meta;
			const procValue = procedure.data[0]['Create Procedure'];
			const data = procedureHelper.parseProcedure(String(procValue));
			
			return {
				name: meta['Name'],
				delimiter: (data.body || '').includes(';') ? '$$' : '',
				orReplace: data.orReplace,
				inputArgs: data.parameters,
				body: data.body,
				language: 'SQL',
				deterministic: data.deterministic,
				contains: data.contains,
				securityMode: meta['Security_type'],
				comments: meta['Comment']
			};
		} catch (error) {
			throw {
				message: error.message + '.\nError parsing procedure: ' + procedure.data[0]['Create Procedure'],
				stack: error.stack,
			};
		}
	});
};

const isJson = (columnName, constraints) => {
	return constraints.some(constraint => {
		const check = constraint['CHECK_CLAUSE'];

		if (!/json_valid/i.test(check)) {
			return false;
		}

		return check.includes(`\`${columnName}\``);
	});
};

const findJsonRecord = (fieldName, records) => {
	return records.find(records => {
		if (typeof records[fieldName] !== 'string') {
			return false;
		}

		try {
			return JSON.parse(records[fieldName]);
		} catch (e) {
			return false;
		}
	});
};

const getSubtype = (fieldName, record) => {
	const item = JSON.parse(record[fieldName]);
 
	if (!item) {
		return ' ';
	}

	if (Array.isArray(item)) {
		return 'array';
	}

	if (typeof item === 'object') {
		return 'object';
	}

	return ' ';
};

const addKeyOptions = (jsonSchema, indexes) => {
	const primaryIndexes = indexes.filter(index => getIndexType(index) === 'PRIMARY');
	const uniqueIndexes = indexes.filter(index => getIndexType(index) === 'UNIQUE');
	const { single } = uniqueIndexes.reduce(({single, composite, hash}, index) => {
		const indexName = index['Key_name'];
		if (!hash[indexName]) {
			hash[indexName] = true;

			return {
				single: single.concat(index),
				composite,
				hash,
			};
		} else {
			return {
				single: single.filter(index => index['Key_name'] !== indexName),
				composite: composite.concat(index),
				hash,
			};
		}
	}, {composite: [], single: [], hash: {}});

	jsonSchema = single.reduce((jsonSchema, index) => {
		const columnName = index['Column_name'];
		const uniqueKeyOptions = getIndexData(index);

		return {
			...jsonSchema,
			properties: {
				...jsonSchema.properties,
				[columnName]: {
					...(jsonSchema.properties[columnName] || {}),
					uniqueKeyOptions: [
						...((jsonSchema.properties[columnName] || {}).uniqueKeyOptions || []),
						uniqueKeyOptions,
					],
				}
			}
		};
	}, jsonSchema);

	if (primaryIndexes.length === 1) {
		const primaryIndex = primaryIndexes[0];
		const columnName = primaryIndex['Column_name'];
		const { constraintName, ...primaryKeyOptions } = getIndexData(primaryIndex);

		jsonSchema = {
			...jsonSchema,
			properties: {
				...jsonSchema.properties,
				[columnName]: {
					...(jsonSchema.properties[columnName] || {}),
					primaryKeyOptions,
				}
			}
		};
	}

	return jsonSchema;
};

const getIndexData = (index) => {
	return {
		constraintName: index['Key_name'],
		indexCategory: getIndexCategory(index),
		indexComment: index['Index_comment'],
		indexOrder: getIndexOrder(index['Collation']),
		indexIgnore: index['Ignored'] === 'YES'
	};
};

const getJsonSchema = ({ columns, constraints, records, indexes }) => {
	const properties = columns.filter((column) => {
		return column['Type'] === 'longtext';
	}).reduce((schema, column) => {
		const fieldName = column['Field'];
		const record = findJsonRecord(fieldName, records);
		const isJsonSynonym = isJson(fieldName, constraints);
		const subtype = record ? getSubtype(fieldName, record) : ' ';
		const synonym = isJsonSynonym ? 'json' : '';

		if (!synonym && subtype === ' ') {
			return schema;
		}

		return {
			...schema,
			[fieldName]: {
				type: 'char',
				mode: 'longtext',
				synonym,
				subtype,
			}
		};
	}, {});

	return addKeyOptions({
		properties,
	}, indexes);
};

const getIndexOrder = (collation) => {
	if (collation === 'A') {
		return 'ASC';
	} else if (collation === 'D') {
		return 'DESC';
	} else {
		return null;
	}
};

const getIndexType = (index) => {
	if (index['Key_name'] === 'PRIMARY') {
		return 'PRIMARY';
	} else if (index['Index_type'] === 'FULLTEXT') {
		return 'FULLTEXT';
	} else if (index['Index_type'] === 'SPATIAL') {
		return 'SPATIAL';
	} else if (Number(index['Non_unique']) === 0) {
		return 'UNIQUE';
	} else if (index['Index_type'] === 'KEY') {
		return 'KEY';
	} else {
		return '';
	}
};

const getIndexCategory = (index) => {
	if (index['Index_type'] === 'BTREE') {
		return 'BTREE';
	} else if (index['Index_type'] === 'HASH') {
		return 'HASH';
	} else if (index['Index_type'] === 'RTREE') {
		return 'RTREE';
	} else {
		return '';
	}
};

const parseIndexes = (indexes) => {
	const indexesByConstraint = indexes.filter(index => !['PRIMARY', 'UNIQUE'].includes(getIndexType(index))).reduce((result, index) => {
		const constraintName = index['Key_name'];

		if (result[constraintName]) {
			return {
				...result,
				[constraintName]: {
					...result[constraintName],
					indxKey: result[constraintName].indxKey.concat({
						name: index['Column_name'],
						type: getIndexOrder(index['Collation']),
					}),
				},
			};
		}

		const indexData = {
			indxName: constraintName,
			indexType: getIndexType(index),
			indexCategory: getIndexCategory(index),
			indexComment: index['Index_comment'],
			indxKey: [{
				name: index['Column_name'],
				type: getIndexOrder(index['Collation']),
			}],
		};

		return {
			...result,
			[constraintName]: indexData,
		};
	}, {});

	return Object.values(indexesByConstraint);
};

module.exports = {
	parseDatabaseStatement,
	parseFunctions,
	parseProcedures,
	getJsonSchema,
	parseIndexes,
};
