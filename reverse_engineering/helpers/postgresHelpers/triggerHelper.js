let _ = null;

const setDependencies = app => {
	_ = app.require('lodash');
};

const getTriggers = (triggers, triggersAdditionalData) => {
	return _.chain(triggers)
		.map(trigger => ({
			...trigger,
			...(_.find(triggersAdditionalData, { trigger_name: trigger.trigger_name }) || {}),
		}))
		.map(getTrigger)
		.value();
};

const getTrigger = data => {
	return {
		name: data.trigger_name,
		triggerDescription: data.description,
		triggerConstraint: data.constraint,
		triggerTable: `${data.event_object_schema}.${data.event_object_table}`,
		triggerReferencedTable: data.referenced_table_name
			? `${data.referenced_table_schema}.${data.referenced_table_name}`
			: '',
		triggerType: data.action_timing,
		triggerEvents: getTriggerEvents(data),
		triggerDeferrable: data.deferrable,
		triggerTimeConstraintCheck: data.deferred ? 'INITIALLY DEFERRED' : 'INITIALLY IMMEDIATE',
		triggerReferencing: Boolean(data.action_reference_old_table) || Boolean(data.action_reference_new_table),
		triggerImageTransitionRelationOrder: Boolean(data.action_reference_old_table) ? 'OLD TABLE' : 'NEW TABLE',
		triggerTransitionRelationName: data.action_reference_old_table || data.action_reference_new_table || '',
		triggerEachRowStatement: data.action_orientation === 'ROW' ? 'FOR EACH ROW' : 'FOR EACH STATEMENT',
		triggerCondition: data.action_condition,
		triggerFunction: getFunctionFromTrigger(data.action_statement),
	};
};

const getTriggerEvents = triggerData => {
	return _.map(triggerData.trigger_events, triggerEvent => {
		if (triggerEvent !== 'UPDATE') {
			return { triggerEvent };
		}

		if (_.isEmpty(_.compact(triggerData.update_attributes))) {
			return { triggerEvent };
		}

		return {
			triggerEvent,
			triggerUpdateColumns: _.map(triggerData.update_attributes, triggerUpdateColumnName => ({
				triggerUpdateColumnName,
			})),
		};
	});
};

const getFunctionFromTrigger = executeStatement => {
	return /EXECUTE (?:FUNCTION|PROCEDURE)(?<function>[\s\S]*)/.exec(executeStatement)?.groups?.function?.trim() || '';
};

module.exports = {
	setDependencies,
	getTriggers,
};
