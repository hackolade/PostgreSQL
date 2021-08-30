
module.exports = ({
	_,
	commentIfDeactivated,
	checkAllKeysDeactivated,
	divideIntoActivatedAndDeactivated,
	assignTemplates,
}) => {
	const generateConstraintsString = (dividedConstraints, isParentActivated) => {
		const deactivatedItemsAsString = commentIfDeactivated((dividedConstraints?.deactivatedItems || []).join(',\n\t'), {
			isActivated: !isParentActivated,
			isPartOfLine: true,
		});
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
			const activatedKeys = keys.filter(key => _.get(key, 'isActivated', true)).map(key => `\`${_.trim(key.name)}\``);
			const deactivatedKeys = keys
				.filter(key => !_.get(key, 'isActivated', true))
				.map(key => `\`${_.trim(key.name)}\``);
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
		const columnMapToString = ({ name, order }) => `\`${name}\` ${order}`.trim();
	
		const isAllColumnsDeactivated = checkAllKeysDeactivated(keyData.columns);
		const dividedColumns = divideIntoActivatedAndDeactivated(keyData.columns, columnMapToString);
		const deactivatedColumnsAsString = dividedColumns?.deactivatedItems?.length
			? commentIfDeactivated(dividedColumns.deactivatedItems.join(', '), { isActivated: false, isPartOfLine: true })
			: '';
	
		const columns =
			!isAllColumnsDeactivated && isParentActivated
				? ' (' + dividedColumns.activatedItems.join(', ') + deactivatedColumnsAsString + ')'
				: ' (' + keyData.columns.map(columnMapToString).join(', ') + ')';
		const using = keyData.category ? ` USING ${keyData.category}` : '';
		const ignore = keyData.ignore ? ` IGNORED` : '';
		const comment = keyData.comment ? ` COMMENT '${keyData.comment}'` : '';
		const blockSize = keyData.blockSize ? ` KEY_BLOCK_SIZE=${keyData.blockSize}` : '';
	
		return {
			statement: assignTemplates(templates.createKeyConstraint, {
				constraintName: keyData.name ? `CONSTRAINT \`${_.trim(keyData.name)}\` ` : '',
				keyType: keyData.keyType,
				blockSize,
				columns,
				comment,
				ignore,
				using,
			}),
			isActivated: !isAllColumnsDeactivated,
		};
	};
	
	return {
		generateConstraintsString,
		foreignKeysToString,
		foreignActiveKeysToString,
		createKeyConstraint,
	};
};
