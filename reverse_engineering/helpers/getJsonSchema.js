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
