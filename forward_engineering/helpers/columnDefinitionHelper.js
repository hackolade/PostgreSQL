module.exports = (_, wrap) => {
	const addLength = (type, length) => {
		return `${type}(${length})`;
	};
	
	const addScalePrecision = (type, precision, scale) => {
		if (_.isNumber(scale)) {
			return `${type}(${precision},${scale})`;
		} else {
			return `${type}(${precision})`;
		}
	};
	
	const addPrecision = (type, precision) => {
		return `${type}(${precision})`;
	};
	
	const canHaveLength = type => ['CHAR', 'VARCHAR', 'BINARY', 'CHAR BYTE', 'VARBINARY', 'BLOB'].includes(type);
	
	const isNumeric = type =>
		[
			'TINYINT',
			'SMALLINT',
			'MEDIUMINT',
			'INT',
			'INTEGER',
			'BIGINT',
			'INT1',
			'INT2',
			'INT3',
			'INT4',
			'INT8',
			'FLOAT',
			'DOUBLE',
			'REAL',
			'DECIMAL',
			'DEC',
			'NUMERIC',
			'FIXED',
			'NUMBER',
			'DOUBLE PRECISION',
			'BIT',
		].includes(type);
	
	const canHavePrecision = type => isNumeric(type);
	
	const canHaveMicrosecondPrecision = type => ['TIME', 'DATETIME', 'TIMESTAMP'].includes(type);
	
	const canHaveScale = type =>
		['DECIMAL', 'FLOAT', 'DOUBLE', 'DEC', 'FIXED', 'NUMERIC', 'NUMBER', 'DOUBLE PRECISION', 'REAL'].includes(type);
	
	const decorateType = (type, columnDefinition) => {
		if (canHaveLength(type) && _.isNumber(columnDefinition.length)) {
			return addLength(type, columnDefinition.length);
		} else if (canHavePrecision(type) && canHaveScale(type) && _.isNumber(columnDefinition.precision)) {
			return addScalePrecision(type, columnDefinition.precision, columnDefinition.scale);
		} else if (canHavePrecision(type) && _.isNumber(columnDefinition.precision)) {
			return addPrecision(type, columnDefinition.precision);
		} else if (canHaveMicrosecondPrecision(type) && _.isNumber(columnDefinition.microSecPrecision)) {
			return addPrecision(type, columnDefinition.microSecPrecision);
		} else if (['ENUM', 'SET'].includes(type) && !_.isEmpty(columnDefinition.enum)) {
			return `${type}('${columnDefinition.enum.join("', '")}')`;
		}
	
		return type;
	};
	
	const isString = type => ['CHAR', 'VARCHAR', 'TEXT', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT'].includes(_.toUpper(type));
	const isDateTime = type => ['TIME', 'DATE', 'DATETIME', 'TIMESTAMP'].includes(type);
	
	const escapeQuotes = str => _.trim(str).replace(/(\')+/g, "'$1");
	
	const decorateDefault = (type, defaultValue) => {
		const constantsValues = ['current_timestamp', 'null'];
		if ((isString(type) || isDateTime(type)) && !constantsValues.includes(_.toLower(defaultValue))) {
			return wrap(escapeQuotes(defaultValue));
		} else {
			return defaultValue;
		}
	};
	
	const canBeNational = type => {
		return ['CHAR', 'VARCHAR'].includes(type);
	};
	
	const getSign = (type, signed) => {
		if (!isNumeric(type)) {
			return '';
		}
	
		if (signed === false) {
			return ' UNSIGNED';
		}
	
		return '';
	};
	
	return {
		decorateType,
		decorateDefault,
		canBeNational,
		isNumeric,
		getSign,
	};
};
