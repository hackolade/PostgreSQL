const { AlterScriptDto } = require('../../types/AlterScriptDto');
const {
	AlterCollectionDto,
	AlterCollectionColumnDto,
	AlterCollectionRoleCompModUniqueKeyDto,
	AlterCollectionColumnKeyOptionDto,
	AlterCollectionRoleCompModUniqueKey,
} = require('../../types/AlterCollectionDto');
const { KeyTransitionDto, KeyScriptModificationDto } = require('../../types/AlterKeyDto');

const amountOfColumnsInRegularUniqueKey = 1;

/**
 * @param {string} entityName
 * @return {string}
 * */
const getDefaultConstraintName = entityName => {
	return `${entityName}_ukey`;
};

/**
 * @param {AlterCollectionColumnKeyOptionDto} optionHolder
 * @return {Partial<AlterCollectionColumnKeyOptionDto}
 * */
const extractOptionsForComparisonWithRegularUniqueKeyOptions = optionHolder => {
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
const getCustomPropertiesOfRegularUniqueKeyForComparisonWithRegularUniqueKeyOptions = columnJsonSchema => {
	/**
	 * @type {Array<AlterCollectionColumnKeyOptionDto>}
	 * */
	const constraintOptions = columnJsonSchema.uniqueKeyOptions || [];
	return constraintOptions.map(option => extractOptionsForComparisonWithRegularUniqueKeyOptions(option));
};

/**
 * @param {AlterCollectionRoleCompModUniqueKeyDto} compositeUniqueKey
 * @return {Array<Partial<AlterCollectionColumnKeyOptionDto>>}
 * */
const getCustomPropertiesOfCompositeUniqueKeyForComparisonWithRegularUniqueKeyOptions = compositeUniqueKey => {
	const optionsForComparison = extractOptionsForComparisonWithRegularUniqueKeyOptions(compositeUniqueKey);
	return [optionsForComparison].filter(o => Object.values(o).some(Boolean));
};

/**
 * @return {(collection: AlterCollectionDto) => KeyTransitionDto}
 * */
const wasCompositeUniqueKeyChangedInTransitionFromCompositeToRegular = _ => collection => {
	/**
	 * @type {AlterCollectionRoleCompModUniqueKey}
	 * */
	const uniqueDto = collection?.role?.compMod?.uniqueKey || {};
	/**
	 * @type {AlterCollectionRoleCompModUniqueKeyDto[]}
	 * */
	const oldUniqueKeys = uniqueDto.old || [];
	const idsOfColumns = oldUniqueKeys.flatMap(unique => unique.compositeUniqueKey.map(dto => dto.keyId));
	if (idsOfColumns.length !== amountOfColumnsInRegularUniqueKey) {
		// We return false, because it wouldn't count as transition between regular UniqueKey and composite UniqueKey
		// if composite UniqueKey did not constraint exactly 1 column
		return KeyTransitionDto.noTransition();
	}
	const idOfUniqueKeyColumn = idsOfColumns[0];
	const newColumnJsonSchema = Object.values(collection.properties).find(
		columnJsonSchema => columnJsonSchema.GUID === idOfUniqueKeyColumn,
	);
	if (!newColumnJsonSchema) {
		return KeyTransitionDto.noTransition();
	}
	const isNewColumnARegularUniqueKey = newColumnJsonSchema?.unique && !newColumnJsonSchema?.compositeUniqueKey;
	if (!isNewColumnARegularUniqueKey) {
		return KeyTransitionDto.noTransition();
	}
	const constraintOptions =
		getCustomPropertiesOfRegularUniqueKeyForComparisonWithRegularUniqueKeyOptions(newColumnJsonSchema);
	const areOptionsEqual = oldUniqueKeys.some(compositeUniqueKey => {
		if (compositeUniqueKey.compositeUniqueKey.length !== amountOfColumnsInRegularUniqueKey) {
			return false;
		}
		const oldCompositeUniqueKeyAsRegularUniqueKeyOptions =
			getCustomPropertiesOfCompositeUniqueKeyForComparisonWithRegularUniqueKeyOptions(compositeUniqueKey);
		return _(oldCompositeUniqueKeyAsRegularUniqueKeyOptions).differenceWith(constraintOptions, _.isEqual).isEmpty();
	});

	return KeyTransitionDto.transition(!areOptionsEqual);
};

/**
 * @return {(collection: AlterCollectionDto) => KeyTransitionDto}
 * */
const wasCompositeUniqueKeyChangedInTransitionFromRegularToComposite = _ => collection => {
	/**
	 * @type {AlterCollectionRoleCompModUniqueKey}
	 * */
	const uniqueDto = collection?.role?.compMod?.uniqueKey || {};
	/**
	 * @type {AlterCollectionRoleCompModUniqueKeyDto[]}
	 * */
	const newUniqueKeys = uniqueDto.new || [];
	const idsOfColumns = newUniqueKeys.flatMap(unique => unique.compositeUniqueKey.map(dto => dto.keyId));
	if (idsOfColumns.length !== amountOfColumnsInRegularUniqueKey) {
		// We return false, because it wouldn't count as transition between regular UniqueKey and composite UniqueKey
		// if composite UniqueKey does not constraint exactly 1 column
		return KeyTransitionDto.noTransition();
	}
	const idOfUniqueKeyColumn = idsOfColumns[0];
	const oldColumnJsonSchema = Object.values(collection.role.properties).find(
		columnJsonSchema => columnJsonSchema.GUID === idOfUniqueKeyColumn,
	);
	if (!oldColumnJsonSchema) {
		return KeyTransitionDto.noTransition();
	}
	const isOldColumnARegularUniqueKey = oldColumnJsonSchema?.unique && !oldColumnJsonSchema?.compositeUniqueKey;
	if (!isOldColumnARegularUniqueKey) {
		return KeyTransitionDto.noTransition();
	}
	const constraintOptions =
		getCustomPropertiesOfRegularUniqueKeyForComparisonWithRegularUniqueKeyOptions(oldColumnJsonSchema);
	const areOptionsEqual = newUniqueKeys.some(compositeUniqueKey => {
		if (compositeUniqueKey.compositeUniqueKey.length !== amountOfColumnsInRegularUniqueKey) {
			return false;
		}
		const oldCompositeUniqueKeyAsRegularUniqueKeyOptions =
			getCustomPropertiesOfCompositeUniqueKeyForComparisonWithRegularUniqueKeyOptions(compositeUniqueKey);
		return _(oldCompositeUniqueKeyAsRegularUniqueKeyOptions).differenceWith(constraintOptions, _.isEqual).isEmpty();
	});

	return KeyTransitionDto.transition(!areOptionsEqual);
};

/**
 * @param {AlterCollectionRoleCompModUniqueKeyDto} uniqueKey
 * @param {string} entityName
 * @return {string}
 * */
const getConstraintNameForCompositeUniqueKey = (uniqueKey, entityName) => {
	if (uniqueKey.constraintName) {
		return uniqueKey.constraintName;
	}
	return getDefaultConstraintName(entityName);
};

/**
 * @param _
 * @return {(
 *      uniqueKey: AlterCollectionRoleCompModUniqueKeyDto,
 *      entityName: string,
 *      entityJsonSchema: AlterCollectionDto,
 * ) => {
 *         name: string,
 *         keyType: string,
 *         columns: Array<{
 *      		isActivated: boolean,
 *      		name: string,
 *  	   }>,
 *         include: Array<{
 *              isActivated: boolean,
 *              name: string,
 *         }>,
 *         storageParameters: string,
 *         tablespace: string,
 *      }
 *  }
 * */
const getCreateCompositeUniqueKeyDDLProviderConfig = _ => (uniqueKey, entityName, entity) => {
	const constraintName = getConstraintNameForCompositeUniqueKey(uniqueKey, entityName);
	const uniqueColumns = _.toPairs(entity.role.properties)
		.filter(([name, jsonSchema]) =>
			Boolean(uniqueKey.compositeUniqueKey.find(keyDto => keyDto.keyId === jsonSchema.GUID)),
		)
		.map(([name, jsonSchema]) => ({
			name,
			isActivated: jsonSchema.isActivated,
		}));

	let storageParameters = '';
	let indexTablespace = '';
	let includeColumns = [];
	let deferrable = uniqueKey.deferrable;
	let deferrableConstraintCheckTime = uniqueKey.deferrableConstraintCheckTime;

	if (uniqueKey.indexStorageParameters) {
		storageParameters = uniqueKey.indexStorageParameters;
	}
	if (uniqueKey.indexTablespace) {
		indexTablespace = uniqueKey.indexTablespace;
	}
	if (uniqueKey.indexInclude) {
		includeColumns = _.toPairs(entity.role.properties)
			.filter(([name, jsonSchema]) =>
				Boolean(uniqueKey.indexInclude.find(keyDto => keyDto.keyId === jsonSchema.GUID)),
			)
			.map(([name, jsonSchema]) => ({
				name,
				isActivated: jsonSchema.isActivated,
			}));
	}
	const keyType = 'UNIQUE' + (uniqueKey.nullsDistinct ? ' ' + uniqueKey.nullsDistinct : '');

	return {
		name: constraintName,
		keyType,
		columns: uniqueColumns,
		include: includeColumns,
		storageParameters,
		tablespace: indexTablespace,
		deferrable,
		deferrableConstraintCheckTime,
	};
};

/**
 * @return {(collection: AlterCollectionDto) => Array<KeyScriptModificationDto>}
 * */
const getAddCompositeUniqueKeyScriptDtos = (_, ddlProvider) => collection => {
	const { getFullCollectionName, getSchemaOfAlterCollection, getEntityName } = require('../../../utils/general')(_);

	/**
	 * @type {AlterCollectionRoleCompModUniqueKey}
	 * */
	const uniqueDto = collection?.role?.compMod?.uniqueKey || {};
	const newUniqueKeys = uniqueDto.new || [];
	const oldUniqueKeys = uniqueDto.old || [];
	if (newUniqueKeys.length === 0 && oldUniqueKeys.length === 0) {
		return [];
	}
	const transitionToCompositeDto = wasCompositeUniqueKeyChangedInTransitionFromRegularToComposite(_)(collection);
	if (transitionToCompositeDto.didTransitionHappen && !transitionToCompositeDto.wasUniqueKeyChangedInTransition) {
		return [];
	}
	if (newUniqueKeys.length === oldUniqueKeys.length) {
		const areKeyArraysEqual = _(oldUniqueKeys).differenceWith(newUniqueKeys, _.isEqual).isEmpty();
		if (areKeyArraysEqual) {
			return [];
		}
	}

	const collectionSchema = getSchemaOfAlterCollection(collection);
	const fullTableName = getFullCollectionName(collectionSchema);
	const entityName = getEntityName(collectionSchema);

	return newUniqueKeys
		.map(newUniqueKey => {
			const ddlConfig = getCreateCompositeUniqueKeyDDLProviderConfig(_)(newUniqueKey, entityName, collection);
			const statementDto = ddlProvider.createKeyConstraint(fullTableName, collection.isActivated, ddlConfig);
			return new KeyScriptModificationDto(statementDto.statement, fullTableName, false, statementDto.isActivated);
		})
		.filter(scriptDto => Boolean(scriptDto.script));
};

/**
 * @return {(collection: AlterCollectionDto) => Array<KeyScriptModificationDto>}
 * */
const getDropCompositeUniqueKeyScriptDtos = (_, ddlProvider) => collection => {
	const { getFullCollectionName, getSchemaOfAlterCollection, getEntityName, wrapInQuotes } =
		require('../../../utils/general')(_);

	const uniqueDto = collection?.role?.compMod?.uniqueKey || {};
	const newUniqueKeys = uniqueDto.new || [];
	const oldUniqueKeys = uniqueDto.old || [];
	if (newUniqueKeys.length === 0 && oldUniqueKeys.length === 0) {
		return [];
	}
	const transitionToCompositeDto = wasCompositeUniqueKeyChangedInTransitionFromCompositeToRegular(_)(collection);
	if (transitionToCompositeDto.didTransitionHappen && !transitionToCompositeDto.wasUniqueKeyChangedInTransition) {
		return [];
	}
	if (newUniqueKeys.length === oldUniqueKeys.length) {
		const areKeyArraysEqual = _(oldUniqueKeys).differenceWith(newUniqueKeys, _.isEqual).isEmpty();
		if (areKeyArraysEqual) {
			return [];
		}
	}

	const collectionSchema = getSchemaOfAlterCollection(collection);
	const fullTableName = getFullCollectionName(collectionSchema);
	const entityName = getEntityName(collectionSchema);

	return oldUniqueKeys
		.map(oldUniqueKey => {
			let constraintName = getDefaultConstraintName(entityName);
			if (oldUniqueKey.constraintName) {
				constraintName = oldUniqueKey.constraintName;
			}
			const ddlConstraintName = wrapInQuotes(constraintName);
			const script = ddlProvider.dropKeyConstraint(fullTableName, ddlConstraintName);
			return new KeyScriptModificationDto(script, fullTableName, true, collection.isActivated);
		})
		.filter(scriptDto => Boolean(scriptDto.script));
};

/**
 * @return {(collection: AlterCollectionDto) => Array<KeyScriptModificationDto>}
 * */
const getModifyCompositeUniqueKeyScriptDtos = (_, ddlProvider) => collection => {
	const dropCompositeUniqueKeyScriptDtos = getDropCompositeUniqueKeyScriptDtos(_, ddlProvider)(collection);
	const addCompositeUniqueKeyScriptDtos = getAddCompositeUniqueKeyScriptDtos(_, ddlProvider)(collection);

	return [...dropCompositeUniqueKeyScriptDtos, ...addCompositeUniqueKeyScriptDtos].filter(Boolean);
};

/**
 * @param {AlterCollectionColumnDto} columnJsonSchema
 * @param {string} entityName
 * @return {string}
 * */
const getConstraintNameForRegularUniqueKey = (columnJsonSchema, entityName) => {
	const constraintOptions = columnJsonSchema.uniqueKeyOptions;
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
 * @param _
 * @return {(
 *      name: string,
 *      columnJsonSchema: AlterCollectionColumnDto,
 *      entityName: string,
 *      entityJsonSchema: AlterCollectionDto,
 * ) => {
 *         name: string,
 *         keyType: string,
 *         columns: Array<{
 *      		isActivated: boolean,
 *      		name: string,
 *  	   }>,
 *         include: Array<{
 *              isActivated: boolean,
 *              name: string,
 *         }>,
 *         storageParameters: string,
 *         tablespace: string,
 *      }
 *  }
 * */
const getCreateRegularUniqueKeyDDLProviderConfig = _ => (columnName, columnJsonSchema, entityName, entity) => {
	const constraintName = getConstraintNameForRegularUniqueKey(columnJsonSchema, entityName);
	const uniqueColumns = [
		{
			name: columnName,
			isActivated: columnJsonSchema.isActivated,
		},
	];

	let storageParameters = '';
	let indexTablespace = '';
	let includeColumns = [];
	let deferrable = '';
	let deferrableConstraintCheckTime = '';
	let nullsDistinct = '';

	const constraintOptions = columnJsonSchema.uniqueKeyOptions;
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

		deferrable = constraintOption.deferrable;
		deferrableConstraintCheckTime = constraintOption.deferrableConstraintCheckTime;
		nullsDistinct = constraintOption.nullsDistinct;
	}

	const keyType = 'UNIQUE' + (nullsDistinct ? ' ' + nullsDistinct : '');

	return {
		name: constraintName,
		keyType,
		columns: uniqueColumns,
		include: includeColumns,
		storageParameters,
		tablespace: indexTablespace,
		deferrable,
		deferrableConstraintCheckTime,
	};
};

/**
 * @return {(columnJsonSchema: AlterCollectionColumnDto, collection: AlterCollectionDto) => boolean}
 * */
const wasFieldChangedToBeARegularUniqueKey = _ => (columnJsonSchema, collection) => {
	const oldName = columnJsonSchema.compMod.oldField.name;
	const oldColumnJsonSchema = collection.role.properties[oldName];

	const isRegularUniqueKey = columnJsonSchema.unique && !columnJsonSchema.compositeUniqueKey;
	const wasTheFieldAnyUniqueKey = oldColumnJsonSchema?.unique || oldColumnJsonSchema.compositeUniqueKey;

	return isRegularUniqueKey && !wasTheFieldAnyUniqueKey;
};

/**
 * @return {(columnJsonSchema: AlterCollectionColumnDto, collection: AlterCollectionDto) => KeyTransitionDto}
 * */
const wasRegularUniqueKeyChangedInTransitionFromCompositeToRegular = _ => (columnJsonSchema, collection) => {
	const oldName = columnJsonSchema.compMod.oldField.name;
	const oldColumnJsonSchema = collection.role.properties[oldName];

	const isRegularUniqueKey = columnJsonSchema.unique && !columnJsonSchema.compositeUniqueKey;
	const wasTheFieldAnyUniqueKey = oldColumnJsonSchema?.unique || oldColumnJsonSchema.compositeUniqueKey;

	if (!(isRegularUniqueKey && wasTheFieldAnyUniqueKey)) {
		return KeyTransitionDto.noTransition();
	}

	/**
	 * @type {AlterCollectionRoleCompModUniqueKey}
	 * */
	const uniqueDto = collection?.role?.compMod?.uniqueKey || {};
	const newUniqueKeys = uniqueDto.new || [];
	/**
	 * @type {AlterCollectionRoleCompModUniqueKeyDto[]}
	 * */
	const oldUniqueKeys = uniqueDto.old || [];
	const wasTheFieldACompositeUniqueKey = oldUniqueKeys.some(compUniqueKey =>
		compUniqueKey.compositeUniqueKey.some(unique => unique.keyId === oldColumnJsonSchema.GUID),
	);
	const isTheFieldACompositeUniqueKey = newUniqueKeys.some(compUniqueKey =>
		compUniqueKey.compositeUniqueKey.some(unique => unique.keyId === columnJsonSchema.GUID),
	);

	const wasCompositeUniqueKeyRemoved = wasTheFieldACompositeUniqueKey && !isTheFieldACompositeUniqueKey;

	if (isRegularUniqueKey && wasCompositeUniqueKeyRemoved) {
		// return compare custom properties and amount of columns.
		// If there was a transition and amount of composite UniqueKey columns is not equal
		// to amount of regular unique columns, we must recreate UniqueKey
		const constraintOptions =
			getCustomPropertiesOfRegularUniqueKeyForComparisonWithRegularUniqueKeyOptions(columnJsonSchema);
		const areOptionsEqual = oldUniqueKeys.some(oldCompositeUniqueKey => {
			if (oldCompositeUniqueKey.compositeUniqueKey.length !== amountOfColumnsInRegularUniqueKey) {
				return false;
			}
			const oldCompositeUniqueKeyAsRegularUniqueKeyOptions =
				getCustomPropertiesOfCompositeUniqueKeyForComparisonWithRegularUniqueKeyOptions(oldCompositeUniqueKey);
			return _(oldCompositeUniqueKeyAsRegularUniqueKeyOptions)
				.differenceWith(constraintOptions, _.isEqual)
				.isEmpty();
		});
		return KeyTransitionDto.transition(!areOptionsEqual);
	}

	return KeyTransitionDto.noTransition();
};

/**
 * @return {(columnJsonSchema: AlterCollectionColumnDto, collection: AlterCollectionDto) => KeyTransitionDto}
 * */
const wasRegularUniqueKeyChangedInTransitionFromRegularToComposite = _ => (columnJsonSchema, collection) => {
	const oldName = columnJsonSchema.compMod.oldField.name;
	const oldColumnJsonSchema = collection.role.properties[oldName];

	const wasRegularUniqueKey = oldColumnJsonSchema.unique && !oldColumnJsonSchema.compositeUniqueKey;
	const isTheFieldAnyUniqueKey = Boolean(columnJsonSchema?.unique);

	if (!(wasRegularUniqueKey && isTheFieldAnyUniqueKey)) {
		return KeyTransitionDto.noTransition();
	}

	/**
	 * @type {AlterCollectionRoleCompModUniqueKey}
	 * */
	const uniqueDto = collection?.role?.compMod?.uniqueKey || {};
	const newUniqueKeys = uniqueDto.new || [];
	/**
	 * @type {AlterCollectionRoleCompModUniqueKeyDto[]}
	 * */
	const oldUniqueKeys = uniqueDto.old || [];
	const wasTheFieldACompositeUniqueKey = oldUniqueKeys.some(compUniqueKey =>
		compUniqueKey.compositeUniqueKey.some(unique => unique.keyId === oldColumnJsonSchema.GUID),
	);
	const isTheFieldACompositeUniqueKey = newUniqueKeys.some(compUniqueKey =>
		compUniqueKey.compositeUniqueKey.some(unique => unique.keyId === columnJsonSchema.GUID),
	);

	const wasCompositeUniqueKeyAdded = isTheFieldACompositeUniqueKey && !wasTheFieldACompositeUniqueKey;

	if (wasRegularUniqueKey && wasCompositeUniqueKeyAdded) {
		// return compare custom properties and amount of columns.
		// If there was a transition and amount of composite UniqueKey columns is not equal
		// to amount of regular unique columns, we must recreate UniqueKey
		const constraintOptions =
			getCustomPropertiesOfRegularUniqueKeyForComparisonWithRegularUniqueKeyOptions(oldColumnJsonSchema);
		const areOptionsEqual = newUniqueKeys.some(oldCompositeUniqueKey => {
			if (oldCompositeUniqueKey.compositeUniqueKey.length !== amountOfColumnsInRegularUniqueKey) {
				return false;
			}
			const oldCompositeUniqueKeyAsRegularUniqueKeyOptions =
				getCustomPropertiesOfCompositeUniqueKeyForComparisonWithRegularUniqueKeyOptions(oldCompositeUniqueKey);
			return _(oldCompositeUniqueKeyAsRegularUniqueKeyOptions)
				.differenceWith(constraintOptions, _.isEqual)
				.isEmpty();
		});
		return KeyTransitionDto.transition(!areOptionsEqual);
	}

	return KeyTransitionDto.noTransition();
};

/**
 * @return {(columnJsonSchema: AlterCollectionColumnDto, collection: AlterCollectionDto) => boolean}
 * */
const isFieldNoLongerARegularUniqueKey = _ => (columnJsonSchema, collection) => {
	const oldName = columnJsonSchema.compMod.oldField.name;

	const oldJsonSchema = collection.role.properties[oldName];
	const wasTheFieldARegularUniqueKey = oldJsonSchema?.unique && !oldJsonSchema?.compositeUniqueKey;

	const isNotAnyUniqueKey = !columnJsonSchema.unique && !columnJsonSchema.compositeUniqueKey;
	return wasTheFieldARegularUniqueKey && isNotAnyUniqueKey;
};

/**
 * @return {(columnJsonSchema: AlterCollectionColumnDto, collection: AlterCollectionDto) => boolean}
 * */
const wasRegularUniqueKeyModified = _ => (columnJsonSchema, collection) => {
	const oldName = columnJsonSchema.compMod.oldField.name;
	const oldJsonSchema = collection.role.properties[oldName] || {};

	const isRegularUniqueKey = columnJsonSchema.unique && !columnJsonSchema.compositeUniqueKey;
	const wasTheFieldARegularUniqueKey = oldJsonSchema?.unique && !oldJsonSchema?.compositeUniqueKey;

	if (!(isRegularUniqueKey && wasTheFieldARegularUniqueKey)) {
		return false;
	}
	const constraintOptions =
		getCustomPropertiesOfRegularUniqueKeyForComparisonWithRegularUniqueKeyOptions(columnJsonSchema);
	const oldConstraintOptions =
		getCustomPropertiesOfRegularUniqueKeyForComparisonWithRegularUniqueKeyOptions(oldJsonSchema);
	const areOptionsEqual = _(oldConstraintOptions).differenceWith(constraintOptions, _.isEqual).isEmpty();
	return !areOptionsEqual;
};

/**
 * @return {(collection: AlterCollectionDto) => Array<KeyScriptModificationDto>}
 * */
const getAddUniqueKeyScriptDtos = (_, ddlProvider) => collection => {
	const { getFullCollectionName, getSchemaOfAlterCollection, getEntityName } = require('../../../utils/general')(_);

	const collectionSchema = getSchemaOfAlterCollection(collection);
	const fullTableName = getFullCollectionName(collectionSchema);
	const entityName = getEntityName(collectionSchema);

	return _.toPairs(collection.properties)
		.filter(([name, jsonSchema]) => {
			if (wasFieldChangedToBeARegularUniqueKey(_)(jsonSchema, collection)) {
				return true;
			}
			const transitionToRegularDto = wasRegularUniqueKeyChangedInTransitionFromCompositeToRegular(_)(
				jsonSchema,
				collection,
			);
			if (transitionToRegularDto.didTransitionHappen) {
				return transitionToRegularDto.wasUniqueKeyChangedInTransition;
			}
			return wasRegularUniqueKeyModified(_)(jsonSchema, collection);
		})
		.map(([name, jsonSchema]) => {
			const ddlConfig = getCreateRegularUniqueKeyDDLProviderConfig(_)(name, jsonSchema, entityName, collection);
			const statementDto = ddlProvider.createKeyConstraint(fullTableName, collection.isActivated, ddlConfig);
			return new KeyScriptModificationDto(statementDto.statement, fullTableName, false, statementDto.isActivated);
		})
		.filter(scriptDto => Boolean(scriptDto.script));
};

/**
 * @return {(collection: AlterCollectionDto) => Array<KeyScriptModificationDto>}
 * */
const getDropUniqueKeyScriptDto = (_, ddlProvider) => collection => {
	const { getFullCollectionName, getSchemaOfAlterCollection, getEntityName, wrapInQuotes } =
		require('../../../utils/general')(_);

	const collectionSchema = getSchemaOfAlterCollection(collection);
	const fullTableName = getFullCollectionName(collectionSchema);
	const entityName = getEntityName(collectionSchema);

	return _.toPairs(collection.properties)
		.filter(([name, jsonSchema]) => {
			if (isFieldNoLongerARegularUniqueKey(_)(jsonSchema, collection)) {
				return true;
			}
			const transitionToRegularDto = wasRegularUniqueKeyChangedInTransitionFromRegularToComposite(_)(
				jsonSchema,
				collection,
			);
			if (transitionToRegularDto.didTransitionHappen) {
				return transitionToRegularDto.wasUniqueKeyChangedInTransition;
			}
			return wasRegularUniqueKeyModified(_)(jsonSchema, collection);
		})
		.map(([name, jsonSchema]) => {
			const oldName = jsonSchema.compMod.oldField.name;
			const oldJsonSchema = collection.role.properties[oldName];
			const ddlConstraintName = wrapInQuotes(getConstraintNameForRegularUniqueKey(oldJsonSchema, entityName));

			const script = ddlProvider.dropKeyConstraint(fullTableName, ddlConstraintName);
			return new KeyScriptModificationDto(script, fullTableName, true, collection.isActivated);
		})
		.filter(scriptDto => Boolean(scriptDto.script));
};

/**
 * @return {(collection: AlterCollectionDto) => Array<KeyScriptModificationDto>}
 * */
const getModifyUniqueKeyScriptDtos = (_, ddlProvider) => collection => {
	const dropUniqueKeyScriptDtos = getDropUniqueKeyScriptDto(_, ddlProvider)(collection);
	const addUniqueKeyScriptDtos = getAddUniqueKeyScriptDtos(_, ddlProvider)(collection);

	return [...dropUniqueKeyScriptDtos, ...addUniqueKeyScriptDtos].filter(Boolean);
};

/**
 * @param {KeyScriptModificationDto[]} constraintDtos
 * @return {KeyScriptModificationDto[]}
 * */
const sortModifyUniqueKeyConstraints = constraintDtos => {
	return constraintDtos.sort((c1, c2) => {
		if (c1.fullTableName === c2.fullTableName) {
			// Number(true) = 1, Number(false) = 0;
			// This ensures that DROP script appears before CREATE script
			// if the same table has 2 scripts that drop and recreate UniqueKey
			return Number(c2.isDropScript) - Number(c1.isDropScript);
		}
		// This sorts all statements based on full table name, ASC
		return c1.fullTableName < c2.fullTableName;
	});
};

/**
 * @return {(collection: AlterCollectionDto) => Array<AlterScriptDto>}
 * */
const getModifyUniqueKeyConstraintsScriptDtos = (_, ddlProvider) => collection => {
	const modifyCompositeUniqueKeyScriptDtos = getModifyCompositeUniqueKeyScriptDtos(_, ddlProvider)(collection);
	const modifyUniqueKeyScriptDtos = getModifyUniqueKeyScriptDtos(_, ddlProvider)(collection);

	const allDtos = [...modifyCompositeUniqueKeyScriptDtos, ...modifyUniqueKeyScriptDtos];
	const sortedAllDtos = sortModifyUniqueKeyConstraints(allDtos);

	return sortedAllDtos
		.map(dto => {
			return AlterScriptDto.getInstance([dto.script], dto.isActivated, dto.isDropScript);
		})
		.filter(Boolean);
};

module.exports = {
	getModifyUniqueKeyConstraintsScriptDtos,
};
