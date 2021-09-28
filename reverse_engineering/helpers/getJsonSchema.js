const getJsonSchema = (columns) => {
    const properties = columns.reduce((properties, column) => {
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
