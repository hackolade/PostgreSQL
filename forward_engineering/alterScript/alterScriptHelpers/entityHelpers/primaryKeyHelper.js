const _ = require('lodash');
const { AlterScriptDto } = require('../../types/AlterScriptDto');
const {
	AlterCollectionDto,
	AlterCollectionColumnDto,
	AlterCollectionRoleCompModPKDto,
	AlterCollectionColumnKeyOptionDto,
	AlterCollectionRoleCompModPrimaryKey,
} = require('../../types/AlterCollectionDto');
const { KeyTransitionDto, KeyScriptModificationDto } = require('../../types/AlterKeyDto');
const {
	getFullCollectionName,
	getSchemaOfAlterCollection,
	getEntityName,
	wrapInQuotes,
} = require('../../../utils/general');
const { alterKeyConstraint, dropKeyConstraint } = require('../../../ddlProvider/ddlHelpers/constraintsHelper');

const amountOfColumnsInRegularPk = 1;

/**
 * @param {string} entityName
 * @return {string}
 * */
const getDefaultConstraintName = entityName => {
	return `${entityName}_pkey`;
};

/**
 * @param {AlterCollectionColumnKeyOptionDto} optionHolder
 * @return {Partial<AlterCollectionColumnKeyOptionDto>}
 * */
const extractOptionsForComparisonWithRegularPkOptions = optionHolder => {
	return {
		constraintName: optionHolder.constraintName,
		indexStorageParameters: optionHolder.indexStorageParameters,
		indexTablespace: optionHolder.indexTablespace,
		indexInclude: optionHolder.indexInclude,
	};
};

/**
 * @param {AlterCollectionColumnDto} columnJsonSchema
 * @return {Array<Partial<AlterCollectionColumnKeyOptionDto>>}
 * */
const getCustomPropertiesOfRegularPkForComparisonWithRegularPkOptions = columnJsonSchema => {
	/**
	 * @type {Array<AlterCollectionColumnKeyOptionDto>}
	 * */
	const constraintOptions = columnJsonSchema.primaryKeyOptions || [];
	return constraintOptions.map(option => extractOptionsForComparisonWithRegularPkOptions(option));
};

/**
 * @param {AlterCollectionRoleCompModPKDto} compositePk
 * @return {Array<Partial<AlterCollectionColumnKeyOptionDto>>}
 * */
const getCustomPropertiesOfCompositePkForComparisonWithRegularPkOptions = compositePk => {
	const optionsForComparison = extractOptionsForComparisonWithRegularPkOptions(compositePk);
	return [optionsForComparison].filter(o => Object.values(o).some(Boolean));
};

/**
 * @param {AlterCollectionDto} collection
 * @return {KeyTransitionDto}
 * */
const wasCompositePkChangedInTransitionFromCompositeToRegular = collection => {
	/**
	 * @type {AlterCollectionRoleCompModPrimaryKey}
	 * */
	const pkDto = collection?.role?.compMod?.primaryKey || {};
	/**
	 * @type {AlterCollectionRoleCompModPKDto[]}
	 * */
	const oldPrimaryKeys = pkDto.old || [];
	const idsOfColumns = oldPrimaryKeys.flatMap(pk => pk.compositePrimaryKey.map(dto => dto.keyId));
	if (idsOfColumns.length !== amountOfColumnsInRegularPk) {
		// We return false, because it wouldn't count as transition between regular PK and composite PK
		// if composite PK did not constraint exactly 1 column
		return KeyTransitionDto.noTransition();
	}
	const idOfPkColumn = idsOfColumns[0];
	const newColumnJsonSchema = Object.values(collection.properties).find(
		columnJsonSchema => columnJsonSchema.GUID === idOfPkColumn,
	);
	if (!newColumnJsonSchema) {
		return KeyTransitionDto.noTransition();
	}
	const isNewColumnARegularPrimaryKey = newColumnJsonSchema?.primaryKey && !newColumnJsonSchema?.compositePrimaryKey;
	if (!isNewColumnARegularPrimaryKey) {
		return KeyTransitionDto.noTransition();
	}
	const constraintOptions = getCustomPropertiesOfRegularPkForComparisonWithRegularPkOptions(newColumnJsonSchema);
	const areOptionsEqual = oldPrimaryKeys.some(compositePk => {
		if (compositePk.compositePrimaryKey.length !== amountOfColumnsInRegularPk) {
			return false;
		}
		const oldCompositePkAsRegularPkOptions =
			getCustomPropertiesOfCompositePkForComparisonWithRegularPkOptions(compositePk);
		return _(oldCompositePkAsRegularPkOptions).differenceWith(constraintOptions, _.isEqual).isEmpty();
	});

	return KeyTransitionDto.transition(!areOptionsEqual);
};

