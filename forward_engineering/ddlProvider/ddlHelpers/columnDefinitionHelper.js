const _ = require('lodash');
const { commentIfDeactivated, wrapInQuotes, wrapComment } = require('../../utils/general');
const assignTemplates = require('../../utils/assignTemplates');
const templates = require('../templates');

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
	if (_.isNumber(precision)) {
		return `${type}(${precision})`;
	}

	return type;
};

const addWithTimezone = (type, timezone) => {
	if (timezone) {
		return `${type} ${timezone}`;
	}

	return type;
};

const addTypeModifier = ({ type, typeModifier, srid }) => {
	const typeSrid = srid ? `, ${srid}` : ``;
	if (typeModifier && typeModifier !== '') {
		return `${type}(${typeModifier}${typeSrid})`;
	}
	return type;
};
const addArrayDecorator = (type, array_type) => {
	const arrayDecorator =
		array_type
			?.map(item => `[${item?.array_size_limit ?? ''}]`)
			.join('')
			.trim() || '';

	return `${type}${arrayDecorator}`;
};

const decorateVector = (type, dimension) => {
	return `${type}(${dimension})`;
};

const canHaveLength = type => ['char', 'varchar', 'bit', 'varbit'].includes(type);
const canHavePrecision = type => type === 'numeric';
const canHaveTimePrecision = type => ['time', 'timestamp'].includes(type);
const canHaveScale = type => type === 'numeric';
const canHaveTypeModifier = type => ['geography', 'geometry'].includes(type);

const isVector = type => type === 'vector';

const decorateType = (type, columnDefinition) => {
	const { length, precision, scale, typeModifier, srid, timezone, timePrecision, dimension, subtype, array_type } =
		columnDefinition;

	if (canHaveLength(type) && _.isNumber(length)) {
		type = addLength(type, length);
	} else if (canHavePrecision(type) && canHaveScale(type) && _.isNumber(precision)) {
		type = addScalePrecision(type, precision, scale);
	} else if (canHavePrecision(type) && _.isNumber(precision)) {
		type = addPrecision(type, precision);
	} else if (canHaveTypeModifier(type)) {
		type = addTypeModifier({ type, typeModifier, srid });
	} else if (canHaveTimePrecision(type) && (_.isNumber(timePrecision) || timezone)) {
		type = addWithTimezone(addPrecision(type, timePrecision), timezone);
	} else if (isVector(type)) {
		const resolvedType = subtype || type;
		type = dimension ? decorateVector(resolvedType, dimension) : resolvedType;
	}

	return addArrayDecorator(type, array_type);
};

const isString = type => ['char', 'varchar', 'text', 'bit', 'varbit'].includes(type);
const isDateTime = type => ['date', 'time', 'timestamp', 'interval'].includes(type);

const decorateDefault = (type, defaultValue, isArrayType) => {
	const constantsValues = ['current_timestamp', 'current_user', 'null'];
	if ((isString(type) || isDateTime(type)) && !constantsValues.includes(_.toLower(defaultValue)) && !isArrayType) {
		return wrapComment(defaultValue);
	} else {
		return defaultValue;
	}
};

const getColumnComments = (tableName, columnDefinitions) => {
	return _.chain(columnDefinitions)
		.filter('comment')
		.map(columnData => {
			const comment = assignTemplates(templates.comment, {
				object: 'COLUMN',
				objectName: `${tableName}.${wrapInQuotes(columnData.name)}`,
				comment: wrapComment(columnData.comment),
			});

			return commentIfDeactivated(comment, columnData);
		})
		.join('\n')
		.value();
};

const TYPES_MAPPING_BY_VERSION = {
	'v13.x': {
		int4multirange: 'int4range',
		int8multirange: 'int8range',
		nummultirange: 'numrange',
		datemultirange: 'daterange',
		tsmultirange: 'tsrange',
		tstzmultirange: 'tstzrange',
	},
	'v12.x': {
		int4multirange: 'int4range',
		int8multirange: 'int8range',
		nummultirange: 'numrange',
		datemultirange: 'daterange',
		tsmultirange: 'tsrange',
		tstzmultirange: 'tstzrange',
	},
	'v11.x': {
		int4multirange: 'int4range',
		int8multirange: 'int8range',
		nummultirange: 'numrange',
		datemultirange: 'daterange',
		tsmultirange: 'tsrange',
		tstzmultirange: 'tstzrange',
	},
	'v10.x': {
		int4multirange: 'int4range',
		int8multirange: 'int8range',
		nummultirange: 'numrange',
		datemultirange: 'daterange',
		tsmultirange: 'tsrange',
		tstzmultirange: 'tstzrange',
	},
};

const replaceTypeByVersion = (type, dbVersion) => {
	const dbVersionMap = TYPES_MAPPING_BY_VERSION[dbVersion];
	const replacedType = _.get(dbVersionMap, type);

	return replacedType || type;
};

module.exports = {
	decorateType,
	decorateDefault,
	getColumnComments,
	replaceTypeByVersion,
};
