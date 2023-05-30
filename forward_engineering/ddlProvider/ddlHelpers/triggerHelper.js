module.exports = ({ _, assignTemplates, templates, getNamePrefixedWithSchemaName, wrap, commentIfDeactivated }) => {
	const getTriggersScript = ({ dbVersion, triggers, tableName }) => {
		return _.map(triggers, getTriggerScript(dbVersion, tableName)).join('\n').trim();
	};

	const getTriggerScript = (dbVersion, tableName) => trigger => {
		const events = getTriggerEvents(trigger);
		const options = getTriggerOptions(trigger);

		return assignTemplates(templates.createTrigger, {
			orReplace: trigger.triggerOrReplace ? ' OR REPLACE' : '',
			constraint: trigger.triggerConstraint ? ' CONSTRAINT' : '',
			actionTiming: trigger.triggerType ?? '',
			functionKey: dbVersion === 'v10.x' ? 'PROCEDURE' : 'FUNCTION',
			functionName: trigger.triggerFunction,
			name: trigger.name,
			tableName,
			events,
			options,
		});
	};

	const getTriggerEvents = trigger => {
		return trigger.triggerEvents
			?.map(event => {
				if (event.triggerEvent !== 'UPDATE' || _.isEmpty(trigger.triggerUpdateColumns)) {
					return event.triggerEvent;
				}

				const activatedKeys = _.chain(trigger.triggerUpdateColumns)
					.filter('isActivated')
					.map(({ name }) => name)
					.join(', ')
					.thru(activatedStr => (Boolean(activatedStr) ? `OF ${activatedStr}` : activatedStr))
					.value();
				const deactivatedKeys = _.chain(trigger.triggerUpdateColumns)
					.reject('isActivated')
					.map(({ name }) => name)
					.join(', ')
					.thru(deactivatedStr =>
						!Boolean(activatedKeys) && Boolean(deactivatedStr) ? `OF ${deactivatedStr}` : deactivatedStr,
					)
					.value();
				const commentedDeactivatedKeys =
					deactivatedKeys &&
					commentIfDeactivated(deactivatedKeys, {
						isActivated: false,
						isPartOfLine: true,
					});

				return `UPDATE ${activatedKeys} ${commentedDeactivatedKeys}`;
			})
			.join(' OR ');
	};

	const getTriggerOptions = trigger => {
		let options = '';

		if (trigger.triggerConstraint) {
			if (trigger.triggerReferencedTable) {
				options += wrap(`FROM ${trigger.triggerReferencedTable}`, '\t', '\n');
			}

			options += wrap(trigger.triggerDeferrable ? 'DEFERRABLE' : 'NOT DEFERRABLE', '\t', '\n');

			if (trigger.triggerDeferrable && trigger.triggerTimeConstraintCheck) {
				options += wrap(trigger.triggerTimeConstraintCheck, '\t', '\n');
			}
		}

		if (trigger.triggerReferencing) {
			let triggerReferencingStatement = 'REFERENCING';

			if (trigger.triggerBeforeImageTransitionRelation) {
				triggerReferencingStatement += ` OLD TABLE ${trigger.triggerBeforeImageTransitionRelation}`;
			}
			if (trigger.triggerAfterImageTransitionRelation) {
				triggerReferencingStatement += ` NEW TABLE ${trigger.triggerAfterImageTransitionRelation}`;
			}

			options += wrap(triggerReferencingStatement, '\t', '\n');
		}

		options += wrap(
			trigger.triggerConstraint || trigger.triggerType === 'INSTEAD OF'
				? 'FOR EACH ROW'
				: trigger.triggerEachRowStatement || 'FOR EACH STATEMENT',
			'\t',
			'\n',
		);

		if (trigger.triggerCondition) {
			options += wrap(`WHEN ${trigger.triggerCondition}`, '\t', '\n');
		}

		return options;
	};

	const hydrateTriggers = (entityData, relatedSchemas = {}) => {
		return (_.find(entityData, 'triggers')?.triggers || []).map(trigger => {
			const referencedTable = relatedSchemas[trigger.triggerReferencedTable];

			if (!referencedTable) {
				return { ...trigger, triggerReferencedTable: '' };
			}

			const triggerReferencedTable = getNamePrefixedWithSchemaName(
				referencedTable.code || referencedTable.collectionName,
				referencedTable.bucketName,
			);

			return { ...trigger, triggerReferencedTable };
		});
	};

	return { getTriggersScript, hydrateTriggers };
};
