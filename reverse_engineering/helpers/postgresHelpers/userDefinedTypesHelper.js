const { mapColumnData } = require('./columnHelper');

let _ = null;

const setDependencies = app => {
	_ = app.require('lodash');
};

const getUserDefinedTypes = (udtResponse, domainTypes) => {
	return _.chain(udtResponse)
		.map(typeData => {
			switch (typeData.type) {
				case 'e':
					return getEnumType(typeData);
				case 'r':
					return getRangeType(typeData);
				case 'c':
					return getCompositeType(typeData);
				default:
					return null;
			}
		})
		.compact()
		.concat(_.map(domainTypes, mapDomainType))
		.value();
};

const getEnumType = typeData => {
	return {
		name: typeData.name,
		type: 'enum',
		enum: typeData.enum_values || [],
	};
};

const getRangeType = typeData => {
	return {
		name: typeData.name,
		type: 'range_udt',
		rangeSubtype: typeData.range_subtype || '',
		operatorClass: typeData.range_opclass_name || '',
		collation: typeData.range_collation_name || '',
		canonicalFunction: typeData.range_canonical_proc || '',
		subtypeDiffFunction: typeData.range_diff_proc || '',
	};
};

const getCompositeType = typeData => {
	const columns = _.map(typeData.columns, mapColumnData([]));

	return {
		name: typeData.name,
		type: 'composite',
		properties: columns,
	};
};

const isTypeComposite = typeData => typeData.type === 'c';

const mapDomainType = domain => {
	return {
		name: domain.domain_name,
		type: 'domain',
		underlyingType: _.flow(
			setLength(domain),
			setPrecisionAndScale(domain),
			setIntervalType(domain),
			setIntervalPrecision(domain),
		)(getUnderlyingType(domain)),
		collation: domain.collation_name || '',
		default: domain.domain_default || '',
		required: _.first(domain.constraints)?.not_null,
		checkConstraints: _.map(domain.constraints, mapDomainConstraint),
	};
};

const getUnderlyingType = domain => {
	if (domain.data_type === 'USER-DEFINED') {
		return domain.udt_name;
	}

	return domain.data_type;
};

const setLength = domain => type => {
	if (domain.character_maximum_length) {
		return `${type}(${domain.character_maximum_length})`;
	}

	return type;
};

const setPrecisionAndScale = domain => type => {
	if (type !== 'numeric') {
		return type;
	}

	if (_.isNumber(domain.numeric_precision) && _.isNumber(domain.numeric_scale)) {
		return `${type}(${domain.numeric_precision},${domain.numeric_scale})`;
	}

	if (_.isNumber(domain.numeric_precision)) {
		return `${type}(${domain.numeric_precision})`;
	}

	return type;
};

const setIntervalType = domain => type => {
	if (domain.interval_type) {
		return `${type} ${domain.interval_type}`;
	}

	return type;
};

const setIntervalPrecision = domain => type => {
	if (_.isNumber(domain.interval_precision)) {
		return `${type}(${domain.interval_precision})`;
	}

	return type;
};

const mapDomainConstraint = constraint => {
	return {
		name: constraint.constraint_name,
		expression: constraint.expression,
	};
};

module.exports = {
	setDependencies,
	getUserDefinedTypes,
	isTypeComposite,
};
