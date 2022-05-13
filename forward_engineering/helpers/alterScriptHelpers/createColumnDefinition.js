module.exports = app => {
	const { createColumnDefinition } = app.require('@hackolade/ddl-fe-utils');

	const getType = jsonSchema => {
		if (jsonSchema.$ref) {
			return jsonSchema.$ref.split('/').pop();
		}

		return jsonSchema.mode || jsonSchema.childType || jsonSchema.type;
	};

	const createColumnDefinitionBySchema = ({
		name,
		jsonSchema,
		parentJsonSchema,
		ddlProvider,
		schemaData,
		definitionJsonSchema,
	}) => {
		return createColumnDefinition({
			name,
			jsonSchema,
			parentJsonSchema,
			ddlProvider,
			schemaData,
			definitionJsonSchema,
			getType,
		});
	};

	return {
		createColumnDefinitionBySchema,
	};
};
