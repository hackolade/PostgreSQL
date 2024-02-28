const { AlterScriptDto } = require("../../types/AlterScriptDto");
const sequencesCompModKey = "sequences";

/**
 * @return {(containerName: string) => AlterScriptDto | undefined}
 * */
const getAddContainerSequencesScriptDtos = (app) => (data) => {
  const _ = app.require("lodash");
  const ddlProvider = require("../../../ddlProvider")(null, null, app);
  const { getDbName } = require("../../../utils/general")(_);
  const schemaName = getDbName([data.role]);

  return (data.role?.sequences || [])
    .map((sequence) => ddlProvider.createSchemaSequence({ schemaName, sequence }))
    .map((script) => AlterScriptDto.getInstance([script], true, false))
    .filter(Boolean);
};

/**
 * @return {(data: Object) => Array<AlterScriptDto>}
 * */
const getModifyContainerSequencesScriptDtos = (app) => (data) => {
  const _ = app.require("lodash");
  const ddlProvider = require("../../../ddlProvider")(null, null, app);
  const { getDbName, getGroupItemsByCompMode } =
    require("../../../utils/general")(_);

  const schemaName = getDbName([data.role]);
  const sequencesCompMod = data.role?.compMod?.[sequencesCompModKey] || {};
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
 * @return {(containerName: string) => AlterScriptDto | undefined}
 * */
const getDeleteContainerSequencesScriptDtos = (app) => (data) => {
  const _ = app.require("lodash");
  const ddlProvider = require("../../../ddlProvider")(null, null, app);
  const { getDbName } = require("../../../utils/general")(_);
  const schemaName = getDbName([data.role]);

  return (data.role?.sequences || [])
    .map((sequence) => ddlProvider.dropSchemaSequence({ schemaName, sequence }))
    .map((script) => AlterScriptDto.getInstance([script], true, true))
    .filter(Boolean);
};

module.exports = {
  getAddContainerSequencesScriptDtos,
  getModifyContainerSequencesScriptDtos,
  getDeleteContainerSequencesScriptDtos,
};