/**
 * @param {AlterCollectionDto} collection
 * @return {KeyTransitionDto}
 * */
const wasCompositePkChangedInTransitionFromRegularToComposite = collection => {
	/**
	 * @type {AlterCollectionRoleCompModPrimaryKey}
	 * */
	const pkDto = collection?.role?.compMod?.primaryKey || {};
	/**
	 * @type {AlterCollectionRoleCompModPKDto[]}
	 * */
	const newPrimaryKeys = pkDto.new || [];
	const idsOfColumns = newPrimaryKeys.flatMap(pk => pk.compositePrimaryKey.map(dto => dto.keyId));
	if (idsOfColumns.length !== amountOfColumnsInRegularPk) {
		// We return false, because it wouldn't count as transition between regular PK and composite PK
		// if composite PK does not constraint exactly 1 column
		return KeyTransitionDto.noTransition();
	}
	const idOfPkColumn = idsOfColumns[0];
	const oldColumnJsonSchema = Object.values(collection.role.properties).find(
		columnJsonSchema => columnJsonSchema.GUID === idOfPkColumn,
	);
	if (!oldColumnJsonSchema) {
		return KeyTransitionDto.noTransition();
	}
	const isOldColumnARegularPrimaryKey = oldColumnJsonSchema?.primaryKey && !oldColumnJsonSchema?.compositePrimaryKey;
	if (!isOldColumnARegularPrimaryKey) {
		return KeyTransitionDto.noTransition();
	}
	const constraintOptions = getCustomPropertiesOfRegularPkForComparisonWithRegularPkOptions(oldColumnJsonSchema);
	const areOptionsEqual = newPrimaryKeys.some(compositePk => {
		if (compositePk.compositePrimaryKey.length !== amountOfColumnsInRegularPk) {
			return false;
		}
		const oldCompositePkAsRegularPkOptions =
			getCustomPropertiesOfCompositePkForComparisonWithRegularPkOptions(compositePk);
		return _(oldCompositePkAsRegularPkOptions).differenceWith(constraintOptions, _.isEqual).isEmpty();
	});

	return KeyTransitionDto.transition(!areOptionsEqual);
};

/**
 * @param {AlterCollectionRoleCompModPKDto} primaryKey
 * @param {string} entityName
 * @return {string}
 * */
const getConstraintNameForCompositePk = (primaryKey, entityName) => {
	if (primaryKey.constraintName) {
		return primaryKey.constraintName;
	}
	return getDefaultConstraintName(entityName);
};

/**
 * @param {AlterCollectionRoleCompModPKDto} primaryKey
 * @param {string} entityName
 * @param {AlterCollectionDto} entity
 *
 * @return {{
 *   name: string,
 *   keyType: string,
 *   columns: Array<{
 *     isActivated: boolean,
 *     name: string,
 *   }>,
 *   include: Array<{
 *     isActivated: boolean,
 *     name: string,
 *   }>,
 *   storageParameters: string,
 *   tablespace: string,
 * }}
 * */
