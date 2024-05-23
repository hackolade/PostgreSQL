class KeyTransitionDto {
  /**
   * @type {boolean}
   * */
  didTransitionHappen;

  /**
   * @type {boolean | undefined}
   * */
  wasPkChangedInTransition;

  /**
   * @return {KeyTransitionDto}
   * */
  static noTransition() {
    return {
      didTransitionHappen: false,
    };
  }

  /**
   * @param {boolean} wasPkChangedInTransition
   * @return {KeyTransitionDto}
   * */
  static transition(wasPkChangedInTransition) {
    return {
      didTransitionHappen: true,
      wasPkChangedInTransition,
    };
  }
}

class KeyScriptModificationDto {
  /**
   * @type {string}
   * */
  script;

  /**
   * @type {boolean}
   * */
  isDropScript;

  /**
   * @type {string}
   * */
  fullTableName;

  /**
   * @type {boolean}
   * */
  isActivated;

  /**
   * @param {string} fullTableName
   * @param {string} script
   * @param {boolean} isDropScript
   * @param {boolean} isActivated
   * */
  constructor(script, fullTableName, isDropScript, isActivated) {
    this.script = script;
    this.isDropScript = isDropScript;
    this.fullTableName = fullTableName;
    this.isActivated = isActivated;
  }
}

module.exports = {
  KeyScriptModificationDto,
  KeyTransitionDto,
};