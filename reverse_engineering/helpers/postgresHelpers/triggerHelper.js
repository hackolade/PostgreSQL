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
			? [data.referenced_table_schema, data.referenced_table_name]
			: [],
		triggerType: data.action_timing,
		triggerEvents: getTriggerEvents(data),
		triggerUpdateColumns: data.update_attributes?.filter(Boolean),
		triggerDeferrable: data.deferrable,
		triggerTimeConstraintCheck: data.deferred ? 'INITIALLY DEFERRED' : 'INITIALLY IMMEDIATE',
		triggerReferencing: Boolean(data.action_reference_old_table) || Boolean(data.action_reference_new_table),
		triggerBeforeImageTransitionRelation: data.action_reference_old_table || '',
		triggerAfterImageTransitionRelation: data.action_reference_new_table || '',
		triggerEachRowStatement: data.action_orientation === 'ROW' ? 'FOR EACH ROW' : 'FOR EACH STATEMENT',
		triggerCondition: data.action_condition,
		triggerFunction: getFunctionFromTrigger(data.action_statement),
	};
};

const getTriggerEvents = triggerData => {
	return _.map(triggerData.trigger_events, triggerEvent => ({ triggerEvent }));
};

const getFunctionFromTrigger = executeStatement => {
	return /EXECUTE (?:FUNCTION|PROCEDURE)(?<function>[\s\S]*)/.exec(executeStatement)?.groups?.function?.trim() || '';
};

module.exports = {
	setDependencies,
	getTriggers,
};