const getCreateCompositePKDDLProviderConfig = (primaryKey, entityName, entity) => {
	const constraintName = getConstraintNameForCompositePk(primaryKey, entityName);
	const pkColumns = _.toPairs(entity.role.properties)
		.filter(([name, jsonSchema]) =>
			Boolean(primaryKey.compositePrimaryKey.find(keyDto => keyDto.keyId === jsonSchema.GUID)),
		)
		.map(([name, jsonSchema]) => ({
			name,
			isActivated: jsonSchema.isActivated,
		}));

	let storageParameters = '';
	let indexTablespace = '';
	let includeColumns = [];
	if (primaryKey.indexStorageParameters) {
		storageParameters = primaryKey.indexStorageParameters;
	}
	if (primaryKey.indexTablespace) {
		indexTablespace = primaryKey.indexTablespace;
	}
	if (primaryKey.indexInclude) {
		includeColumns = _.toPairs(entity.role.properties)
			.filter(([name, jsonSchema]) =>
				Boolean(primaryKey.indexInclude.find(keyDto => keyDto.keyId === jsonSchema.GUID)),
			)
			.map(([name, jsonSchema]) => ({
				name,
				isActivated: jsonSchema.isActivated,
			}));
	}

	return {
		name: constraintName,
		keyType: 'PRIMARY KEY',
		columns: pkColumns,
		include: includeColumns,
		storageParameters,
		tablespace: indexTablespace,
	};
};

/**
 * @param {AlterCollectionDto} collection
 * @return {Array<KeyScriptModificationDto>}
 * */
const getAddCompositePkScriptDtos = collection => {
	/**
	 * @type {AlterCollectionRoleCompModPrimaryKey}
	 * */
	const pkDto = collection?.role?.compMod?.primaryKey || {};
	const newPrimaryKeys = pkDto.new || [];
	const oldPrimaryKeys = pkDto.old || [];
	if (newPrimaryKeys.length === 0 && oldPrimaryKeys.length === 0) {
		return [];
	}
	const transitionToCompositeDto = wasCompositePkChangedInTransitionFromRegularToComposite(collection);
	if (transitionToCompositeDto.didTransitionHappen && !transitionToCompositeDto.wasPkChangedInTransition) {
		return [];
	}
	if (newPrimaryKeys.length === oldPrimaryKeys.length) {
		const areKeyArraysEqual = _(oldPrimaryKeys).differenceWith(newPrimaryKeys, _.isEqual).isEmpty();
		if (areKeyArraysEqual) {
			return [];
		}
	}

	const collectionSchema = getSchemaOfAlterCollection(collection);
	const fullTableName = getFullCollectionName(collectionSchema);
	const entityName = getEntityName(collectionSchema);

	return newPrimaryKeys
		.map(newPk => {
			const ddlConfig = getCreateCompositePKDDLProviderConfig(newPk, entityName, collection);
			const statementDto = alterKeyConstraint(fullTableName, collection.isActivated, ddlConfig);
			return new KeyScriptModificationDto(statementDto.statement, fullTableName, false, statementDto.isActivated);
		})
		.filter(scriptDto => Boolean(scriptDto.script));
};

/**
 * @param {AlterCollectionDto} collection
 * @return {Array<KeyScriptModificationDto>}
 * */
const getDropCompositePkScriptDtos = collection => {
	const pkDto = collection?.role?.compMod?.primaryKey || {};
	const newPrimaryKeys = pkDto.new || [];
	const oldPrimaryKeys = pkDto.old || [];
	if (newPrimaryKeys.length === 0 && oldPrimaryKeys.length === 0) {
		return [];
	}
	const transitionToCompositeDto = wasCompositePkChangedInTransitionFromCompositeToRegular(collection);
	if (transitionToCompositeDto.didTransitionHappen && !transitionToCompositeDto.wasPkChangedInTransition) {
		return [];
	}
	if (newPrimaryKeys.length === oldPrimaryKeys.length) {
		const areKeyArraysEqual = _(oldPrimaryKeys).differenceWith(newPrimaryKeys, _.isEqual).isEmpty();
		if (areKeyArraysEqual) {
			return [];
		}
	}

	const collectionSchema = getSchemaOfAlterCollection(collection);
	const fullTableName = getFullCollectionName(collectionSchema);
	const entityName = getEntityName(collectionSchema);

	return oldPrimaryKeys
		.map(oldPk => {
			let constraintName = getDefaultConstraintName(entityName);
			if (oldPk.constraintName) {
				constraintName = oldPk.constraintName;
			}
			const ddlConstraintName = wrapInQuotes(constraintName);
			const script = dropKeyConstraint(fullTableName, ddlConstraintName);
			return new KeyScriptModificationDto(script, fullTableName, true, collection.isActivated);
		})
		.filter(scriptDto => Boolean(scriptDto.script));
};

