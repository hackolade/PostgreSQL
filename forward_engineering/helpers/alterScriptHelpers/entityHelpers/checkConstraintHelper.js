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


const {getFullTableName} = require("./ddlHelper");
/**
 * @return {Map<string, CheckConstraintHistoryEntry>}
 * */
const mapCheckConstraintNamesToChangeHistory = (collection) => {
    const out = new Map();
    const checkConstraintHistory = collection?.compMod?.chkConstr;
    if (!checkConstraintHistory) {
        return out;
    }
    const newConstraints = checkConstraintHistory.new || [];
    const oldConstraints = checkConstraintHistory.old || [];

    /**
     * @param constraints {Array<any>}
     * @param constraintType {"new" | "old"}
     * */
    const fillConstraintHistoryMap = (constraints, constraintType) => {
        for (const constraint of constraints) {
            let existingHistoryEntry = out.get(constraint.chkConstrName);
            if (!existingHistoryEntry) {
                existingHistoryEntry = {"new": undefined, old: undefined};
                out.set(constraint.chkConstrName, existingHistoryEntry);
            }
            existingHistoryEntry[constraintType] = constraint;
        }
    }

    fillConstraintHistoryMap(newConstraints, 'new');
    fillConstraintHistoryMap(oldConstraints, 'old');
    return out;
}

/**
 * @return {(constraintHistory: Map<string, CheckConstraintHistoryEntry>, collection: Object) => Array<string>}
 * */
const getDropCheckConstraintScripts = (_, ddlProvider) => (constraintHistory, collection) => {
    const {wrapInQuotes} = require('../../general')({_});

    const fullTableName = getFullTableName(_)(collection);
    return Array.from(constraintHistory.values())
        .filter(historyEntry => historyEntry.old && !historyEntry.new)
        .map(historyEntry => {
            const wrappedConstraintName = wrapInQuotes(historyEntry.old.chkConstrName);
            return ddlProvider.dropConstraint(fullTableName, wrappedConstraintName);
        });
}

/**
 * @return {(constraintHistory: Map<string, CheckConstraintHistoryEntry>, collection: Object) => Array<string>}
 * */
const getAddCheckConstraintScripts = (_, ddlProvider) => (constraintHistory, collection) => {
    const {wrapInQuotes} = require('../../general')({_});

    const fullTableName = getFullTableName(_)(collection);
    return Array.from(constraintHistory.values())
        .filter(historyEntry => historyEntry.new && !historyEntry.old)
        .map(historyEntry => {
            const { chkConstrName, constrExpression } = historyEntry.new;
            return ddlProvider.addCheckConstraint(fullTableName, wrapInQuotes(chkConstrName), constrExpression);
        });
}

/**
 * @return {(constraintHistory: Map<string, CheckConstraintHistoryEntry>, collection: Object) => Array<string>}
 * */
const getUpdateCheckConstraintScripts = (_, ddlProvider) => (constraintHistory, collection) => {
    const {wrapInQuotes} = require('../../general')({_});

    const fullTableName = getFullTableName(_)(collection);
    return Array.from(constraintHistory.values())
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
    const constraintHistory = mapCheckConstraintNamesToChangeHistory(collection);

    const addCheckConstraintScripts = getAddCheckConstraintScripts(_, ddlProvider)(constraintHistory, collection);
    const dropCheckConstraintScripts = getDropCheckConstraintScripts(_, ddlProvider)(constraintHistory, collection);
    const updateCheckConstraintScripts = getUpdateCheckConstraintScripts(_, ddlProvider)(constraintHistory, collection);

    return [
        ...addCheckConstraintScripts,
        ...dropCheckConstraintScripts,
        ...updateCheckConstraintScripts,
    ]
}

module.exports = {
    getModifyCheckConstraintScripts
}
