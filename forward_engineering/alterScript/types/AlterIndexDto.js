class AlterIndexColumnDto {
	/**
	 * @type {any | undefined}
	 */
	sortOrder;

	/**
	 * @type {any | undefined}
	 */
	nullsOrder;

	/**
	 * @type {boolean}
	 */
	isActivated;

	/**
	 * @type {any | undefined}
	 */
	keyId;

	/**
	 * @type {string | undefined}
	 */
	collation;

	/**
	 * @type {string | undefined}
	 */
	opclass;
}

class AlterIndexIncludeColumnDto {
	/**
	 * @type {string}
	 * */
	keyId;
}

class AlterIndexDto {
	/**
	 * @type {string}
	 */
	id;

	/**
	 * @type {boolean}
	 */
	isActivated;

	/**
	 * @type {string}
	 */
	index_method;

	/**
	 * @type {boolean}
	 */
	ifNotExist;

	/**
	 * @type {boolean}
	 */
	only;

	/**
	 * @type {string}
	 */
	index_tablespace_name;

	/**
	 * @type {string}
	 */
	indxName;

	/**
	 * @type {Array<AlterIndexColumnDto> | undefined}
	 * */
	columns;

	/**
	 * @type {Array<AlterIndexIncludeColumnDto> | undefined}
	 * */
	include;

	/**
	 * @type {Object}
	 * */
	index_storage_parameter;
}

module.exports = {
	AlterIndexDto,
	AlterIndexColumnDto,
	AlterIndexIncludeColumnDto,
};