/**
 * @param {AlterCollectionDto} collection
 * @return {Array<KeyScriptModificationDto>}
 * */
const getModifyCompositePkScriptDtos = collection => {
	const dropCompositePkScriptDtos = getDropCompositePkScriptDtos(collection);
	const addCompositePkScriptDtos = getAddCompositePkScriptDtos(collection);

	return [...dropCompositePkScriptDtos, ...addCompositePkScriptDtos].filter(Boolean);
};

/**
 * @param {AlterCollectionColumnDto} columnJsonSchema
 * @param {string} entityName
 * @return {string}
 * */
const getConstraintNameForRegularPk = (columnJsonSchema, entityName) => {
	const constraintOptions = columnJsonSchema.primaryKeyOptions;
	if (constraintOptions?.length && constraintOptions?.length > 0) {
		/**
		 * @type {AlterCollectionColumnKeyOptionDto}
		 * */
		const constraintOption = constraintOptions[0];
		if (constraintOption.constraintName) {
			return constraintOption.constraintName;
		}
	}
	return getDefaultConstraintName(entityName);
};

/**
 * @param {string} columnName
 * @param {AlterCollectionColumnDto} columnJsonSchema
 * @param {string} entityName
 * @param {AlterCollectionDto} entity
 * @return {{
 *   name: string,
 *   keyType: string,
 *   columns: Array<{
 *     isActivated: boolean,
 *     name: string,
 *   }>,
 *   include: Array<{
 *     isActivated: boolean,
 *     name: string,
 *   }>,
 *   storageParameters: string,
 *   tablespace: string,
 * }}
 * */
const getCreateRegularPKDDLProviderConfig = (columnName, columnJsonSchema, entityName, entity) => {
	const constraintName = getConstraintNameForRegularPk(columnJsonSchema, entityName);
	const pkColumns = [
		{
			name: columnName,
			isActivated: columnJsonSchema.isActivated,
		},
	];

	let storageParameters = '';
	let indexTablespace = '';
	let includeColumns = [];
	const constraintOptions = columnJsonSchema.primaryKeyOptions;
	if (constraintOptions?.length && constraintOptions?.length > 0) {
		/**
		 * @type {AlterCollectionColumnKeyOptionDto}
		 * */
		const constraintOption = constraintOptions[0];
		if (constraintOption.indexStorageParameters) {
			storageParameters = constraintOption.indexStorageParameters;
		}
		if (constraintOption.indexTablespace) {
			indexTablespace = constraintOption.indexTablespace;
		}
		if (constraintOption.indexInclude) {
			includeColumns = _.toPairs(entity.role.properties)
				.filter(([name, jsonSchema]) =>
					Boolean(constraintOption.indexInclude.find(keyDto => keyDto.keyId === jsonSchema.GUID)),
				)
				.map(([name, jsonSchema]) => ({
					name,
					isActivated: jsonSchema.isActivated,
				}));
		}
	}

	return {
		name: constraintName,
		keyType: 'PRIMARY KEY',
		columns: pkColumns,
		include: includeColumns,
		storageParameters,
		tablespace: indexTablespace,
	};
};

/**
 * @param {AlterCollectionColumnDto} columnJsonSchema
 * @param {AlterCollectionDto} collection
 * @return {boolean}
 * */
