const _ = require('lodash');
const { AlterCollectionDto } = require('../../types/AlterCollectionDto');
const { AlterScriptDto } = require('../../types/AlterScriptDto');
const { getFullTableName, wrapInQuotes } = require('../../../utils/general');
const assignTemplates = require('../../../utils/assignTemplates');
const templates = require('../../../ddlProvider/templates');

/**
 * @typedef {{
 *     id: string,
 *     chkConstrName: string,
 *     constrExpression: string,
 * }} CheckConstraint
 *
 * @typedef {{
 *     old?: CheckConstraint,
 *     new?: CheckConstraint
 * }} CheckConstraintHistoryEntry
 * */

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
 * @param {AlterCollectionDto} collection
 * @return {Array<CheckConstraintHistoryEntry>}
 * */
const mapCheckConstraintNamesToChangeHistory = collection => {
	const checkConstraintHistory = collection?.compMod?.chkConstr;
	if (!checkConstraintHistory) {
		return [];
	}
	const newConstraints = checkConstraintHistory.new || [];
	const oldConstraints = checkConstraintHistory.old || [];
	const constrNames = _.chain([...newConstraints, ...oldConstraints])
		.map(constr => constr.chkConstrName)
		.uniq()
		.value();

	return constrNames.map(chkConstrName => {
		return {
			old: _.find(oldConstraints, { chkConstrName }),
			new: _.find(newConstraints, { chkConstrName }),
		};
	});
};

/**
 * @param {Array<CheckConstraintHistoryEntry>} constraintHistory
 * @param {string} fullTableName
 * @return {Array<AlterScriptDto>}
 * */
const getDropCheckConstraintScriptDtos = (constraintHistory, fullTableName) => {
	return constraintHistory
		.filter(historyEntry => historyEntry.old && !historyEntry.new)
		.map(historyEntry => {
			const wrappedConstraintName = wrapInQuotes(historyEntry.old.chkConstrName);
			return dropConstraint(fullTableName, wrappedConstraintName);
		})
		.map(script => AlterScriptDto.getInstance([script], true, true));
};

/**
 * @param tableName {string}
 * @param constraintName {string}
 * @param expression {expression}
 * @return string
 * */
const addCheckConstraint = (tableName, constraintName, expression) => {
	const templateConfig = {
		tableName,
		constraintName,
		expression,
	};
	return assignTemplates(templates.addCheckConstraint, templateConfig);
};

/**
 * @param {Array<CheckConstraintHistoryEntry>} constraintHistory
 * @param {string} fullTableName
 * @return {Array<AlterScriptDto>}
 * */
const getAddCheckConstraintScriptDtos = (constraintHistory, fullTableName) => {
	return constraintHistory
		.filter(historyEntry => historyEntry.new && !historyEntry.old)
		.map(historyEntry => {
			const { chkConstrName, constrExpression } = historyEntry.new;
			return addCheckConstraint(fullTableName, wrapInQuotes(chkConstrName), constrExpression);
		})
		.map(script => AlterScriptDto.getInstance([script], true, false));
};

/**
 * @param {Array<CheckConstraintHistoryEntry>} constraintHistory
 * @param {string} fullTableName
 * @return {Array<AlterScriptDto>}
 * */
const getUpdateCheckConstraintScriptDtos = (constraintHistory, fullTableName) => {
	return constraintHistory
		.filter(historyEntry => {
			if (historyEntry.old && historyEntry.new) {
				const oldExpression = historyEntry.old.constrExpression;
				const newExpression = historyEntry.new.constrExpression;
				return oldExpression !== newExpression;
			}
			return false;
		})
		.map(historyEntry => {
			const { chkConstrName: oldConstrainName } = historyEntry.old;
			const dropConstraintScript = dropConstraint(fullTableName, wrapInQuotes(oldConstrainName));

			const { chkConstrName: newConstrainName, constrExpression: newConstraintExpression } = historyEntry.new;
			const addConstraintScript = addCheckConstraint(
				fullTableName,
				wrapInQuotes(newConstrainName),
				newConstraintExpression,
			);

			return [
				AlterScriptDto.getInstance([dropConstraintScript], true, true),
				AlterScriptDto.getInstance([addConstraintScript], true, false),
			];
		})
		.flat();
};

/**
 * @param {AlterCollectionDto} collection
 * @return {Array<AlterScriptDto>}
 * */
const getModifyCheckConstraintScriptDtos = collection => {
	const fullTableName = getFullTableName(collection);
	const constraintHistory = mapCheckConstraintNamesToChangeHistory(collection);

	const addCheckConstraintScripts = getAddCheckConstraintScriptDtos(constraintHistory, fullTableName);
	const dropCheckConstraintScripts = getDropCheckConstraintScriptDtos(constraintHistory, fullTableName);
	const updateCheckConstraintScripts = getUpdateCheckConstraintScriptDtos(constraintHistory, fullTableName);

	return [...addCheckConstraintScripts, ...dropCheckConstraintScripts, ...updateCheckConstraintScripts];
};

module.exports = {
	getModifyCheckConstraintScriptDtos,
};
