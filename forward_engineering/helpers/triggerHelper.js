module.exports = ({ _, assignTemplates, templates, getNamePrefixedWithSchemaName, wrap }) => {
	const getTriggersScript = (schemaName, dbVersion, triggers) => {
		return _.map(triggers, getTriggerScript(schemaName, dbVersion)).join('\n').trim();
	};

	const getTriggerScript = (schemaName, dbVersion) => trigger => {
		const name = getNamePrefixedWithSchemaName(trigger.name, schemaName);
		const events = getTriggerEvents(trigger);
		const options = getTriggerOptions(trigger);

		return assignTemplates(templates.createTrigger, {
			orReplace: trigger.triggerOrReplace,
			constraint: trigger.triggerConstraint ? ' CONSTRAINT' : '',
			actionTiming: trigger.triggerType,
			functionKey: dbVersion === 'v10.x' ? 'PROCEDURE' : 'FUNCTION',
			functionName: trigger.triggerFunction,
			tableName: trigger.triggerTable,
			name,
			events,
			options,
		});
	};

	const getTriggerEvents = trigger => {
		return trigger.triggerEvents
			?.map(event => {
				if (event.triggerEvent !== 'UPDATE' || _.isEmpty(event.triggerUpdateColumns)) {
					return event.triggerEvent;
				}

				return `UPDATE ${event.triggerUpdateColumns
					.map(({ triggerUpdateColumnName }) => triggerUpdateColumnName)
					.join(', ')}`;
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
			let triggerReferencingStatement = 'REFERENCING'

			if(trigger.triggerBeforeImageTransitionRelation) {
				triggerReferencingStatement += ` OLD TABLE ${trigger.triggerBeforeImageTransitionRelation}`
			}
			if(trigger.triggerAfterImageTransitionRelation) {
				triggerReferencingStatement += ` NEW TABLE ${trigger.triggerAfterImageTransitionRelation}`;
			}

			options += wrap(triggerReferencingStatement, '\t', '\n');
		}

		options += wrap(trigger.triggerConstraint ? 'FOR EACH ROW' : trigger.triggerEachRowStatement, '\t', '\n');

		if (trigger.triggerCondition) {
			options += wrap(`WHEN ${trigger.triggerCondition}`, '\t', '\n');
		}

		return options;
	};

	return { getTriggersScript };
};