const wasFieldChangedToBeARegularPk = (columnJsonSchema, collection) => {
	const oldName = columnJsonSchema.compMod.oldField.name;
	const oldColumnJsonSchema = collection.role.properties[oldName];

	const isRegularPrimaryKey = columnJsonSchema.primaryKey && !columnJsonSchema.compositePrimaryKey;
	const wasTheFieldAnyPrimaryKey = Boolean(oldColumnJsonSchema?.primaryKey);

	return isRegularPrimaryKey && !wasTheFieldAnyPrimaryKey;
};

/**
 * @param {AlterCollectionColumnDto} columnJsonSchema
 * @param {AlterCollectionDto} collection
 * @return {KeyTransitionDto}
 * */
const wasRegularPkChangedInTransitionFromCompositeToRegular = (columnJsonSchema, collection) => {
	const oldName = columnJsonSchema.compMod.oldField.name;
	const oldColumnJsonSchema = collection.role.properties[oldName];

	const isRegularPrimaryKey = columnJsonSchema.primaryKey && !columnJsonSchema.compositePrimaryKey;
	const wasTheFieldAnyPrimaryKey = Boolean(oldColumnJsonSchema?.primaryKey);

	if (!(isRegularPrimaryKey && wasTheFieldAnyPrimaryKey)) {
		return KeyTransitionDto.noTransition();
	}

	/**
	 * @type {AlterCollectionRoleCompModPrimaryKey}
	 * */
	const pkDto = collection?.role?.compMod?.primaryKey || {};
	const newPrimaryKeys = pkDto.new || [];
	/**
	 * @type {AlterCollectionRoleCompModPKDto[]}
	 * */
	const oldPrimaryKeys = pkDto.old || [];
	const wasTheFieldACompositePrimaryKey = oldPrimaryKeys.some(compPk =>
		compPk.compositePrimaryKey.some(pk => pk.keyId === oldColumnJsonSchema.GUID),
	);
	const isTheFieldACompositePrimaryKey = newPrimaryKeys.some(compPk =>
		compPk.compositePrimaryKey.some(pk => pk.keyId === columnJsonSchema.GUID),
	);

	const wasCompositePkRemoved = wasTheFieldACompositePrimaryKey && !isTheFieldACompositePrimaryKey;

	if (isRegularPrimaryKey && wasCompositePkRemoved) {
		// return compare custom properties and amount of columns.
		// If there was a transition and amount of composite PK columns is not equal
		// to amount of regular pk columns, we must recreate PK
		const constraintOptions = getCustomPropertiesOfRegularPkForComparisonWithRegularPkOptions(columnJsonSchema);
		const areOptionsEqual = oldPrimaryKeys.some(oldCompositePk => {
			if (oldCompositePk.compositePrimaryKey.length !== amountOfColumnsInRegularPk) {
				return false;
			}
			const oldCompositePkAsRegularPkOptions =
				getCustomPropertiesOfCompositePkForComparisonWithRegularPkOptions(oldCompositePk);
			return _(oldCompositePkAsRegularPkOptions).differenceWith(constraintOptions, _.isEqual).isEmpty();
		});
		return KeyTransitionDto.transition(!areOptionsEqual);
	}

	return KeyTransitionDto.noTransition();
};

/**
 * @param {AlterCollectionColumnDto} columnJsonSchema
 * @param {AlterCollectionDto} collection
 * @return {KeyTransitionDto}
 * */
