module.exports = _ => {
	const createColumnDefinition = data => {
		return Object.assign(
			{
				name: '',
				type: '',
				nullable: true,
				primaryKey: false,
				default: '',
				length: '',
				scale: '',
				precision: '',
				hasMaxLength: false,
			},
			data,
		);
	};

	const isNullable = (parentSchema, propertyName) => {
		if (!Array.isArray(parentSchema.required)) {
			return true;
		}

		return !parentSchema.required.includes(propertyName);
	};

	const getDefault = jsonSchema => {
		const defaultValue = jsonSchema.default;

		if (_.isBoolean(defaultValue)) {
			return defaultValue;
		} else if (jsonSchema.default === null) {
			return 'NULL';
		} else {
			return defaultValue;
		}
	};

	const getLength = jsonSchema => {
		if (_.isNumber(jsonSchema.length)) {
			return jsonSchema.length;
		} else if (_.isNumber(jsonSchema.maxLength)) {
			return jsonSchema.maxLength;
		} else {
			return '';
		}
	};

	const getScale = jsonSchema => {
		if (_.isNumber(jsonSchema.scale)) {
			return jsonSchema.scale;
		} else {
			return '';
		}
	};

	const getPrecision = jsonSchema => {
		if (_.isNumber(jsonSchema.precision)) {
			return jsonSchema.precision;
		} else if (_.isNumber(jsonSchema.fractSecPrecision)) {
			return jsonSchema.fractSecPrecision;
		} else {
			return '';
		}
	};

	const hasMaxLength = jsonSchema => {
		if (jsonSchema.hasMaxLength) {
			return jsonSchema.hasMaxLength;
		} else {
			return '';
		}
	};

	const getType = jsonSchema => {
		if (jsonSchema.$ref) {
			return jsonSchema.$ref.split('/').pop();
		}

		return jsonSchema.mode || jsonSchema.childType || jsonSchema.type;
	};

	const createColumnDefinitionBySchema = ({ name, jsonSchema, parentJsonSchema, ddlProvider, schemaData }) => {
		const columnDefinition = createColumnDefinition({
			name: name,
			type: getType(jsonSchema),
			nullable: isNullable(parentJsonSchema, name),
			default: getDefault(jsonSchema),
			primaryKey: jsonSchema.primaryKey,
			length: getLength(jsonSchema),
			scale: getScale(jsonSchema),
			precision: getPrecision(jsonSchema),
			hasMaxLength: hasMaxLength(jsonSchema),
			isActivated: jsonSchema.isActivated,
		});

		return ddlProvider.hydrateColumn({
			columnDefinition,
			jsonSchema,
			schemaData,
		});
	};

	return {
		createColumnDefinitionBySchema,
	};
};
