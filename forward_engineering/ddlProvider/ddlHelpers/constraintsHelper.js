module.exports = ({
	_,
	commentIfDeactivated,
	checkAllKeysDeactivated,
	assignTemplates,
	wrapInQuotes,
	getColumnsList,
}) => {
	const generateConstraintsString = (dividedConstraints, isParentActivated) => {
		const deactivatedItemsAsString = commentIfDeactivated(
			(dividedConstraints?.deactivatedItems || []).join(',\n\t'),
			{
				isActivated: !isParentActivated,
				isPartOfLine: true,
			},
		);
		const activatedConstraints = dividedConstraints?.activatedItems?.length
			? ',\n\t' + dividedConstraints.activatedItems.join(',\n\t')
			: '';

		const deactivatedConstraints = dividedConstraints?.deactivatedItems?.length
			? '\n\t' + deactivatedItemsAsString
			: '';

		return activatedConstraints + deactivatedConstraints;
	};

	const foreignKeysToString = keys => {
		if (Array.isArray(keys)) {
			const activatedKeys = keys
				.filter(key => _.get(key, 'isActivated', true))
				.map(key => wrapInQuotes(_.trim(key.name)));
			const deactivatedKeys = keys
				.filter(key => !_.get(key, 'isActivated', true))
				.map(key => wrapInQuotes(_.trim(key.name)));
			const deactivatedKeysAsString = deactivatedKeys.length
				? commentIfDeactivated(deactivatedKeys, { isActivated: false, isPartOfLine: true })
				: '';

			return activatedKeys.join(', ') + deactivatedKeysAsString;
		}
		return keys;
	};

	const foreignActiveKeysToString = keys => {
		return keys.map(key => _.trim(key.name)).join(', ');
	};

	/**
	 * @param templates {Object}
	 * @param isParentActivated {boolean}
	 * @return {(
	 *     keyData: {
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
	 *     }
	 * ) => {
	 *     statement: string,
	 *     isActivated: boolean,
	 * }}
	 * */
	const createKeyConstraint = (templates, isParentActivated) => keyData => {
		const constraintName = wrapInQuotes(_.trim(keyData.name));
		const isAllColumnsDeactivated = checkAllKeysDeactivated(keyData.columns || []);
		const columns = !_.isEmpty(keyData.columns)
			? getColumnsList(keyData.columns, isAllColumnsDeactivated, isParentActivated)
			: '';
		const includeNonKey = keyData.include.length
			? ` INCLUDE${getColumnsList(keyData.include, isAllColumnsDeactivated, isParentActivated)}`
			: '';
		const storageParameters = keyData.storageParameters ? ` WITH (${keyData.storageParameters})` : '';
		const tablespace = keyData.tablespace ? ` USING INDEX TABLESPACE ${wrapInQuotes(keyData.tablespace)}` : '';
		const deferrable = keyData?.deferrable ? ` ${keyData.deferrable}` : '';
		const deferrableConstraintCheckTime =
			keyData?.deferrable === 'DEFERRABLE' && keyData?.deferrableConstraintCheckTime
				? ` ${keyData?.deferrableConstraintCheckTime}`
				: '';

		return {
			statement: assignTemplates(templates.createKeyConstraint, {
				constraintName: keyData.name ? `CONSTRAINT ${constraintName} ` : '',
				keyType: keyData.keyType,
				columns,
				includeNonKey,
				storageParameters,
				tablespace,
				deferrable,
				deferrableConstraintCheckTime,
			}),
			isActivated: !isAllColumnsDeactivated,
		};
	};

	const getConstraintsWarnings = (invalidConstraints = []) => {
		if (_.isEmpty(invalidConstraints)) {
			return '';
		}

		return (
			'\n\t' +
			invalidConstraints
				.map(keyData => {
					const constraintName = keyData.name ? ` [constraint name: ${keyData.name}]` : '';

					return `-- ${keyData.errorMessage}${constraintName}`;
				})
				.join('\n\t')
		);
	};

	/**
	 * @param relationshipCustomProperties {{
	 *     relationshipOnDelete?: string,
	 *     relationshipOnUpdate?: string,
	 *     relationshipMatch?: string,
	 *     deferrable?: "" | "DEFERRABLE" | "NOT DEFERRABLE",
	 *     deferrableConstraintCheckTime?: "" | "INITIALLY IMMEDIATE" | "INITIALLY DEFERRED",
	 * }}
	 * @return {{
	 *     relationshipOnDelete: string,
	 *     relationshipOnUpdate: string,
	 *     relationshipMatch: string,
	 *     deferrable: string,
	 *     deferrableConstraintCheckTime: string,
	 * }}
	 * */
	const additionalPropertiesForForeignKey = relationshipCustomProperties => {
		const foreignOnDelete = _.get(relationshipCustomProperties, 'relationshipOnDelete', '');
		const foreignOnUpdate = _.get(relationshipCustomProperties, 'relationshipOnUpdate', '');
		const foreignMatch = _.get(relationshipCustomProperties, 'relationshipMatch', '');
		const deferrable = _.get(relationshipCustomProperties, 'deferrable', '');
		const deferrableConstraintCheckTime = _.get(relationshipCustomProperties, 'deferrableConstraintCheckTime', '');
		return { foreignOnDelete, foreignOnUpdate, foreignMatch, deferrable, deferrableConstraintCheckTime };
	};

	return {
		generateConstraintsString,
		foreignKeysToString,
		foreignActiveKeysToString,
		createKeyConstraint,
		getConstraintsWarnings,
		additionalPropertiesForForeignKey,
	};
};