const wasRegularPkChangedInTransitionFromRegularToComposite = (columnJsonSchema, collection) => {
	const oldName = columnJsonSchema.compMod.oldField.name;
	const oldColumnJsonSchema = collection.role.properties[oldName];

	const wasRegularPrimaryKey = oldColumnJsonSchema.primaryKey && !oldColumnJsonSchema.compositePrimaryKey;
	const isTheFieldAnyPrimaryKey = Boolean(columnJsonSchema?.primaryKey);

	if (!(wasRegularPrimaryKey && isTheFieldAnyPrimaryKey)) {
		return KeyTransitionDto.noTransition();
	}

	/**
	 * @type {AlterCollectionRoleCompModPrimaryKey}
	 * */
	const pkDto = collection?.role?.compMod?.primaryKey || {};
	const newPrimaryKeys = pkDto.new || [];
	/**
	 * @type {AlterCollectionRoleCompModPKDto[]}
	 * */
	const oldPrimaryKeys = pkDto.old || [];
	const wasTheFieldACompositePrimaryKey = oldPrimaryKeys.some(compPk =>
		compPk.compositePrimaryKey.some(pk => pk.keyId === oldColumnJsonSchema.GUID),
	);
	const isTheFieldACompositePrimaryKey = newPrimaryKeys.some(compPk =>
		compPk.compositePrimaryKey.some(pk => pk.keyId === columnJsonSchema.GUID),
	);

	const wasCompositePkAdded = isTheFieldACompositePrimaryKey && !wasTheFieldACompositePrimaryKey;

	if (wasRegularPrimaryKey && wasCompositePkAdded) {
		// return compare custom properties and amount of columns.
		// If there was a transition and amount of composite PK columns is not equal
		// to amount of regular pk columns, we must recreate PK
		const constraintOptions = getCustomPropertiesOfRegularPkForComparisonWithRegularPkOptions(oldColumnJsonSchema);
		const areOptionsEqual = newPrimaryKeys.some(oldCompositePk => {
			if (oldCompositePk.compositePrimaryKey.length !== amountOfColumnsInRegularPk) {
				return false;
			}
			const oldCompositePkAsRegularPkOptions =
				getCustomPropertiesOfCompositePkForComparisonWithRegularPkOptions(oldCompositePk);
			return _(oldCompositePkAsRegularPkOptions).differenceWith(constraintOptions, _.isEqual).isEmpty();
		});
		return KeyTransitionDto.transition(!areOptionsEqual);
	}

	return KeyTransitionDto.noTransition();
};

/**
 * @param {AlterCollectionColumnDto} columnJsonSchema
 * @param {AlterCollectionDto} collection
 * @return {boolean}
 * */
const isFieldNoLongerARegularPk = (columnJsonSchema, collection) => {
	const oldName = columnJsonSchema.compMod.oldField.name;

	const oldJsonSchema = collection.role.properties[oldName];
	const wasTheFieldARegularPrimaryKey = oldJsonSchema?.primaryKey && !oldJsonSchema?.compositePrimaryKey;

	const isNotAnyPrimaryKey = !columnJsonSchema.primaryKey && !columnJsonSchema.compositePrimaryKey;
	return wasTheFieldARegularPrimaryKey && isNotAnyPrimaryKey;
};

/**
 * @param {AlterCollectionColumnDto} columnJsonSchema
 * @param {AlterCollectionDto} collection
 * @return {boolean}
 * */
const wasRegularPkModified = (columnJsonSchema, collection) => {
	const oldName = columnJsonSchema.compMod.oldField.name;
	const oldJsonSchema = collection.role.properties[oldName] || {};

	const isRegularPrimaryKey = columnJsonSchema.primaryKey && !columnJsonSchema.compositePrimaryKey;
	const wasTheFieldARegularPrimaryKey = oldJsonSchema?.primaryKey && !oldJsonSchema?.compositePrimaryKey;

	if (!(isRegularPrimaryKey && wasTheFieldARegularPrimaryKey)) {
		return false;
	}
	const constraintOptions = getCustomPropertiesOfRegularPkForComparisonWithRegularPkOptions(columnJsonSchema);
	const oldConstraintOptions = getCustomPropertiesOfRegularPkForComparisonWithRegularPkOptions(oldJsonSchema);
	const areOptionsEqual = _(oldConstraintOptions).differenceWith(constraintOptions, _.isEqual).isEmpty();
	return !areOptionsEqual;
};

/**
 * @param {AlterCollectionDto} collection
 * @return {Array<KeyScriptModificationDto>}
 * */
