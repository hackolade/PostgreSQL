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

	const createKeyConstraint = (templates, isParentActivated) => keyData => {
		const constraintName = wrapInQuotes(_.trim(keyData.name));
		const isAllColumnsDeactivated = checkAllKeysDeactivated(keyData.columns);
		const columns = getColumnsList(keyData.columns, isAllColumnsDeactivated, isParentActivated);
		const includeNonKey = keyData.include.length
			? ` INCLUDE${getColumnsList(keyData.include, isAllColumnsDeactivated, isParentActivated)}`
			: '';
		const storageParameters = keyData.storageParameters ? ` WITH (${keyData.storageParameters})` : '';
		const tablespace = keyData.tablespace ? ` USING INDEX TABLESPACE ${wrapInQuotes(keyData.tablespace)}` : '';

		return {
			statement: assignTemplates(templates.createKeyConstraint, {
				constraintName: keyData.name ? `CONSTRAINT ${wrapInQuotes(constraintName)} ` : '',
				keyType: keyData.keyType,
				columns,
				includeNonKey,
				storageParameters,
				tablespace,
			}),
			isActivated: !isAllColumnsDeactivated,
		};
	};

	const additionalPropertiesForForeignKey = relationship => {
		const foreignOnDelete = _.get(relationship, 'relationshipOnDelete', '');
		const foreignOnUpdate = _.get(relationship, 'relationshipOnUpdate', '');
		const foreignMatch = _.get(relationship, 'relationshipMatch', '');
		return { foreignOnDelete, foreignOnUpdate, foreignMatch }
	};

	return {
		generateConstraintsString,
		foreignKeysToString,
		foreignActiveKeysToString,
		createKeyConstraint,
		additionalPropertiesForForeignKey,
	};
};
