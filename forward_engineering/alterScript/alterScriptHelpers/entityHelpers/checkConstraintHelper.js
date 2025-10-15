const _ = require('lodash');
const { AlterCollectionDto } = require('../../types/AlterCollectionDto');
const { AlterScriptDto } = require('../../types/AlterScriptDto');
const {
	getFullTableName,
	wrapInQuotes,
	isParentContainerActivated,
	isObjectInDeltaModelActivated,
} = require('../../../utils/general');
const assignTemplates = require('../../../utils/assignTemplates');
const templates = require('../../../ddlProvider/templates');

/**
 * @typedef {{
 *     id: string,
 *     chkConstrName: string,
 *     constrExpression: string,
 *     noInherit?: boolean,
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
		.filter(historyEntry => historyEntry.old?.constrExpression && !historyEntry.new?.constrExpression)
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
 * @param {Array<CheckConstraintHistoryEntry>} constraintHistory
 * @param {string} fullTableName
 * @return {Array<AlterScriptDto>}
 * */
const getAddCheckConstraintScriptDtos = (constraintHistory, fullTableName) => {
	return constraintHistory
		.filter(historyEntry => historyEntry.new?.constrExpression && !historyEntry.old?.constrExpression)
		.map(historyEntry => {
			const { chkConstrName, constrExpression, noInherit } = historyEntry.new;
			return addCheckConstraint(fullTableName, wrapInQuotes(chkConstrName), constrExpression, noInherit);
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
			if (historyEntry.old?.constrExpression && historyEntry.new?.constrExpression) {
				const oldExpression = historyEntry.old.constrExpression;
				const newExpression = historyEntry.new.constrExpression;
				const oldNoInherit = historyEntry.old.noInherit;
				const newNoInherit = historyEntry.new.noInherit;
				return oldExpression !== newExpression || oldNoInherit !== newNoInherit;
			}
			return false;
		})
		.map(historyEntry => {
			const { chkConstrName: oldConstrainName } = historyEntry.old;
			const dropConstraintScript = dropConstraint(fullTableName, wrapInQuotes(oldConstrainName));

			const {
				chkConstrName: newConstrainName,
				constrExpression: newConstraintExpression,
				noInherit: newNoInherit,
			} = historyEntry.new;
			const addConstraintScript = addCheckConstraint(
				fullTableName,
				wrapInQuotes(newConstrainName),
				newConstraintExpression,
				newNoInherit,
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

	const isContainerActivated = isParentContainerActivated(collection);
	const isCollectionActivated = isObjectInDeltaModelActivated(collection);

	const addCheckConstraintScripts = getAddCheckConstraintScriptDtos(constraintHistory, fullTableName);
	const dropCheckConstraintScripts = getDropCheckConstraintScriptDtos(constraintHistory, fullTableName);
	const updateCheckConstraintScripts = getUpdateCheckConstraintScriptDtos(constraintHistory, fullTableName);

	return [...addCheckConstraintScripts, ...dropCheckConstraintScripts, ...updateCheckConstraintScripts].map(dto => ({
		...dto,
		isActivated: isContainerActivated && isCollectionActivated,
	}));
};

module.exports = {
	getModifyCheckConstraintScriptDtos,
};
