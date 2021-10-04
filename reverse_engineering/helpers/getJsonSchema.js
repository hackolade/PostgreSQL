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

    return { properties };
};

module.exports = {
    getJsonSchema,
};
