const SCRIPT_TYPE = /** @type {const} */ ({
	createContainer: 'CREATE_CONTAINER',
	dropContainer: 'DROP_CONTAINER',
	alterContainer: 'ALTER_CONTAINER',
	createEntity: 'CREATE_ENTITY',
	dropEntity: 'DROP_ENTITY',
	alterEntity: 'ALTER_ENTITY',
	createView: 'CREATE_VIEW',
	dropView: 'DROP_VIEW',
	alterView: 'ALTER_VIEW',
	createForeignKey: 'CREATE_FOREIGN_KEY',
	dropForeignKey: 'DROP_FOREIGN_KEY',
	createUDT: 'CREATE_UDT',
	dropUDT: 'CREATE_UDT',
	alterUDT: 'CREATE_UDT',
	createEntityIndex: 'CREATE_ENTITY_INDEX',
	dropEntityIndex: 'DROP_ENTITY_INDEX',
	alterEntityIndex: 'ALTER_ENTITY_INDEX',
});

class AlterScriptDto {
	/**
	 * @type {boolean | undefined}
	 */
	isActivated;

	/**
	 * @type {boolean}
	 * */
	isDropScript;

	/**
	 * @type {string}
	 */
	script;

	/**
	 * @type {typeof SCRIPT_TYPE[keyof typeof SCRIPT_TYPE] | null}
	 */
	scriptType;

	/**
	 * @type {string | null}
	 */
	entityId;

	/**
	 * @param {string} script
	 * @param {boolean} isActivated
	 * @param {boolean} isDropScripts
	 * @return {AlterScriptDto | undefined}
	 * */
	static getInstance(script, isActivated, isDropScript, scriptType, entityId) {
		const cleanScript = script?.trim();
		if (!cleanScript) {
			return null;
		}
		return {
			isActivated,
			isDropScript,
			script: cleanScript,
			scriptType,
			entityId,
		};
	}
}

module.exports = {
	AlterScriptDto,
	SCRIPT_TYPE,
};
