module.exports = {
	TINYINT: {
		capacity: 1,
	},
	SMALLINT: {
		capacity: 2,
	},
	MEDIUMINT: {
		capacity: 3,
	},
	INT: {
		capacity: 4,
	},
	INTEGER: {
		capacity: 4,
	},
	BIGINT: {
		capacity: 8,
	},
	INT1: {
		capacity: 1,
	},
	INT2: {
		capacity: 2,
	},
	INT3: {
		capacity: 3,
	},
	INT4: {
		capacity: 4,
	},
	INT8: {
		capacity: 8,
	},
	FLOAT: {
		capacity: 4,
		mode: 'floating',
	},
	DOUBLE: {
		capacity: 8,
		mode: 'floating',
	},
	'DOUBLE PRECISION': {
		capacity: 8,
		mode: 'floating',
	},
	REAL: {
		capacity: 8,
		mode: 'floating',
	},
	DECIMAL: {
		capacity: 16,
		mode: 'decimal',
	},
	DEC: {
		capacity: 16,
		mode: 'decimal',
	},
	NUMERIC: {
		capacity: 16,
		mode: 'decimal',
	},
	FIXED: {
		capacity: 16,
		mode: 'decimal',
	},
	NUMBER: {
		capacity: 16,
		mode: 'decimal',
	},
	CHAR: {
		size: 1,
	},
	VARCHAR: {
		mode: 'varying',
	},
	TINYTEXT: {
		size: 255,
		mode: 'text',
	},
	TEXT: {
		size: 65535,
		mode: 'text',
	},
	MEDIUMTEXT: {
		size: 16777215,
		mode: 'text',
	},
	LONGTEXT: {
		size: 4294967295,
		mode: 'text',
	},
	JSON: {
		size: 4294967295,
		mode: 'text',
	},
	BINARY: {
		mode: 'binary',
	},
	'CHAR BYTE': {
		mode: 'binary',
	},
	VARBINARY: {
		size: 2147483649,
		mode: 'binary',
	},
	TINYBLOB: {
		size: 255,
		mode: 'binary',
	},
	BLOB: {
		size: 65535,
		mode: 'binary',
	},
	MEDIUMBLOB: {
		size: 16777215,
		mode: 'binary',
	},
	LONGBLOB: {
		size: 4294967295,
		mode: 'binary',
	},
	BIT: {
		mode: 'boolean',
	},
	DATE: {
		format: 'YYYY-MM-DD',
	},
	TIME: {
		format: 'hh:mm:ss.nnnnnn',
	},
	DATETIME: {
		format: 'YYYY-MM-DD hh:mm:ss',
	},
	TIMESTAMP: {
		format: 'YYYY-MM-DD hh:mm:ss',
	},
	YEAR: {
		format: 'YYYY',
	},
	INET6: {
		mode: 'ip',
	},
	ENUM: {
		mode: 'enum',
	},
	SET: {
		mode: 'enum',
	},
	GEOMETRY: {
		format: 'euclidian',
		mode: 'geospatial',
	},
	POINT: {
		format: 'euclidian',
		mode: 'geospatial',
	},
	LINESTRING: {
		format: 'euclidian',
		mode: 'geospatial',
	},
	POLYGON: {
		format: 'euclidian',
		mode: 'geospatial',
	},
	MULTIPOINT: {
		format: 'euclidian',
		mode: 'geospatial',
	},
	MULTILINESTRING: {
		format: 'euclidian',
		mode: 'geospatial',
	},
	MULTIPOLYGON: {
		format: 'euclidian',
		mode: 'geospatial',
	},
	GEOMETRYCOLLECTION: {
		format: 'euclidian',
		mode: 'geospatial',
	},
};
