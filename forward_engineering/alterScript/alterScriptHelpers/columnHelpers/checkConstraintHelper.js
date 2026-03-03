const _ = require('lodash');
const { AlterScriptDto, SCRIPT_TYPE } = require('../../types/AlterScriptDto');
const {
	getFullTableName,
	wrapInQuotes,
	isObjectInDeltaModelActivated,
	isParentContainerActivated,
} = require('../../../utils/general');
const assignTemplates = require('../../../utils/assignTemplates');
const templates = require('../../../ddlProvider/templates');

/**
 * @typedef {{
 *     name: string,
 *     expression: string,
 *     noInherit?: boolean,
 * }} ColumnCheckConstraint
 *
 * @typedef {{
 *     old?: ColumnCheckConstraint,
 *     new?: ColumnCheckConstraint,
 *     columnName: string,
 *     isActivated: boolean,
 * }} ColumnCheckConstraintHistoryEntry
 * */

/**
 *
 * @param {string} [constraintName]
 * @param {string} columnName
 * @param {string} tableName
 * @returns {string}
 */
const getConstraintName = (constraintName, columnName, tableName) => {
	return wrapInQuotes(constraintName || `chk_${tableName}.${columnName}`);
};

/**
 * @param {string} tableName
 * @param {string} constraintName
 * @return string
 * */
const dropConstraint = (tableName, constraintName) => {
	const templateConfig = {
		tableName,
		constraintName,
	};
	return assignTemplates(templates.dropConstraint, templateConfig);
};

/**
 * @param tableName {string}
 * @param constraintName {string}
 * @param expression {string}
 * @param noInherit {boolean}
 * @return string
 * */
const addCheckConstraint = (tableName, constraintName, expression, noInherit = false) => {
	const templateConfig = {
		tableName,
		constraintName,
		expression,
		noInherit: noInherit ? ' NO INHERIT' : '',
	};
	return assignTemplates(templates.addCheckConstraint, templateConfig);
};

/**
 * @param {Object} collection
 * @return {ColumnCheckConstraintHistoryEntry[]}
 * */
const mapColumnCheckConstraintsToChangeHistory = collection => {
	const history = [];

	_.toPairs(collection.properties).forEach(([columnName, jsonSchema]) => {
		const oldColumnName = jsonSchema.compMod?.oldField?.name || columnName;
		const newCheckConstraint = _.isEmpty(jsonSchema.checkConstraint)
			? undefined
			: _.omit(_.first(jsonSchema.checkConstraint), 'id');

		const oldCheckConstraintValue = collection.role.properties?.[oldColumnName]?.checkConstraint;
		const oldCheckConstraint = _.isEmpty(oldCheckConstraintValue)
			? undefined
			: _.omit(_.first(oldCheckConstraintValue), 'id');

		if (!newCheckConstraint && !oldCheckConstraint) {
			return;
		}

		history.push({
			columnName,
			old: oldCheckConstraint,
			new: newCheckConstraint,
			isActivated: jsonSchema.isActivated,
		});
	});

	return history;
};

/**
 * @param {ColumnCheckConstraintHistoryEntry[]} constraintHistory
 * @param {string} fullTableName
 * @return {AlterScriptDto[]}
 * */
const getDropColumnCheckConstraintScriptDtos = (constraintHistory, fullTableName) => {
	return constraintHistory
		.filter(historyEntry => historyEntry.old?.expression && !historyEntry.new?.expression)
		.map(historyEntry => {
			const wrappedConstraintName = getConstraintName(
				historyEntry.old.name,
				historyEntry.columnName,
				fullTableName,
			);
			const script = dropConstraint(fullTableName, wrappedConstraintName);
			return AlterScriptDto.getInstance(script, historyEntry.isActivated, true, SCRIPT_TYPE.alterEntity);
		});
};

/**
 * @param {ColumnCheckConstraintHistoryEntry[]} constraintHistory
 * @param {string} fullTableName
 * @return {AlterScriptDto[]}
 * */
const getAddColumnCheckConstraintScriptDtos = (constraintHistory, fullTableName) => {
	return constraintHistory
		.filter(historyEntry => historyEntry.new?.expression && !historyEntry.old?.expression)
		.map(historyEntry => {
			const { name, expression, noInherit } = historyEntry.new;
			const constraintName = getConstraintName(name, historyEntry.columnName, fullTableName);

			const script = addCheckConstraint(fullTableName, constraintName, expression, noInherit);
			return AlterScriptDto.getInstance(script, historyEntry.isActivated, false, SCRIPT_TYPE.alterEntity);
		});
};

/**
 * @param {ColumnCheckConstraintHistoryEntry[]} constraintHistory
 * @param {string} fullTableName
 * @return {AlterScriptDto[]}
 * */
const getUpdateColumnCheckConstraintScriptDtos = (constraintHistory, fullTableName) => {
	return constraintHistory
		.filter(historyEntry => {
			if (historyEntry.old?.expression && historyEntry.new?.expression) {
				const oldExpression = historyEntry.old.expression;
				const newExpression = historyEntry.new.expression;
				const oldNoInherit = historyEntry.old.noInherit;
				const newNoInherit = historyEntry.new.noInherit;
				const oldName = historyEntry.old.name;
				const newName = historyEntry.new.name;
				return oldExpression !== newExpression || oldNoInherit !== newNoInherit || oldName !== newName;
			}
			return false;
		})
		.flatMap(historyEntry => {
			const { name: oldConstrainName } = historyEntry.old;
			const wrappedOldConstraintName = getConstraintName(
				oldConstrainName,
				historyEntry.columnName,
				fullTableName,
			);
			const dropConstraintScript = dropConstraint(fullTableName, wrappedOldConstraintName);

			const {
				name: newConstrainName,
				expression: newConstraintExpression,
				noInherit: newNoInherit,
			} = historyEntry.new;
			const addConstraintScript = addCheckConstraint(
				fullTableName,
				getConstraintName(newConstrainName, historyEntry.columnName, fullTableName),
				newConstraintExpression,
				newNoInherit,
			);

			return [
				AlterScriptDto.getInstance(
					dropConstraintScript,
					historyEntry.isActivated,
					true,
					SCRIPT_TYPE.alterEntity,
				),
				AlterScriptDto.getInstance(
					addConstraintScript,
					historyEntry.isActivated,
					false,
					SCRIPT_TYPE.alterEntity,
				),
			];
		});
};

/**
 * @param {Object} collection
 * @return {AlterScriptDto[]}
 * */
const getModifyColumnCheckConstraintScriptDtos = collection => {
	const fullTableName = getFullTableName(collection);
	const constraintHistory = mapColumnCheckConstraintsToChangeHistory(collection);

	const isContainerActivated = isParentContainerActivated(collection);
	const isCollectionActivated = isObjectInDeltaModelActivated(collection);

	const addCheckConstraintScripts = getAddColumnCheckConstraintScriptDtos(constraintHistory, fullTableName);
	const dropCheckConstraintScripts = getDropColumnCheckConstraintScriptDtos(constraintHistory, fullTableName);
	const updateCheckConstraintScripts = getUpdateColumnCheckConstraintScriptDtos(constraintHistory, fullTableName);

	return [...addCheckConstraintScripts, ...dropCheckConstraintScripts, ...updateCheckConstraintScripts].map(dto => ({
		...dto,
		isActivated: isContainerActivated && isCollectionActivated && dto.isActivated,
	}));
};

module.exports = {
	getModifyColumnCheckConstraintScriptDtos,
};