const getAddPkScriptDtos = collection => {
	const collectionSchema = getSchemaOfAlterCollection(collection);
	const fullTableName = getFullCollectionName(collectionSchema);
	const entityName = getEntityName(collectionSchema);

	return _.toPairs(collection.properties)
		.filter(([name, jsonSchema]) => {
			if (wasFieldChangedToBeARegularPk(jsonSchema, collection)) {
				return true;
			}
			const transitionToRegularDto = wasRegularPkChangedInTransitionFromCompositeToRegular(
				jsonSchema,
				collection,
			);
			if (transitionToRegularDto.didTransitionHappen) {
				return transitionToRegularDto.wasPkChangedInTransition;
			}
			return wasRegularPkModified(jsonSchema, collection);
		})
		.map(([name, jsonSchema]) => {
			const ddlConfig = getCreateRegularPKDDLProviderConfig(name, jsonSchema, entityName, collection);
			const statementDto = alterKeyConstraint(fullTableName, collection.isActivated, ddlConfig);
			return new KeyScriptModificationDto(statementDto.statement, fullTableName, false, statementDto.isActivated);
		})
		.filter(scriptDto => Boolean(scriptDto.script));
};

/**
 * @param {AlterCollectionDto} collection
 * @return {Array<KeyScriptModificationDto>}
 * */
const getDropPkScriptDto = collection => {
	const collectionSchema = getSchemaOfAlterCollection(collection);
	const fullTableName = getFullCollectionName(collectionSchema);
	const entityName = getEntityName(collectionSchema);

	return _.toPairs(collection.properties)
		.filter(([name, jsonSchema]) => {
			if (isFieldNoLongerARegularPk(jsonSchema, collection)) {
				return true;
			}
			const transitionToRegularDto = wasRegularPkChangedInTransitionFromRegularToComposite(
				jsonSchema,
				collection,
			);
			if (transitionToRegularDto.didTransitionHappen) {
				return transitionToRegularDto.wasPkChangedInTransition;
			}
			return wasRegularPkModified(jsonSchema, collection);
		})
		.map(([name, jsonSchema]) => {
			const oldName = jsonSchema.compMod.oldField.name;
			const oldJsonSchema = collection.role.properties[oldName];
			const ddlConstraintName = wrapInQuotes(getConstraintNameForRegularPk(oldJsonSchema, entityName));

			const script = dropKeyConstraint(fullTableName, ddlConstraintName);
			return new KeyScriptModificationDto(script, fullTableName, true, collection.isActivated);
		})
		.filter(scriptDto => Boolean(scriptDto.script));
};

/**
 * @param {AlterCollectionDto} collection
 * @return {Array<KeyScriptModificationDto>}
 * */
const getModifyPkScriptDtos = collection => {
	const dropPkScriptDtos = getDropPkScriptDto(collection);
	const addPkScriptDtos = getAddPkScriptDtos(collection);

	return [...dropPkScriptDtos, ...addPkScriptDtos].filter(Boolean);
};

/**
 * @param {KeyScriptModificationDto[]} constraintDtos
 * @return {KeyScriptModificationDto[]}
 * */
const sortModifyPkConstraints = constraintDtos => {
	return constraintDtos.sort((c1, c2) => {
		if (c1.fullTableName === c2.fullTableName) {
			// Number(true) = 1, Number(false) = 0;
			// This ensures that DROP script appears before CREATE script
			// if the same table has 2 scripts that drop and recreate PK
			return Number(c2.isDropScript) - Number(c1.isDropScript);
		}
		// This sorts all statements based on full table name, ASC
		return c1.fullTableName < c2.fullTableName;
	});
};

/**
 * @param {AlterCollectionDto} collection
 * @return {Array<AlterScriptDto>}
 * */
const getModifyPkConstraintsScriptDtos = collection => {
	const modifyCompositePkScriptDtos = getModifyCompositePkScriptDtos(collection);
	const modifyPkScriptDtos = getModifyPkScriptDtos(collection);

	const allDtos = [...modifyCompositePkScriptDtos, ...modifyPkScriptDtos];
	const sortedAllDtos = sortModifyPkConstraints(allDtos);

	return sortedAllDtos
		.map(dto => {
			return AlterScriptDto.getInstance([dto.script], dto.isActivated, dto.isDropScript);
		})
		.filter(Boolean);
};

module.exports = {
	getModifyPkConstraintsScriptDtos,
};
