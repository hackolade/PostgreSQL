module.exports = (_, clean) => {
	const mapProperties = (jsonSchema, iteratee) => {
		return Object.entries(jsonSchema.properties).map(iteratee);
	};

	const isUniqueKey = column => {
		if (column.compositeUniqueKey) {
			return false;
		} else if (!column.unique) {
			return false;
		} else {
			return true;
		}
	};

	const isInlineUnique = column => {
		return (
			isUniqueKey(column) &&
			((column.uniqueKeyOptions?.length === 1 && !_.first(column.uniqueKeyOptions)?.constraintName) ||
				_.isEmpty(column.uniqueKeyOptions))
		);
	};

	const isPrimaryKey = column => {
		if (column.compositeUniqueKey) {
			return false;
		} else if (column.compositePrimaryKey) {
			return false;
		} else if (!column.primaryKey) {
			return false;
		} else {
			return true;
		}
	};

	const isInlinePrimaryKey = column => {
		return isPrimaryKey(column) && !_.first(column.primaryKeyOptions)?.constraintName;
	};

	const getUniqueKeyType = (options, dbVersion) => {
		const nullsDistinct = options['nullsDistinct'];
		const nullsDistinctExist = dbVersion >= 15 && nullsDistinct;

		return `UNIQUE${nullsDistinctExist ? ` ${nullsDistinct}` : ''}`;
	};

	const hydrateUniqueOptions = ({ options, columnName, isActivated, jsonSchema, dbVersion }) =>
		clean({
			keyType: getUniqueKeyType(options, dbVersion),
			name: options['constraintName'],
			columns: [
				{
					name: columnName,
					isActivated: isActivated,
				},
			],
			include: getKeys(options['indexInclude'] || [], jsonSchema),
			storageParameters: options['indexStorageParameters'],
			comment: options['indexComment'],
			tablespace: options['indexTablespace'],
			nullsDistinct: options['nullsDistinct'],
		});

	const hydratePrimaryKeyOptions = (options, columnName, isActivated, jsonSchema) =>
		clean({
			keyType: 'PRIMARY KEY',
			name: options['constraintName'],
			columns: [
				{
					name: columnName,
					isActivated: isActivated,
				},
			],
			include: getKeys(options['indexInclude'] || [], jsonSchema),
			storageParameters: options['indexStorageParameters'],
			comment: options['indexComment'],
			tablespace: options['indexTablespace'],
		});

	const findName = (keyId, properties) => {
		return Object.keys(properties).find(name => properties[name].GUID === keyId);
	};

	const checkIfActivated = (keyId, properties) => {
		return _.get(
			Object.values(properties).find(prop => prop.GUID === keyId),
			'isActivated',
			true,
		);
	};

	const getKeys = (keys, jsonSchema) => {
		return _.map(keys, key => {
			return {
				name: findName(key.keyId, jsonSchema.properties),
				isActivated: checkIfActivated(key.keyId, jsonSchema.properties),
			};
		});
	};

	const getCompositePrimaryKeys = jsonSchema => {
		if (!Array.isArray(jsonSchema.primaryKey)) {
			return [];
		}

		return jsonSchema.primaryKey.map(primaryKey =>
			!_.isEmpty(primaryKey.compositePrimaryKey)
				? {
						...hydratePrimaryKeyOptions(primaryKey, null, null, jsonSchema),
						columns: getKeys(primaryKey.compositePrimaryKey, jsonSchema),
				  }
				: {
						name: primaryKey.constraintName,
						errorMessage: 'A primary key constraint cannot be created without any primary key selected',
				  },
		);
	};

	const getCompositeUniqueKeys = (jsonSchema, dbVersion) => {
		if (!Array.isArray(jsonSchema.uniqueKey)) {
			return [];
		}

		return jsonSchema.uniqueKey.map(uniqueKey =>
			!_.isEmpty(uniqueKey.compositeUniqueKey)
				? {
						...hydrateUniqueOptions({
							options: uniqueKey,
							columnName: null,
							isActivated: null,
							jsonSchema,
							dbVersion,
						}),
						columns: getKeys(uniqueKey.compositeUniqueKey, jsonSchema),
				  }
				: {
						name: uniqueKey.constraintName,
						errorMessage: 'A unique key constraint cannot be created without any unique key selected',
				  },
		);
	};

	const getTableKeyConstraints = (jsonSchema, dbVersion) => {
		if (!jsonSchema.properties) {
			return [];
		}

		const primaryKeyConstraints = mapProperties(jsonSchema, ([name, schema]) => {
			if (!isPrimaryKey(schema) || isInlinePrimaryKey(schema)) {
				return;
			}

			return hydratePrimaryKeyOptions(_.first(schema.primaryKeyOptions), name, schema.isActivated, jsonSchema);
		}).filter(Boolean);

		const uniqueKeyConstraints = _.flatten(
			mapProperties(jsonSchema, ([name, schema]) => {
				if (!isUniqueKey(schema) || isInlineUnique(schema)) {
					return [];
				}

				return (schema.uniqueKeyOptions || []).map(uniqueKey =>
					hydrateUniqueOptions({
						options: uniqueKey,
						columnName: name,
						isActivated: schema.isActivated,
						jsonSchema,
						dbVersion,
					}),
				);
			}),
		).filter(Boolean);

		return [
			...primaryKeyConstraints,
			...getCompositePrimaryKeys(jsonSchema),
			...uniqueKeyConstraints,
			...getCompositeUniqueKeys(jsonSchema, dbVersion),
		];
	};

	return {
		getTableKeyConstraints,
		isInlineUnique,
		isInlinePrimaryKey,
		getKeys,
		hydratePrimaryKeyOptions,
		hydrateUniqueOptions,
	};
};
