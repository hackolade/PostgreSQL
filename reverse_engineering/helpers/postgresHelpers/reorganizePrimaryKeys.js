const reorganizePrimaryKeys = (attributes, entityLevel) => {
	if (entityLevel.primaryKey?.[0]?.compositePrimaryKey?.length !== 1) {
		return { attributes, entityLevel };
	}

	const primaryKey = entityLevel.primaryKey[0];
	const primaryKeyAttributeName = primaryKey.compositePrimaryKey[0];
	const attributesWithPk = attributes.map(attribute => {
		if (attribute.name !== primaryKeyAttributeName) {
			return attribute;
		}

		return setPrimaryKeyData(attribute, primaryKey);
	});

	const filteredEntityLevel = { ...entityLevel, primaryKey: [] };

	return { attributes: attributesWithPk, entityLevel: filteredEntityLevel };
};

const setPrimaryKeyData = (attribute, primaryKey) => {
	return {
		...attribute,
		primaryKey: true,
		primaryKeyOptions: [
			{
				constraintName: primaryKey.constraintName,
				indexInclude: primaryKey.include,
				indexStorageParameters: primaryKey.indexStorageParameters,
				indexTablespace: primaryKey.indexTablespace,
				indexComment: primaryKey.indexComment,
			},
		],
	};
};

module.exports = { reorganizePrimaryKeys };
