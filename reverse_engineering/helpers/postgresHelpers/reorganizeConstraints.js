const reorganizeConstraints = (attributes, entityLevel) => {
	return [reorganizePrimaryKeys, reorganizeUniqueKeys].reduce(
		({ attributes, entityLevel }, reorganize) => reorganize(attributes, entityLevel),
		{ attributes, entityLevel },
	);
};

const reorganizePrimaryKeys = (attributes, entityLevel) => {
	const isSinglePrimaryKey = entityLevel.primaryKey?.[0]?.compositePrimaryKey?.length !== 1;

	if (isSinglePrimaryKey) {
		return { attributes, entityLevel };
	}

	const primaryKey = entityLevel.primaryKey[0];
	const attributeName = primaryKey.compositePrimaryKey[0];

	return {
		attributes: setAttributesPrimaryKeyData(attributes, attributeName, primaryKey),
		entityLevel: clearPrimaryKeys(entityLevel),
	};
};

const reorganizeUniqueKeys = (attributes, entityLevel) => {
	return (entityLevel.uniqueKey || []).reduce(
		({ attributes, entityLevel }, uniqueKey) => {
			const hasSingleUniqueKey = uniqueKey.compositeUniqueKey.length === 1;
			if (!hasSingleUniqueKey) {
				return { attributes, entityLevel };
			}

			const attributeName = uniqueKey.compositeUniqueKey[0];

			return {
				attributes: setAttributesUniqueKeyData(attributes, attributeName, uniqueKey),
				entityLevel: filterUniqueKeys(entityLevel, uniqueKey),
			};
		},
		{ attributes, entityLevel },
	);
};

const setAttributesPrimaryKeyData = (attributes, attributeName, primaryKey) => {
	return attributes.map(attribute => {
		if (attribute.name !== attributeName) {
			return attribute;
		}

		return setPrimaryKeyData(attribute, primaryKey);
	});
};

const setPrimaryKeyData = (attribute, primaryKey) => {
	return {
		...attribute,
		primaryKey: true,
		primaryKeyOptions: getOptions(primaryKey),
	};
};

const setAttributesUniqueKeyData = (attributes, attributeName, uniqueKey) => {
	return attributes.map(attribute => {
		if (attribute.name !== attributeName) {
			return attribute;
		}

		return setUniqueKeyData(attribute, uniqueKey);
	});
};

const setUniqueKeyData = (attribute, uniqueKey) => {
	return {
		...attribute,
		unique: true,
		uniqueKeyOptions: getOptions(uniqueKey),
	};
};

const getOptions = key => {
	return [
		{
			constraintName: key.constraintName,
			indexInclude: key.indexInclude,
			indexStorageParameters: key.indexStorageParameters,
			indexTablespace: key.indexTablespace,
			indexComment: key.indexComment,
		},
	];
};

const clearPrimaryKeys = entityLevel => {
	return { ...entityLevel, primaryKey: [] };
};

const filterUniqueKeys = (entityLevel, uniqueKey) => {
	const filteredKeys = entityLevel.uniqueKey.filter(key => key.constraintName !== uniqueKey.constraintName);

	return { ...entityLevel, uniqueKey: filteredKeys };
};

module.exports = { reorganizeConstraints };
