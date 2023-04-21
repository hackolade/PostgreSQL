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


const {getFullTableName} = require("../ddlHelper");

/**
 * @return {(collection: Object) => Array<CheckConstraintHistoryEntry>}
 * */
const mapCheckConstraintNamesToChangeHistory = (_) => (collection) => {
    const checkConstraintHistory = collection?.compMod?.chkConstr;
    if (!checkConstraintHistory) {
        return [];
    }
    const newConstraints = checkConstraintHistory.new || [];
    const oldConstraints = checkConstraintHistory.old || [];
    const constrNames = _.chain([ ...newConstraints, ...oldConstraints ])
        .map(constr => constr.chkConstrName)
        .uniq()
        .value();

    return constrNames.map(chkConstrName => {
        return {
            old: _.find(oldConstraints, { chkConstrName }),
            new: _.find(newConstraints, { chkConstrName }),
        };
    })
}

/**
 * @return {(constraintHistory: Array<CheckConstraintHistoryEntry>, fullTableName: string) => Array<string>}
 * */
const getDropCheckConstraintScripts = (_, ddlProvider) => (constraintHistory, fullTableName) => {
    const {wrapInQuotes} = require('../../general')({_});

    return constraintHistory
        .filter(historyEntry => historyEntry.old && !historyEntry.new)
        .map(historyEntry => {
            const wrappedConstraintName = wrapInQuotes(historyEntry.old.chkConstrName);
            return ddlProvider.dropConstraint(fullTableName, wrappedConstraintName);
        });
}

/**
 * @return {(constraintHistory: Array<CheckConstraintHistoryEntry>, fullTableName: string) => Array<string>}
 * */
const getAddCheckConstraintScripts = (_, ddlProvider) => (constraintHistory, fullTableName) => {
    const {wrapInQuotes} = require('../../general')({_});

    return constraintHistory
        .filter(historyEntry => historyEntry.new && !historyEntry.old)
        .map(historyEntry => {
            const { chkConstrName, constrExpression } = historyEntry.new;
            return ddlProvider.addCheckConstraint(fullTableName, wrapInQuotes(chkConstrName), constrExpression);
        });
}

/**
 * @return {(constraintHistory: Array<CheckConstraintHistoryEntry>, fullTableName: string) => Array<string>}
 * */
const getUpdateCheckConstraintScripts = (_, ddlProvider) => (constraintHistory, fullTableName) => {
    const {wrapInQuotes} = require('../../general')({_});

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
            const dropConstraintScript = ddlProvider.dropConstraint(fullTableName, wrapInQuotes(oldConstrainName));

            const { chkConstrName: newConstrainName, constrExpression: newConstraintExpression } = historyEntry.new;
            const addConstraintScript = ddlProvider.addCheckConstraint(fullTableName, wrapInQuotes(newConstrainName), newConstraintExpression);

            return [dropConstraintScript, addConstraintScript];
        })
        .flat();
}

/**
 * @return (collection: Object) => Array<string>
 * */
const getModifyCheckConstraintScripts = (_, ddlProvider) => (collection) => {
    const fullTableName = getFullTableName(_)(collection);
    const constraintHistory = mapCheckConstraintNamesToChangeHistory(_)(collection);

    const addCheckConstraintScripts = getAddCheckConstraintScripts(_, ddlProvider)(constraintHistory, fullTableName);
    const dropCheckConstraintScripts = getDropCheckConstraintScripts(_, ddlProvider)(constraintHistory, fullTableName);
    const updateCheckConstraintScripts = getUpdateCheckConstraintScripts(_, ddlProvider)(constraintHistory, fullTableName);

    return [
        ...addCheckConstraintScripts,
        ...dropCheckConstraintScripts,
        ...updateCheckConstraintScripts,
    ]
}

module.exports = {
    getModifyCheckConstraintScripts
}
