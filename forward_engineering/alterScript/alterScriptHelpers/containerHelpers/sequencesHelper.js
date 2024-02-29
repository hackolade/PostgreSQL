const { AlterScriptDto } = require('../../types/AlterScriptDto');
const { App } = require('../../../types/coreApplicationTypes');
const sequencesCompModKey = 'sequences';

/**
 * @param {{ app: App }}
 * @return {({ container }: { container: object }) => AlterScriptDto[]}
 * */
const getAddContainerSequencesScriptDtos = ({ app }) => ({ container }) => {
    const _ = app.require('lodash');
    const ddlProvider = require('../../../ddlProvider')(null, null, app);
    const { getDbName } = require('../../../utils/general')(_);
    const schemaName = getDbName([container.role]);

    return (container.role?.sequences || [])
        .map((sequence) => ddlProvider.createSchemaSequence({ schemaName, sequence }))
        .map((script) => AlterScriptDto.getInstance([script], true, false))
        .filter(Boolean);
};

/**
 * @param {{ app: App }}
 * @return {({ container }: { container: object }) => AlterScriptDto[]}
 * */
const getModifyContainerSequencesScriptDtos = ({ app }) => ({ container }) => {
    const _ = app.require('lodash');
    const ddlProvider = require('../../../ddlProvider')(null, null, app);
    const { getDbName, getGroupItemsByCompMode } =
        require('../../../utils/general')(_);

    const schemaName = getDbName([container.role]);
    const sequencesCompMod = container.role?.compMod?.[sequencesCompModKey] || {};
    const { new: newItems = [], old: oldItems = [] } = sequencesCompMod;

    const { removed, added, modified } = getGroupItemsByCompMode({
        newItems,
        oldItems,
    });

    const removedScriptDtos = removed
        .map((sequence) => {
            return ddlProvider.dropSchemaSequence({ schemaName, sequence });
        })
        .map((script) => AlterScriptDto.getInstance([script], true, true));
    const addedScriptDtos = added
        .map((sequence) =>
            ddlProvider.createSchemaSequence({ schemaName, sequence })
        )
        .map((script) => AlterScriptDto.getInstance([script], true, false));

    const modifiedScriptDtos = modified
        .map((sequence) => {
            const oldSequence = _.find(oldItems, { id: sequence.id }) || {};
            return ddlProvider.alterSchemaSequence({
                schemaName,
                sequence,
                oldSequence,
            });
        })
        .map((script) => AlterScriptDto.getInstance([script], true, false));

    return [
        ...modifiedScriptDtos,
        ...removedScriptDtos,
        ...addedScriptDtos,
    ].filter(Boolean);
};

/**
 * @param {{ app: App }}
 * @return {({ container }: { container: object }) => AlterScriptDto[]}
 * */
const getDeleteContainerSequencesScriptDtos = ({ app }) => ({ container }) => {
    const _ = app.require('lodash');
    const ddlProvider = require('../../../ddlProvider')(null, null, app);
    const { getDbName } = require('../../../utils/general')(_);
    const schemaName = getDbName([container.role]);

    return (container.role?.sequences || [])
        .map((sequence) => ddlProvider.dropSchemaSequence({ schemaName, sequence }))
        .map((script) => AlterScriptDto.getInstance([script], true, true))
        .filter(Boolean);
};

module.exports = {
    getAddContainerSequencesScriptDtos,
    getModifyContainerSequencesScriptDtos,
    getDeleteContainerSequencesScriptDtos,
};
