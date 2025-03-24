const _ = require('lodash');
const { isVector } = require('../../forward_engineering/ddlProvider/ddlHelpers/typeHelper');

const getJsonSchema = columns => {
	const properties = columns.reduce((properties, column) => {
		if (column.properties) {
			return {
				...properties,
				[column.name]: {
					...column,
					...getJsonSchema(column.properties),
				},
			};
		}

		if (isVector(column.type)) {
			return {
				...properties,
				[column.name]: {
					...column,
					items: _.fill(Array(column.dimension), { type: 'number', mode: 'real' }),
				},
			};
		}

		return {
			...properties,
			[column.name]: column,
		};
	}, {});

	const required = Object.entries(properties)
		.filter(([filedName, field]) => field.required)
		.map(([fieldName]) => fieldName);

	return { properties, required };
};

module.exports = {
	getJsonSchema,
};
